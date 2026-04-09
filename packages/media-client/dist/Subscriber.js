import { Logger } from './Logger';
import { StreamManager } from './StreamManager';
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
    properties;
    constructor(stream, properties) {
        super(stream);
        this.properties = properties;
    }
    subscribeToAudio(value) {
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
    subscribeToVideo(value) {
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
    replaceTrackInMediaStream(track, updateLastConstraints) {
        const mediaStream = this.stream.getMediaStream();
        if (!mediaStream) {
            logger.warn('Cannot replace track: MediaStream is not available');
            return;
        }
        let removedTrack;
        if (track.kind === 'video') {
            removedTrack = mediaStream.getVideoTracks()[0];
            if (updateLastConstraints) {
                this.stream.lastVideoTrackConstraints = track.getConstraints();
            }
        }
        else {
            removedTrack = mediaStream.getAudioTracks()[0];
        }
        if (removedTrack) {
            mediaStream.removeTrack(removedTrack);
            removedTrack.stop();
        }
        mediaStream.addTrack(track);
    }
}
