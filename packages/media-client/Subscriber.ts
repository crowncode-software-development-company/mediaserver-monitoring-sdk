import { Stream } from './Stream';
import { Logger } from './Logger';
import { StreamManager } from './StreamManager';
import { SubscriberProperties } from './interfaces';

const logger = Logger.getInstance();

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
export class Subscriber extends StreamManager {
    public readonly properties: SubscriberProperties;

    constructor(stream: Stream, properties: SubscriberProperties) {
        super(stream);
        this.properties = properties;
    }

    public subscribeToAudio(value: boolean): this {
        const mediaStream = this.stream.getMediaStream();
        if (mediaStream) {
            mediaStream.getAudioTracks().forEach((track) => {
                track.enabled = value;
            });
        }

        this.stream.audioActive = value;
        logger.info(`'Subscriber' has ${value ? 'subscribed to' : 'unsubscribed from'} its audio stream`);
        return this;
    }

    public subscribeToVideo(value: boolean): this {
        const mediaStream = this.stream.getMediaStream();
        if (mediaStream) {
            mediaStream.getVideoTracks().forEach((track) => {
                track.enabled = value;
            });
        }

        this.stream.videoActive = value;
        logger.info(`'Subscriber' has ${value ? 'subscribed to' : 'unsubscribed from'} its video stream`);
        return this;
    }

    public replaceTrackInMediaStream(track: MediaStreamTrack, updateLastConstraints: boolean): void {
        const mediaStream = this.stream.getMediaStream();
        if (!mediaStream) {
            logger.warn('Cannot replace track: MediaStream is not available');
            return;
        }

        let removedTrack: MediaStreamTrack;
        if (track.kind === 'video') {
            removedTrack = mediaStream.getVideoTracks()[0];
            if (updateLastConstraints) {
                this.stream.lastVideoTrackConstraints = track.getConstraints();
            }
        } else {
            removedTrack = mediaStream.getAudioTracks()[0];
        }

        if (removedTrack) {
            mediaStream.removeTrack(removedTrack);
            removedTrack.stop();
        }
        mediaStream.addTrack(track);
    }
}