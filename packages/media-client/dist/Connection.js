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
    session;
    /** Опции локального подключения (заполнены только для нашего) */
    localOptions;
    /** Опции удалённого подключения (камеры) */
    remoteOptions;
    connectionId;
    creationTime;
    data = '';
    rpcSessionId = '';
    role = '';
    stream;
    /** Отключено ли подключение */
    disposed = false;
    constructor(session, connectionOptions) {
        this.session = session;
        let msg = "'Connection' created ";
        if ('role' in connectionOptions) {
            const local = connectionOptions;
            this.localOptions = local;
            this.connectionId = local.id;
            this.creationTime = local.createdAt;
            this.data = local.metadata;
            this.rpcSessionId = local.sessionId;
            this.role = local.role;
            msg += '(local)';
        }
        else {
            const remote = connectionOptions;
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
    async sendIceCandidate(candidate) {
        if (this.disposed) {
            logger.warn(`Connection ${this.connectionId} disposed, ICE candidate not sent`);
            return;
        }
        logger.debug(`${this.stream?.outboundStreamOpts ? 'Local' : 'Remote'} candidate for ${this.connectionId}`, candidate);
        try {
            await this.session.rpcClient.send('onIceCandidate', {
                endpointName: this.connectionId,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
            });
        }
        catch (error) {
            logger.error('Error sending ICE candidate: ' + JSON.stringify(error));
            this.session.emit('error', new Error('Error sending ICE candidate'));
        }
    }
    /**
     * Инициализировать удалённые потоки по данным от сервера.
     */
    initRemoteStreams(options) {
        options.forEach((opts) => {
            const streamOptions = {
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
    addStream(stream) {
        stream.connection = this;
        this.stream = stream;
    }
    removeStream() {
        this.stream = undefined;
    }
    dispose() {
        this.disposed = true;
        this.removeStream();
    }
}
