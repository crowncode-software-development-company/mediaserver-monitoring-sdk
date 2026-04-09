import { Logger } from './Logger';
import { Session } from './Session';
import { Connection } from './Connection';
import {
    InboundStreamOptions,
    OutboundStreamOptions,
    TypeOfVideo,
    VideoDimensions,
    StreamInternalEventMap,
} from './interfaces';
import { WebRtcStats } from './web-rtc/WebRtcStats';
import { WebRtcPeer, WebRtcPeerConfiguration, WebRtcPeerRecvonly } from './web-rtc/WebRtcPeer';
import { Subscriber } from './Subscriber';
import { TypedEventEmitter } from './utils/EventEmitter';
import { StreamManager } from './StreamManager';

const logger = Logger.getInstance();

/**
 * Stream — представление медиа-потока (исходящего).
 *
 * Инкапсулирует WebRTC peer connection, управляет SDP-рукопожатием
 * и предоставляет доступ к MediaStream.
 */
export class Stream {
    public session: Session;

    public streamId!: string;

    /** Подключение, которому принадлежит поток */
    public connection!: Connection;

    /** StreamManager, управляющий видео-привязками */
    public streamManager!: StreamManager;

    public creationTime!: number;

    public audioActive!: boolean;

    public videoActive!: boolean;

    public hasAudio!: boolean;

    public hasVideo!: boolean;

    public typeOfVideo?: TypeOfVideo;

    public frameRate?: number;

    public videoDimensions?: VideoDimensions;

    public inboundStreamOpts!: InboundStreamOptions;

    public outboundStreamOpts!: OutboundStreamOptions;

    public lastVideoTrackConstraints: MediaTrackConstraints | boolean | undefined;

    public localMediaStreamWhenSubscribedToRemote?: MediaStream;


    protected webRtcPeer!: WebRtcPeer;
    private _mediaStream?: MediaStream;
    private webRtcStats!: WebRtcStats;
    private isSubscribeToRemote = false;

    private readonly ee = new TypedEventEmitter<StreamInternalEventMap>();

