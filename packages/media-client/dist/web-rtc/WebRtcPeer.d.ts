import { TypeOfVideo } from '../interfaces';
export declare enum ExceptionEventName {
    ICE_CANDIDATE_ERROR = "ICE_CANDIDATE_ERROR",
    ICE_CONNECTION_FAILED = "ICE_CONNECTION_FAILED",
    ICE_CONNECTION_DISCONNECTED = "ICE_CONNECTION_DISCONNECTED",
    NO_STREAM_PLAYING_EVENT = "NO_STREAM_PLAYING_EVENT"
}
export interface WebRtcPeerConfiguration {
    mediaConstraints: {
        audio: boolean;
        video: boolean;
    };
    simulcast: boolean;
    mediaServer: string;
    onIceCandidate: (event: RTCIceCandidate) => void;
    onIceConnectionStateException: (exceptionName: ExceptionEventName, message: string, data?: any) => void;
    iceServers?: RTCIceServer[];
    rtcConfiguration?: RTCConfiguration;
    mediaStream?: MediaStream | null;
    mode?: 'sendonly' | 'recvonly' | 'sendrecv';
    id?: string;
    typeOfVideo: TypeOfVideo | undefined;
}
export declare class WebRtcPeer {
    pc: RTCPeerConnection;
    remoteCandidatesQueue: RTCIceCandidate[];
    localCandidatesQueue: RTCIceCandidate[];
    protected configuration: Required<WebRtcPeerConfiguration>;
    private iceCandidateList;
    constructor(configuration: WebRtcPeerConfiguration);
    getId(): string;
    dispose(): void;
    createOffer(): Promise<RTCSessionDescriptionInit>;
    deprecatedPeerConnectionTrackApi(): void;
    /**
     * Creates an SDP answer from the local RTCPeerConnection to send to the other peer
     * Only if the negotiation was initiated by the other peer
     */
    createAnswer(): Promise<RTCSessionDescriptionInit>;
    /**
     * This peer initiated negotiation. Step 1/4 of SDP offer-answer protocol
     */
    processLocalOffer(offer: RTCSessionDescriptionInit): Promise<void>;
    /**
     * Other peer initiated negotiation. Step 2/4 of SDP offer-answer protocol
     */
    processRemoteOffer(sdpOffer: string): Promise<void>;
    processLocalAnswer(answer: RTCSessionDescriptionInit): Promise<void>;
    processRemoteAnswer(sdpAnswer: string): Promise<void>;
    /**
     * @hidden
     */
    setRemoteDescription(sdp: RTCSessionDescriptionInit): Promise<void>;
    /**
     * Callback function invoked when an ICE candidate is received
     */
    addIceCandidate(iceCandidate: RTCIceCandidate): Promise<void>;
    addIceConnectionStateChangeListener(otherId: string): void;
    /**
     * @hidden
     */
    generateUniqueId(): string;
}
export declare class WebRtcPeerRecvonly extends WebRtcPeer {
    constructor(configuration: WebRtcPeerConfiguration);
}
export declare class WebRtcPeerSendonly extends WebRtcPeer {
    constructor(configuration: WebRtcPeerConfiguration);
}
export declare class WebRtcPeerSendrecv extends WebRtcPeer {
    constructor(configuration: WebRtcPeerConfiguration);
}
