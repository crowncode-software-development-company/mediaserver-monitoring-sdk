import { Stream } from './Stream';
import { TypedEventEmitter } from './utils/EventEmitter';
import { Logger } from './Logger';
import { StreamManagerEventMap, StreamManagerVideo, VideoInsertMode } from './interfaces';

const logger = Logger.getInstance();

/**
 * Абстрактный базовый класс для управления видео-потоками.
 *
 * StreamManager связывает объект Stream с HTML video элементами
 * и эмитит события о состоянии воспроизведения.
 *
 * Наследники: Subscriber (и Publisher, если будет).
 */
export abstract class StreamManager extends TypedEventEmitter<StreamManagerEventMap> {
    public readonly stream: Stream;

    public videos: StreamManagerVideo[] = [];

    public readonly remote: boolean;

    private readonly canPlayListener: () => void;

    constructor(stream: Stream) {
        super();
        this.stream = stream;
        this.stream.streamManager = this;
        this.remote = !this.stream.isLocal();

        this.canPlayListener = () => {
            this.emit('streamPlaying', { streamManager: this });
        };
    }

    /**
     * Привязать HTML video-элемент к этому потоку.
     *
     * Устанавливает srcObject, настраивает свойства видео,
     * и регистрирует обработчик воспроизведения.
     *
     * @returns 1 если элемент добавлен, 0 если уже был, -1 если был перенесён
     */
    public addVideoElement(video: HTMLVideoElement): number {
        this.initializeVideoProperties(video);

        if (!this.remote && this.stream.displayMyRemote()) {
            const ms = this.stream.getMediaStream();
            if (ms && video.srcObject !== ms) {
                video.srcObject = ms;
            }
        }

        if (this.videos.some(v => v.video === video)) {
            return 0;
        }

        let returnNumber = 1;

        for (const sm of this.stream.session.streamManagers) {
            if (sm.disassociateVideo(video)) {
                returnNumber = -1;
                break;
            }
        }

        this.pushNewStreamManagerVideo({
            video,
            id: video.id,
            canplayListenerAdded: false,
        });

        logger.info('New video element associated to stream', this.stream.streamId);

        return returnNumber;
    }

    public updateMediaStream(mediaStream: MediaStream): void {
        this.videos.forEach((smv) => {
            smv.video.srcObject = mediaStream;
        });
    }

    /**
     * Отвязать video-элемент от этого StreamManager.
     */
    public disassociateVideo(video: HTMLVideoElement): boolean {
        for (let i = 0; i < this.videos.length; i++) {
            if (this.videos[i].video === video) {
                this.videos[i].video.removeEventListener('canplay', this.canPlayListener);
                this.videos.splice(i, 1);
                logger.info('Video element disassociated from stream', this.stream.streamId);
                return true;
            }
        }
        return false;
    }

    protected pushNewStreamManagerVideo(streamManagerVideo: StreamManagerVideo): void {
        this.videos.push(streamManagerVideo);
        this.addPlayEventToFirstVideo();

        if (!this.stream.session.streamManagers.includes(this)) {
            this.stream.session.streamManagers.push(this);
        }
    }

    private initializeVideoProperties(video: HTMLVideoElement): void {
        if (!(!this.remote && this.stream.displayMyRemote())) {
            const ms = this.stream.getMediaStream();
            if (ms && video.srcObject !== ms) {
                video.srcObject = ms;
            }
        }

        video.autoplay = true;
        video.controls = false;
        video.playsInline = true;

        if (!video.id) {
            video.id = (this.remote ? 'remote-' : 'local-') + 'video-' + this.stream.streamId;
        }

        if (this.remote && this.isMirroredVideo(video)) {
            this.removeMirrorVideo(video);
        } else if (!this.remote && !this.stream.displayMyRemote()) {
            video.muted = true;
            if (this.isMirroredVideo(video) && !this.stream.outboundStreamOpts?.publisherProperties.mirror) {
                this.removeMirrorVideo(video);
            } else if (this.stream.outboundStreamOpts?.publisherProperties.mirror && !this.stream.isSendScreen()) {
                this.mirrorVideo(video);
            }
        }
    }

    private addPlayEventToFirstVideo(): void {
        const first = this.videos[0];
        if (first?.video && !first.canplayListenerAdded) {
            first.video.addEventListener('canplay', this.canPlayListener);
            first.canplayListenerAdded = true;
        }
    }

    private isMirroredVideo(video: HTMLVideoElement): boolean {
        return video.style.transform === 'rotateY(180deg)' || video.style.webkitTransform === 'rotateY(180deg)';
    }

    private mirrorVideo(video: HTMLVideoElement): void {
        video.style.transform = 'rotateY(180deg)';
        video.style.webkitTransform = 'rotateY(180deg)';
    }

    private removeMirrorVideo(video: HTMLVideoElement): void {
        video.style.transform = 'unset';
        video.style.webkitTransform = 'unset';
    }
}
