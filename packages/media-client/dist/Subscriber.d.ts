import { Stream } from './Stream';
import { StreamManager } from './StreamManager';
import { SubscriberProperties } from './interfaces';
/**
 * Subscriber — подписчик на удалённый поток.
 *
 * Наследует StreamManager, добавляя методы для управления
 * подпиской на аудио/видео треки.
 *
 * @example
 * const subscriber = session.subscribe(stream);
 * subscriber.addVideoElement(videoElement);
 * subscriber.subscribeToAudio(false); // отключить аудио
 */
export declare class Subscriber extends StreamManager {
    readonly properties: SubscriberProperties;
    constructor(stream: Stream, properties: SubscriberProperties);
    subscribeToAudio(value: boolean): this;
    subscribeToVideo(value: boolean): this;
    replaceTrackInMediaStream(track: MediaStreamTrack, updateLastConstraints: boolean): void;
}
