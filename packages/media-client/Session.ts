import { MediaClient } from './MediaClient';
import { TypedEventEmitter } from './utils/EventEmitter';
import { JsonRpcClient } from './JsonRpcClient';
import { Logger } from './Logger';
import {
    TokenParams,
    SessionEventMap,
    LocalConnectionOptions,
    RemoteConnectionOptions,
    SubscriberProperties,
    VideoInsertMode,
} from './interfaces';
import { Stream } from './Stream';
import { Connection } from './Connection';
import { Subscriber } from './Subscriber';
import { StreamManager } from './StreamManager';
import { PlatformUtils } from './utils/platform';

const logger = Logger.getInstance();

/**
 * Сессия — основной объект для подключения к медиа-серверу.
 *
 * Управляет WebSocket-соединением, обрабатывает серверные события,
 * и предоставляет API для подписки на потоки.
 *
 * @example
 * const session = mediaClient.initSession();
 * session.on('streamCreated', ({ stream }) => {
 *     const subscriber = session.subscribe(stream);
 *     subscriber.addVideoElement(videoEl);
 * });
 * await session.connect(token);
 */
export class Session extends TypedEventEmitter<SessionEventMap> {
    public sessionId!: string;

    public rpcClient!: JsonRpcClient;

    public readonly mediaClient: MediaClient;

    public streamManagers: StreamManager[] = [];

    private connection: Connection | null = null;

    /** Удалённые подключения (камеры) */
    private remoteConnections = new Map<string, Connection>();

    private remoteStreamsCreated = new Map<string, boolean>();

    constructor(mediaClient: MediaClient) {
        super();
        this.mediaClient = mediaClient;
    }

    /**
     * Подключиться к медиа-серверу по токену.
     *
     * Разбирает токен, устанавливает WebSocket-соединение
     */
    public async connect(token: string): Promise<void> {
        const params = this.parseToken(token);
        this.sessionId = params.sessionId;

        this.rpcClient = new JsonRpcClient(
            (method, rpcParams) => this.handleServerEvent(method, rpcParams),
            (error) => this.emit('error', error),
            () => this.emit('disconnected')
        );

        await this.rpcClient.connect(params.wsUri + '?sessionId=' + this.sessionId);

        const joinResponse = await this.rpcClient.send<LocalConnectionOptions>('joinRoom', {
            token,
            session: params.sessionId,
            platform: PlatformUtils.name,
            secret: params.secret,
            recorder: false,
            stt: false,
            metadata: params.sessionId,
        });

        // Применить ICE-серверы от сервера
        if (joinResponse.customIceServers?.length) {
            this.mediaClient.iceServers = joinResponse.customIceServers.map((ice) => {
                const server: RTCIceServer = { urls: [ice.url] };
                if (ice.username && ice.credential) {
                    server.username = ice.username;
                    server.credential = ice.credential;
                    logger.info(`TURN credentials [${ice.username}:${ice.credential}]`);
                }
                logger.info('STUN/TURN server IP: ' + ice.url);
                return server;
            });
        }

        this.connection = new Connection(this, joinResponse);
        this.emit('connectionCreated', { session: this, connection: this.connection });

        const existingParticipants: RemoteConnectionOptions[] = joinResponse.value;

        for (const remoteOpts of existingParticipants) {
            const connection = new Connection(this, remoteOpts);
            this.remoteConnections.set(connection.connectionId, connection);

            this.emit('connectionCreated', { session: this, connection });

            if (connection.stream) {
                this.remoteStreamsCreated.set(connection.stream.streamId, true);
                this.emit('streamCreated', { session: this, stream: connection.stream });
            }
        }
    }

    /**
     * Подписаться на удалённый поток.
     *
     * Запускает WebRTC-рукопожатие и возвращает объект Subscriber,
     * через который можно привязать видео-элемент.
     */
    public subscribe(stream: Stream, properties?: SubscriberProperties): Subscriber {
        const resolvedProps: SubscriberProperties = properties ?? {
            insertMode: VideoInsertMode.APPEND,
            subscribeToAudio: true,
            subscribeToVideo: true,
        };

        stream.subscribe()
            .then(() => logger.info(`Subscribed correctly to ${stream.connection.connectionId}`))
            .catch((error) => logger.error(`Error subscribing to ${stream.connection.connectionId}: ${error}`));

        return new Subscriber(stream, resolvedProps);
    }