    constructor(session: Session, options: InboundStreamOptions | OutboundStreamOptions | Record<string, never>) {
        this.session = session;

        if ('id' in options && typeof (options as InboundStreamOptions).id === 'string') {
            const inbound = options as InboundStreamOptions;
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
        } else if ('publisherProperties' in options) {
            const outbound = options as OutboundStreamOptions;
            this.outboundStreamOpts = outbound;

            this.hasAudio = this.isSendAudio();
            this.hasVideo = this.isSendVideo();

            if (this.hasAudio) {
                this.audioActive = !!outbound.publisherProperties.publishAudio;
            }
            if (this.hasVideo) {
                this.videoActive = !!outbound.publisherProperties.publishVideo;
                this.frameRate = outbound.publisherProperties.frameRate;
                if (
                    typeof MediaStreamTrack !== 'undefined' &&
                    outbound.publisherProperties.videoSource instanceof MediaStreamTrack
                ) {
                    this.typeOfVideo = TypeOfVideo.CUSTOM;
                } else {
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
    public subscribe(): Promise<boolean> {
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

    public getMediaStream(): MediaStream | undefined {
        return this._mediaStream;
    }

    public getWebRtcPeer(): WebRtcPeer {
        return this.webRtcPeer;
    }

    public getRTCPeerConnection(): RTCPeerConnection {
        return this.webRtcPeer.pc;
    }

    public getRemoteIceCandidateList(): RTCIceCandidate[] {
        return this.webRtcPeer.remoteCandidatesQueue;
    }

    public getLocalIceCandidateList(): RTCIceCandidate[] {
        return this.webRtcPeer.localCandidatesQueue;
    }

    public isLocal(): boolean {
        return !this.inboundStreamOpts && !!this.outboundStreamOpts;
    }

    public displayMyRemote(): boolean {
        return this.isSubscribeToRemote;
    }

    public subscribeToMyRemote(value: boolean): void {
        this.isSubscribeToRemote = value;
    }

    public isSendAudio(): boolean {
        return (
            !!this.outboundStreamOpts &&
            this.outboundStreamOpts.publisherProperties.audioSource !== null &&
            this.outboundStreamOpts.publisherProperties.audioSource !== false
        );
    }

    public isSendVideo(): boolean {
        return (
            !!this.outboundStreamOpts &&
            this.outboundStreamOpts.publisherProperties.videoSource !== null &&
            this.outboundStreamOpts.publisherProperties.videoSource !== false
        );
    }

    public isSendScreen(): boolean {
        if (!this.outboundStreamOpts) return false;

        let screen = false;
        if (
            typeof MediaStreamTrack !== 'undefined' &&
            this.outboundStreamOpts.publisherProperties.videoSource instanceof MediaStreamTrack
        ) {
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

    public async disposeMediaStream(): Promise<void> {
        if (this._mediaStream) {
            this._mediaStream.getTracks().forEach((track) => track.stop());
            this._mediaStream = undefined;
        }
        if (this.localMediaStreamWhenSubscribedToRemote) {
            this.localMediaStreamWhenSubscribedToRemote.getTracks().forEach((track) => track.stop());
            this.localMediaStreamWhenSubscribedToRemote = undefined;
        }
        logger.info(
            `${this.outboundStreamOpts ? 'Local' : 'Remote'} MediaStream from Stream [${this.streamId}] disposed`
        );
    }

    public disposeWebRtcPeer(): void {
        let webrtcId: string | undefined;
        if (this.webRtcPeer) {
            this.webRtcPeer.dispose();
            webrtcId = this.webRtcPeer.getId();
        }
        this.stopWebRtcStats();
        logger.info(
            `${this.outboundStreamOpts ? 'Outbound' : 'Inbound'} RTCPeerConnection [${webrtcId}] from Stream [${this.streamId}] closed`
        );
    }

    private initWebRtcPeerReceive(reconnect: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            logger.info(`[Stream] initWebRtcPeerReceive() for ${this.streamId}, reconnect=${reconnect}`);
            this.initWebRtcPeerReceiveFromClient(reconnect)
                .then(() => this.finalResolveForSubscription(reconnect, resolve))
                .catch((error) => this.finalRejectForSubscription(reconnect, error, reject));
        });
    }

    private initWebRtcPeerReceiveFromClient(reconnect: boolean): Promise<void> {
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
                        .catch((error: unknown) => reject(error));
                })
                .catch((error) => reject(error));
        });
    }

    private finalResolveForSubscription(
        reconnect: boolean,
        resolve: (value: void | PromiseLike<void>) => void
    ): void {
        logger.info(`'Subscriber' (${this.streamId}) successfully ${reconnect ? 'reconnected' : 'subscribed'}`);
        this.remotePeerSuccessfullyEstablished(reconnect);
        this.initWebRtcStats();
        resolve();
    }

    private finalRejectForSubscription(
        reconnect: boolean,
        error: unknown,
        reject: (reason?: unknown) => void
    ): void {
        logger.error(
            `Error for 'Subscriber' (${this.streamId}) while trying to ${reconnect ? 'reconnect' : 'subscribe'}: ${error}`
        );
        reject(error);
    }

    private remotePeerSuccessfullyEstablished(reconnect: boolean): void {
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
            const subscriber = this.streamManager as Subscriber;
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

    private updateMediaStreamInVideos(): void {
        this.ee.emit('mediastream-updated');
    }

    private completeWebRtcPeerReceive(
        reconnect: boolean,
        forciblyReconnect: boolean,
        sdpOfferByServer?: string
    ): Promise<{ sdpAnswer: string }> {
        return new Promise((resolve, reject) => {
            logger.info(`[Stream] completeWebRtcPeerReceive() called for ${this.streamId}`);

            const sendSdpToServer = async (sdpString: string): Promise<{ sdpAnswer: string }> => {
                logger.debug(
                    `Sending local SDP ${sdpOfferByServer ? 'answer' : 'offer'} to subscribe to ${this.streamId}`,
                    sdpString
                );

                const method = reconnect ? 'reconnectStream' : 'receiveVideoFrom';
                const params: Record<string, unknown> = {};
                params[reconnect ? 'stream' : 'sender'] = this.streamId;
                if (sdpOfferByServer) {
                    params[reconnect ? 'sdpString' : 'sdpAnswer'] = sdpString;
                } else {
                    params['sdpOffer'] = sdpString;
                }
                if (reconnect) {
                    params['forciblyReconnect'] = forciblyReconnect;
                }

                return await this.session.rpcClient.send(method, params);
            };

            const config: WebRtcPeerConfiguration = {
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
                typeOfVideo: this.typeOfVideo ? TypeOfVideo[this.typeOfVideo] as unknown as TypeOfVideo : undefined,
            };

            if (reconnect) {
                this.disposeWebRtcPeer();
            }

            this.webRtcPeer = new WebRtcPeerRecvonly(config);
            this.webRtcPeer.addIceConnectionStateChangeListener(this.streamId);

            if (sdpOfferByServer) {
                this.webRtcPeer
                    .processRemoteOffer(sdpOfferByServer)
                    .then(() =>
                        this.webRtcPeer
                            .createAnswer()
                            .then((sdpAnswer) =>
                                this.webRtcPeer
                                    .processLocalAnswer(sdpAnswer)
                                    .then(() =>
                                        sendSdpToServer(sdpAnswer.sdp!)
                                            .then((response) => resolve(response))
                                            .catch((error) =>
                                                reject(new Error('(subscribe) SDP server error: ' + JSON.stringify(error)))
                                            )
                                    )
                                    .catch((error) =>
                                        reject(new Error('(subscribe) SDP process local answer error: ' + JSON.stringify(error)))
                                    )
                            )
                            .catch((error) =>
                                reject(new Error('(subscribe) SDP create answer error: ' + JSON.stringify(error)))
                            )
                    )
                    .catch((error) =>
                        reject(new Error('(subscribe) SDP process remote offer error: ' + JSON.stringify(error)))
                    );
            } else {
                this.webRtcPeer
                    .createOffer()
                    .then((sdpOffer) =>
                        this.webRtcPeer
                            .processLocalOffer(sdpOffer)
                            .then(() =>
                                sendSdpToServer(sdpOffer.sdp!)
                                    .then((response) => resolve(response))
                                    .catch((error) =>
                                        reject(new Error('(subscribe) SDP server error: ' + JSON.stringify(error)))
                                    )
                            )
                            .catch((error) =>
                                reject(new Error('(subscribe) SDP process local offer error: ' + JSON.stringify(error)))
                            )
                    )
                    .catch((error) =>
                        reject(new Error('(subscribe) SDP create offer error: ' + JSON.stringify(error)))
                    );
            }
        });
    }

    private getIceServersConf(): RTCIceServer[] | undefined {
        if (this.session.mediaClient?.configuration?.rtcConfiguration?.iceServers) {
            return this.session.mediaClient.configuration.rtcConfiguration.iceServers as RTCIceServer[];
        }
        if (this.session.mediaClient?.iceServers?.length) {
            return this.session.mediaClient.iceServers;
        }
        return undefined;
    }

    private initWebRtcStats(): void {
        this.webRtcStats = new WebRtcStats(this);
        this.webRtcStats.initWebRtcStats();
    }

    private stopWebRtcStats(): void {
        if (this.webRtcStats?.isEnabled()) {
            this.webRtcStats.stopWebRtcStats();
        }
    }

    private onIceConnectionStateExceptionHandler(exceptionName: string, message: string, _data?: unknown): void {
        logger.error(`Exception in ${this.streamId}: ${exceptionName} - ${message}`);
    }
}