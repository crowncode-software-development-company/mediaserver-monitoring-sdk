import { Session } from './Session';
import { Connection } from './Connection';
import { InboundStreamOptions, OutboundStreamOptions, TypeOfVideo, VideoDimensions } from './interfaces';
import { WebRtcPeer } from './web-rtc/WebRtcPeer';
import { StreamManager } from './StreamManager';
/**
 * Stream — представление медиа-потока (исходящего).
 *
 * Инкапсулирует WebRTC peer connection, управляет SDP-рукопожатием
 * и предоставляет доступ к MediaStream.
 */
export declare class Stream {
    session: Session;
    streamId: string;
    /** Подключение, которому принадлежит поток */
    connection: Connection;
    /** StreamManager, управляющий видео-привязками */
    streamManager: StreamManager;
    creationTime: number;
    audioActive: boolean;
    videoActive: boolean;
    hasAudio: boolean;
    hasVideo: boolean;
    typeOfVideo?: TypeOfVideo;
    frameRate?: number;
    videoDimensions?: VideoDimensions;
    inboundStreamOpts: InboundStreamOptions;
    outboundStreamOpts: OutboundStreamOptions;
    lastVideoTrackConstraints: MediaTrackConstraints | boolean | undefined;
    localMediaStreamWhenSubscribedToRemote?: MediaStream;
    protected webRtcPeer: WebRtcPeer;
    private _mediaStream?;
    private webRtcStats;
    private isSubscribeToRemote;
    private readonly ee;
    constructor(session: Session, options: InboundStreamOptions | OutboundStreamOptions | Record<string, never>);
    /**
     * Инициировать WebRTC-рукопожатие. Подписаться на поток
     */
    subscribe(): Promise<boolean>;
    getMediaStream(): MediaStream | undefined;
    getWebRtcPeer(): WebRtcPeer;
    getRTCPeerConnection(): RTCPeerConnection;
    getRemoteIceCandidateList(): RTCIceCandidate[];
    getLocalIceCandidateList(): RTCIceCandidate[];
    isLocal(): boolean;
    displayMyRemote(): boolean;
    subscribeToMyRemote(value: boolean): void;
    isSendAudio(): boolean;
    isSendVideo(): boolean;
    isSendScreen(): boolean;
    disposeMediaStream(): Promise<void>;
    disposeWebRtcPeer(): void;
    private initWebRtcPeerReceive;
    private initWebRtcPeerReceiveFromClient;
    private finalResolveForSubscription;
    private finalRejectForSubscription;
    private remotePeerSuccessfullyEstablished;
    private updateMediaStreamInVideos;
    private completeWebRtcPeerReceive;
    private getIceServersConf;
    private initWebRtcStats;
    private stopWebRtcStats;
    private onIceConnectionStateExceptionHandler;
}
