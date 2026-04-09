import { Session } from './Session';
import {
    InboundStreamOptions,
    LocalConnectionOptions,
    RemoteConnectionOptions,
    StreamOptionsServer,
} from './interfaces';
import { Stream } from './Stream';
import { Logger } from './Logger';

const logger = Logger.getInstance();

/**
 * Connection — представление потока сессии.
 *
 * Может быть локальным (наше подключение) или удалённым (камера).
 * Содержит один или несколько потоков.
 */
export class Connection {
    /** Опции локального подключения (заполнены только для нашего) */
    public readonly localOptions?: LocalConnectionOptions;

    /** Опции удалённого подключения (камеры) */
    public readonly remoteOptions?: RemoteConnectionOptions;

    public readonly connectionId: string;

    public readonly creationTime: number;

    public data: string = '';

    public rpcSessionId: string = '';

    public role: string = '';
    public stream?: Stream;

    /** Отключено ли подключение */
    public disposed: boolean = false;

    constructor(
        private readonly session: Session,
        connectionOptions: LocalConnectionOptions | RemoteConnectionOptions
    ) {
        let msg = "'Connection' created ";

        if ('role' in connectionOptions) {
            const local = connectionOptions as LocalConnectionOptions;
            this.localOptions = local;
            this.connectionId = local.id;
            this.creationTime = local.createdAt;
            this.data = local.metadata;
            this.rpcSessionId = local.sessionId;
            this.role = local.role;
            msg += '(local)';
        } else {
            const remote = connectionOptions as RemoteConnectionOptions;
            this.remoteOptions = remote;
            this.connectionId = remote.id;
            this.creationTime = remote.createdAt;
            if (remote.metadata) {
                this.data = remote.metadata;
            }
            if (remote.streams) {
                this.initRemoteStreams(remote.streams);
            }
            msg += `(remote) with connectionId [${remote.id}]`;
        }

        logger.info(msg);
    }

    /**
     * Отправить ICE-кандидат серверу для этого подключения.
     */
    public async sendIceCandidate(candidate: RTCIceCandidate): Promise<void> {
        if (this.disposed) {
            logger.warn(`Connection ${this.connectionId} disposed, ICE candidate not sent`);
            return;
        }

        logger.debug(
            `${this.stream?.outboundStreamOpts ? 'Local' : 'Remote'} candidate for ${this.connectionId}`,
            candidate
        );

        try {
            await this.session.rpcClient.send('onIceCandidate', {
                endpointName: this.connectionId,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
            });
        } catch (error) {
            logger.error('Error sending ICE candidate: ' + JSON.stringify(error));
            this.session.emit('error', new Error('Error sending ICE candidate'));
        }
    }

    /**
     * Инициализировать удалённые потоки по данным от сервера.
     */
    public initRemoteStreams(options: StreamOptionsServer[]): void {
        options.forEach((opts) => {
            const streamOptions: InboundStreamOptions = {
                id: opts.id,
                createdAt: opts.createdAt,
                connection: this,
                hasAudio: opts.hasAudio,
                hasVideo: opts.hasVideo,
                audioActive: opts.audioActive,
                videoActive: opts.videoActive,
                typeOfVideo: opts.typeOfVideo,
                frameRate: opts.frameRate,
                videoDimensions: opts.videoDimensions ? JSON.parse(opts.videoDimensions) : undefined,
            };
            const stream = new Stream(this.session, streamOptions);
            this.addStream(stream);
        });
    }


    public addStream(stream: Stream): void {
        stream.connection = this;
        this.stream = stream;
    }

    public removeStream(): void {
        this.stream = undefined;
    }

    public dispose(): void {
        this.disposed = true;
        this.removeStream();
    }
}