    public disconnect(): void {
        this.rpcClient?.close();
        this.remoteConnections.forEach((conn) => conn.dispose());
        this.remoteConnections.clear();
        this.remoteStreamsCreated.clear();
        this.streamManagers = [];
        this.connection = null;
    }

    private parseToken(token: string): TokenParams {
        const match = token.match(/^(wss?)\:\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
        if (!match) throw new Error("Invalid Token format");

        const wsUri = match[1] + '://' + match[2] + '/media';
        const searchString = token.split('?')[1] || '';
        const params: Record<string, string> = {};

        searchString.split('&').forEach((pair) => {
            const [k, v] = pair.split('=');
            if (k) params[k] = decodeURIComponent(v || '');
        });

        return {
            wsUri,
            sessionId: params.sessionId || '',
            secret: params.secret || '',
        };
    }

    private handleServerEvent(method: string, params: Record<string, any>): void {
        logger.debug(`[Session] Server event: ${method}`, params);

        switch (method) {
            case 'iceCandidate':
                this.handleIceCandidate(params);
                break;

            case 'participantJoined':
                this.handleParticipantJoined(params);
                break;

            case 'participantPublished':
                this.handleParticipantPublished(params);
                break;

            case 'participantLeft':
                this.handleParticipantLeft(params);
                break;

            case 'participantUnpublished':
                this.handleParticipantUnpublished(params);
                break;

            default:
                logger.debug(`[Session] Unhandled server event: ${method}`);
                break;
        }
    }

    private handleIceCandidate(params: Record<string, any>): void {
        const connectionId = params.senderConnectionId || params.endpointName;
        const iceCandidate = new RTCIceCandidate({
            candidate: params.candidate,
            sdpMid: params.sdpMid,
            sdpMLineIndex: params.sdpMLineIndex,
        });

        const connection = this.remoteConnections.get(connectionId);
        if (connection?.stream) {
            const peer = connection.stream.getWebRtcPeer();
            if (peer) {
                peer.addIceCandidate(iceCandidate)
                    .catch((e) => logger.error('Error adding remote ICE candidate: ' + e));
            } else {
                logger.warn(`[Session] No WebRtcPeer for connection ${connectionId}`);
            }
        } else {
            logger.warn(`[Session] No connection/stream for ICE from ${connectionId}`);
        }
    }

    private handleParticipantJoined(params: Record<string, any>): void {
        const connection = new Connection(this, params as RemoteConnectionOptions);
        this.remoteConnections.set(connection.connectionId, connection);
        this.emit('connectionCreated', { session: this, connection });
    }

    private handleParticipantPublished(params: Record<string, any>): void {
        const connectionId = params.id as string;
        const connection = this.remoteConnections.get(connectionId);
        if (connection) {
            connection.initRemoteStreams(params.streams);
            if (connection.stream) {
                this.remoteStreamsCreated.set(connection.stream.streamId, true);
                this.emit('streamCreated', { session: this, stream: connection.stream });
            }
        }
    }

    private handleParticipantLeft(params: Record<string, any>): void {
        const connectionId = params.connectionId as string;
        const connection = this.remoteConnections.get(connectionId);
        if (connection?.stream) {
            this.emit('streamDestroyed', { session: this, stream: connection.stream });
        }
        if (connection) {
            connection.dispose();
            this.remoteConnections.delete(connectionId);
        }
    }

    private handleParticipantUnpublished(params: Record<string, any>): void {
        const connectionId = params.connectionId as string;
        const connection = this.remoteConnections.get(connectionId);
        if (connection?.stream) {
            this.emit('streamDestroyed', { session: this, stream: connection.stream });
            connection.removeStream();
        }
    }
}
