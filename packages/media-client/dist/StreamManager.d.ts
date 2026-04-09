import { Stream } from './Stream';
import { TypedEventEmitter } from './utils/EventEmitter';
import { StreamManagerEventMap, StreamManagerVideo } from './interfaces';
/**
 * Абстрактный базовый класс для управления видео-потоками.
 *
 * StreamManager связывает объект Stream с HTML video элементами
 * и эмитит события о состоянии воспроизведения.
 *
 * Наследники: Subscriber (и Publisher, если будет).
 */
export declare abstract class StreamManager extends TypedEventEmitter<StreamManagerEventMap> {
    readonly stream: Stream;
    videos: StreamManagerVideo[];
    readonly remote: boolean;
    private readonly canPlayListener;
    constructor(stream: Stream);
    /**
     * Привязать HTML video-элемент к этому потоку.
     *
     * Устанавливает srcObject, настраивает свойства видео,
     * и регистрирует обработчик воспроизведения.
     *
     * @returns 1 если элемент добавлен, 0 если уже был, -1 если был перенесён
     */
    addVideoElement(video: HTMLVideoElement): number;
    updateMediaStream(mediaStream: MediaStream): void;
    /**
     * Отвязать video-элемент от этого StreamManager.
     */
    disassociateVideo(video: HTMLVideoElement): boolean;
    protected pushNewStreamManagerVideo(streamManagerVideo: StreamManagerVideo): void;
    private initializeVideoProperties;
    private addPlayEventToFirstVideo;
    private isMirroredVideo;
    private mirrorVideo;
    private removeMirrorVideo;
}
