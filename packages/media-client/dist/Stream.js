import { Logger } from './Logger';
import { TypeOfVideo, } from './interfaces';
import { WebRtcStats } from './web-rtc/WebRtcStats';
import { WebRtcPeerRecvonly } from './web-rtc/WebRtcPeer';
import { Subscriber } from './Subscriber';
import { TypedEventEmitter } from './utils/EventEmitter';
const logger = Logger.getInstance();
/**
 * Stream — представление медиа-потока (исходящего).
 *
 * Инкапсулирует WebRTC peer connection, управляет SDP-рукопожатием
 * и предоставляет доступ к MediaStream.
 */
export class Stream {
    session;
    streamId;
    /** Подключение, которому принадлежит поток */
    connection;
    /** StreamManager, управляющий видео-привязками */
    streamManager;
    creationTime;
    audioActive;
    videoActive;
    hasAudio;
    hasVideo;
    typeOfVideo;
    frameRate;
    videoDimensions;
    inboundStreamOpts;
    outboundStreamOpts;
    lastVideoTrackConstraints;
    localMediaStreamWhenSubscribedToRemote;
    webRtcPeer;
    _mediaStream;
    webRtcStats;
    isSubscribeToRemote = false;
    ee = new TypedEventEmitter();
    constructor(session, options) {
        this.session = session;
        if ('id' in options && typeof options.id === 'string') {
            const inbound = options;
            this.inboundStreamOpts = inbound;
            this.streamId = inbound.id;
            this.creationTime = inbound.createdAt;
            this.hasAudio = inbound.hasAudio;
            this.hasVideo = inbound.hasVideo;
            if (this.hasAudio) {
                this.audioActive = inbound.audioActive;
            }
            if (this.hasVideo) {
                this.videoActive = inbound.videoActive;
                this.typeOfVideo = inbound.typeOfVideo || undefined;
                this.frameRate = inbound.frameRate === -1 ? undefined : inbound.frameRate;
                this.videoDimensions = inbound.videoDimensions;
            }
        }
        else if ('publisherProperties' in options) {
            const outbound = options;
            this.outboundStreamOpts = outbound;
            this.hasAudio = this.isSendAudio();
            this.hasVideo = this.isSendVideo();
            if (this.hasAudio) {
                this.audioActive = !!outbound.publisherProperties.publishAudio;
            }
            if (this.hasVideo) {
                this.videoActive = !!outbound.publisherProperties.publishVideo;
                this.frameRate = outbound.publisherProperties.frameRate;
                if (typeof MediaStreamTrack !== 'undefined' &&
                    outbound.publisherProperties.videoSource instanceof MediaStreamTrack) {
                    this.typeOfVideo = TypeOfVideo.CUSTOM;
                }
                else {
                    this.typeOfVideo = this.isSendScreen() ? TypeOfVideo.SCREEN : TypeOfVideo.CAMERA;
                }
            }
        }
        this.ee.on('mediastream-updated', () => {
            if (this._mediaStream) {
                this.streamManager.updateMediaStream(this._mediaStream);
                logger.debug(`Video srcObject [${this._mediaStream.id}] updated in stream [${this.streamId}]`);
            }
        });
    }
    /**
     * Инициировать WebRTC-рукопожатие. Подписаться на поток
     */
    subscribe() {
        logger.info(`[Stream] subscribe() called for stream ${this.streamId}`);
        return new Promise((resolve, reject) => {
            this.initWebRtcPeerReceive(false)
                .then(() => {
                logger.info(`[Stream] subscribe() resolved for stream ${this.streamId}`);
                resolve(true);
            })
                .catch((error) => {
                logger.error(`[Stream] subscribe() rejected for stream ${this.streamId}: ${error}`);
                reject(error);
            });
        });
    }
    getMediaStream() {
        return this._mediaStream;
    }
    getWebRtcPeer() {
        return this.webRtcPeer;
    }
    getRTCPeerConnection() {
        return this.webRtcPeer.pc;
    }
    getRemoteIceCandidateList() {
        return this.webRtcPeer.remoteCandidatesQueue;
    }
    getLocalIceCandidateList() {
        return this.webRtcPeer.localCandidatesQueue;
    }
    isLocal() {
        return !this.inboundStreamOpts && !!this.outboundStreamOpts;
    }
    displayMyRemote() {
        return this.isSubscribeToRemote;
    }
    subscribeToMyRemote(value) {
        this.isSubscribeToRemote = value;
    }
    isSendAudio() {
        return (!!this.outboundStreamOpts &&
            this.outboundStreamOpts.publisherProperties.audioSource !== null &&
            this.outboundStreamOpts.publisherProperties.audioSource !== false);
    }
    isSendVideo() {
        return (!!this.outboundStreamOpts &&
            this.outboundStreamOpts.publisherProperties.videoSource !== null &&
            this.outboundStreamOpts.publisherProperties.videoSource !== false);
    }
    isSendScreen() {
        if (!this.outboundStreamOpts)
            return false;
        let screen = false;
        if (typeof MediaStreamTrack !== 'undefined' &&
            this.outboundStreamOpts.publisherProperties.videoSource instanceof MediaStreamTrack) {
            const trackSettings = this.outboundStreamOpts.publisherProperties.videoSource.getSettings();
            if (trackSettings.displaySurface) {
                screen = ['monitor', 'window', 'browser'].includes(trackSettings.displaySurface);
            }
        }
        if (!screen) {
            screen = this.outboundStreamOpts.publisherProperties.videoSource === 'screen';
        }
        return screen;
    }
    async disposeMediaStream() {
        if (this._mediaStream) {
            this._mediaStream.getTracks().forEach((track) => track.stop());
            this._mediaStream = undefined;
        }
        if (this.localMediaStreamWhenSubscribedToRemote) {
            this.localMediaStreamWhenSubscribedToRemote.getTracks().forEach((track) => track.stop());
            this.localMediaStreamWhenSubscribedToRemote = undefined;
        }
        logger.info(`${this.outboundStreamOpts ? 'Local' : 'Remote'} MediaStream from Stream [${this.streamId}] disposed`);
    }
    disposeWebRtcPeer() {
        let webrtcId;
        if (this.webRtcPeer) {
            this.webRtcPeer.dispose();
            webrtcId = this.webRtcPeer.getId();
        }
        this.stopWebRtcStats();
        logger.info(`${this.outboundStreamOpts ? 'Outbound' : 'Inbound'} RTCPeerConnection [${webrtcId}] from Stream [${this.streamId}] closed`);
    }
    initWebRtcPeerReceive(reconnect) {
        return new Promise((resolve, reject) => {
            logger.info(`[Stream] initWebRtcPeerReceive() for ${this.streamId}, reconnect=${reconnect}`);
            this.initWebRtcPeerReceiveFromClient(reconnect)
                .then(() => this.finalResolveForSubscription(reconnect, resolve))
                .catch((error) => this.finalRejectForSubscription(reconnect, error, reject));
        });
    }
    initWebRtcPeerReceiveFromClient(reconnect) {
        return new Promise((resolve, reject) => {
            logger.info(`[Stream] initWebRtcPeerReceiveFromClient() for ${this.streamId}`);
            this.completeWebRtcPeerReceive(reconnect, false)
                .then((response) => {
                logger.info(`[Stream] Got SDP answer from server for ${this.streamId}:`, response);
                this.webRtcPeer
                    .processRemoteAnswer(response.sdpAnswer)
                    .then(() => {
                    logger.info(`[Stream] Remote answer processed successfully for ${this.streamId}`);
                    resolve();
                })
                    .catch((error) => reject(error));
            })
                .catch((error) => reject(error));
        });
    }
    finalResolveForSubscription(reconnect, resolve) {
        logger.info(`'Subscriber' (${this.streamId}) successfully ${reconnect ? 'reconnected' : 'subscribed'}`);
        this.remotePeerSuccessfullyEstablished(reconnect);
        this.initWebRtcStats();
        resolve();
    }
    finalRejectForSubscription(reconnect, error, reject) {
        logger.error(`Error for 'Subscriber' (${this.streamId}) while trying to ${reconnect ? 'reconnect' : 'subscribe'}: ${error}`);
        reject(error);
    }
    remotePeerSuccessfullyEstablished(reconnect) {
        if (reconnect && this._mediaStream) {
            this.disposeMediaStream();
        }
        this._mediaStream = new MediaStream();
        for (const receiver of this.webRtcPeer.pc.getReceivers()) {
            if (receiver.track) {
                this._mediaStream.addTrack(receiver.track);
            }
        }
        logger.debug('Peer remote stream', this._mediaStream);
        if (this._mediaStream && this.streamManager instanceof Subscriber) {
            const subscriber = this.streamManager;
            const audioTrack = this._mediaStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = reconnect ? this.audioActive : !!subscriber.properties.subscribeToAudio;
            }
            const videoTrack = this._mediaStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = reconnect
                    ? this.videoActive
                    : !!this.videoActive && !!subscriber.properties.subscribeToVideo;
            }
        }
        this.updateMediaStreamInVideos();
    }
    updateMediaStreamInVideos() {
        this.ee.emit('mediastream-updated');
    }
    completeWebRtcPeerReceive(reconnect, forciblyReconnect, sdpOfferByServer) {
        return new Promise((resolve, reject) => {
            logger.info(`[Stream] completeWebRtcPeerReceive() called for ${this.streamId}`);
            const sendSdpToServer = async (sdpString) => {
                logger.debug(`Sending local SDP ${sdpOfferByServer ? 'answer' : 'offer'} to subscribe to ${this.streamId}`, sdpString);
                const method = reconnect ? 'reconnectStream' : 'receiveVideoFrom';
                const params = {};
                params[reconnect ? 'stream' : 'sender'] = this.streamId;
                if (sdpOfferByServer) {
                    params[reconnect ? 'sdpString' : 'sdpAnswer'] = sdpString;
                }
                else {
                    params['sdpOffer'] = sdpString;
                }
                if (reconnect) {
                    params['forciblyReconnect'] = forciblyReconnect;
                }
                return await this.session.rpcClient.send(method, params);
            };
            const config = {
                mediaConstraints: {
                    audio: this.hasAudio,
                    video: this.hasVideo,
                },
                simulcast: false,
                onIceCandidate: this.connection.sendIceCandidate.bind(this.connection),
                onIceConnectionStateException: this.onIceConnectionStateExceptionHandler.bind(this),
                iceServers: this.getIceServersConf(),
                rtcConfiguration: this.session.mediaClient?.configuration?.rtcConfiguration,
                mediaServer: this.session.mediaClient?.mediaServer ?? '',
                typeOfVideo: this.typeOfVideo ? TypeOfVideo[this.typeOfVideo] : undefined,
            };
            if (reconnect) {
                this.disposeWebRtcPeer();
            }
            this.webRtcPeer = new WebRtcPeerRecvonly(config);
            this.webRtcPeer.addIceConnectionStateChangeListener(this.streamId);
            if (sdpOfferByServer) {
                this.webRtcPeer
                    .processRemoteOffer(sdpOfferByServer)
                    .then(() => this.webRtcPeer
                    .createAnswer()
                    .then((sdpAnswer) => this.webRtcPeer
                    .processLocalAnswer(sdpAnswer)
                    .then(() => sendSdpToServer(sdpAnswer.sdp)
                    .then((response) => resolve(response))
                    .catch((error) => reject(new Error('(subscribe) SDP server error: ' + JSON.stringify(error)))))
                    .catch((error) => reject(new Error('(subscribe) SDP process local answer error: ' + JSON.stringify(error)))))
                    .catch((error) => reject(new Error('(subscribe) SDP create answer error: ' + JSON.stringify(error)))))
                    .catch((error) => reject(new Error('(subscribe) SDP process remote offer error: ' + JSON.stringify(error))));
            }
            else {
                this.webRtcPeer
                    .createOffer()
                    .then((sdpOffer) => this.webRtcPeer
                    .processLocalOffer(sdpOffer)
                    .then(() => sendSdpToServer(sdpOffer.sdp)
                    .then((response) => resolve(response))
                    .catch((error) => reject(new Error('(subscribe) SDP server error: ' + JSON.stringify(error)))))
                    .catch((error) => reject(new Error('(subscribe) SDP process local offer error: ' + JSON.stringify(error)))))
                    .catch((error) => reject(new Error('(subscribe) SDP create offer error: ' + JSON.stringify(error))));
            }
        });
    }
    getIceServersConf() {
        if (this.session.mediaClient?.configuration?.rtcConfiguration?.iceServers) {
            return this.session.mediaClient.configuration.rtcConfiguration.iceServers;
        }
        if (this.session.mediaClient?.iceServers?.length) {
            return this.session.mediaClient.iceServers;
        }
        return undefined;
    }
    initWebRtcStats() {
        this.webRtcStats = new WebRtcStats(this);
        this.webRtcStats.initWebRtcStats();
    }
    stopWebRtcStats() {
        if (this.webRtcStats?.isEnabled()) {
            this.webRtcStats.stopWebRtcStats();
        }
    }
    onIceConnectionStateExceptionHandler(exceptionName, message, _data) {
        logger.error(`Exception in ${this.streamId}: ${exceptionName} - ${message}`);
    }
}
