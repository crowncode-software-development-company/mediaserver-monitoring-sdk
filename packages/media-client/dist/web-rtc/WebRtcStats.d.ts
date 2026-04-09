import { Stream } from "../Stream";
interface IWebrtcStats {
    inbound?: {
        [key: string]: any;
        audio: {
            bytesReceived: number;
            packetsReceived: number;
            packetsLost: number;
            jitter: number;
        } | {};
        video: {
            bytesReceived: number;
            packetsReceived: number;
            packetsLost: number;
            jitter?: number;
            jitterBufferDelay?: number;
            framesDecoded: number;
            firCount: number;
            nackCount: number;
            pliCount: number;
            frameHeight?: number;
            frameWidth?: number;
            framesDropped?: number;
            framesReceived?: number;
        } | {};
    };
    outbound?: {
        [key: string]: any;
        audio: {
            bytesSent: number;
            packetsSent: number;
        } | {};
        video: {
            bytesSent: number;
            packetsSent: number;
            firCount: number;
            framesEncoded: number;
            nackCount: number;
            pliCount: number;
            qpSum: number;
            frameHeight?: number;
            frameWidth?: number;
            framesSent?: number;
        } | {};
    };
    candidatepair?: {
        [key: string]: any;
        currentRoundTripTime?: number;
        availableOutgoingBitrate?: number;
    };
    [key: string]: any;
}
export declare class WebRtcStats {
    private stream;
    private readonly STATS_ITEM_NAME;
    private webRtcStatsEnabled;
    private webRtcStatsIntervalId;
    private statsInterval;
    private POST_URL;
    constructor(stream: Stream);
    isEnabled(): boolean;
    initWebRtcStats(): void;
    getSelectedIceCandidateInfo(): Promise<any>;
    stopWebRtcStats(): void;
    private sendStats;
    private sendStatsToHttpEndpoint;
    getCommonStats(): Promise<IWebrtcStats>;
    private generateJSONStatsResponse;
    private getWebRtcStatsResponseOutline;
}
export {};
