import { TypedEventEmitter } from './utils/EventEmitter';
import { JsonRpcClient } from './JsonRpcClient';
import { Logger } from './Logger';
import { VideoInsertMode, } from './interfaces';
import { Connection } from './Connection';
import { Subscriber } from './Subscriber';
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
export class Session extends TypedEventEmitter {
    sessionId;
    rpcClient;
    mediaClient;
    streamManagers = [];
    connection = null;
    /** Удалённые подключения (камеры) */
    remoteConnections = new Map();
    remoteStreamsCreated = new Map();
    constructor(mediaClient) {
        super();
        this.mediaClient = mediaClient;
    }
    /**
     * Подключиться к медиа-серверу по токену.
     *
     * Разбирает токен, устанавливает WebSocket-соединение
     */
    async connect(token) {
        const params = this.parseToken(token);
        this.sessionId = params.sessionId;
        this.rpcClient = new JsonRpcClient((method, rpcParams) => this.handleServerEvent(method, rpcParams), (error) => this.emit('error', error), () => this.emit('disconnected'));
        await this.rpcClient.connect(params.wsUri + '?sessionId=' + this.sessionId);
        const joinResponse = await this.rpcClient.send('joinRoom', {
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
                const server = { urls: [ice.url] };
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
        const existingParticipants = joinResponse.value;
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
    subscribe(stream, properties) {
        const resolvedProps = properties ?? {
            insertMode: VideoInsertMode.APPEND,
            subscribeToAudio: true,
            subscribeToVideo: true,
        };
        stream.subscribe()
            .then(() => logger.info(`Subscribed correctly to ${stream.connection.connectionId}`))
            .catch((error) => logger.error(`Error subscribing to ${stream.connection.connectionId}: ${error}`));
        return new Subscriber(stream, resolvedProps);
    }
    disconnect() {
        this.rpcClient?.close();
        this.remoteConnections.forEach((conn) => conn.dispose());
        this.remoteConnections.clear();
        this.remoteStreamsCreated.clear();
        this.streamManagers = [];
        this.connection = null;
    }
    parseToken(token) {
        const match = token.match(/^(wss?)\:\/\/(([^:\/?#]*)(?:\:([0-9]+))?)([\/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/);
        if (!match)
            throw new Error("Invalid Token format");
        const wsUri = match[1] + '://' + match[2] + '/media';
        const searchString = token.split('?')[1] || '';
        const params = {};
        searchString.split('&').forEach((pair) => {
            const [k, v] = pair.split('=');
            if (k)
                params[k] = decodeURIComponent(v || '');
        });
        return {
            wsUri,
            sessionId: params.sessionId || '',
            secret: params.secret || '',
        };
    }
    handleServerEvent(method, params) {
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
    handleIceCandidate(params) {
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
            }
            else {
                logger.warn(`[Session] No WebRtcPeer for connection ${connectionId}`);
            }
        }
        else {
            logger.warn(`[Session] No connection/stream for ICE from ${connectionId}`);
        }
    }
    handleParticipantJoined(params) {
        const connection = new Connection(this, params);
        this.remoteConnections.set(connection.connectionId, connection);
        this.emit('connectionCreated', { session: this, connection });
    }
    handleParticipantPublished(params) {
        const connectionId = params.id;
        const connection = this.remoteConnections.get(connectionId);
        if (connection) {
            connection.initRemoteStreams(params.streams);
            if (connection.stream) {
                this.remoteStreamsCreated.set(connection.stream.streamId, true);
                this.emit('streamCreated', { session: this, stream: connection.stream });
            }
        }
    }
    handleParticipantLeft(params) {
        const connectionId = params.connectionId;
        const connection = this.remoteConnections.get(connectionId);
        if (connection?.stream) {
            this.emit('streamDestroyed', { session: this, stream: connection.stream });
        }
        if (connection) {
            connection.dispose();
            this.remoteConnections.delete(connectionId);
        }
    }
    handleParticipantUnpublished(params) {
        const connectionId = params.connectionId;
        const connection = this.remoteConnections.get(connectionId);
        if (connection?.stream) {
            this.emit('streamDestroyed', { session: this, stream: connection.stream });
            connection.removeStream();
        }
    }
}
