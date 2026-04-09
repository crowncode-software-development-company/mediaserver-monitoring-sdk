import { Logger } from "../Logger";

import { Stream } from "../Stream";
import { PlatformUtils } from "../utils/platform";

const logger: Logger = Logger.getInstance();

interface WebrtcStatsConfig {
    interval: number;
    httpEndpoint: string;
}

interface JSONStatsResponse {
    '@timestamp': string;
    participant_id: string;
    session_id: string;
    platform: string;
    platform_description: string;
    stream: string;
    webrtc_stats: IWebrtcStats;
}

interface IWebrtcStats {
    inbound?: {
        [key: string]: any;
        audio:
        | {
            bytesReceived: number;
            packetsReceived: number;
            packetsLost: number;
            jitter: number;
        }
        | {};
        video:
        | {
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
        }
        | {};
    };
    outbound?: {
        [key: string]: any;
        audio:
        | {
            bytesSent: number;
            packetsSent: number;
        }
        | {};
        video:
        | {
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
        }
        | {};
    };
    candidatepair?: {
        [key: string]: any;
        currentRoundTripTime?: number;
        availableOutgoingBitrate?: number;
    };
    [key: string]: any;
}

export class WebRtcStats {
    private readonly STATS_ITEM_NAME = 'webrtc-stats-config';

    private webRtcStatsEnabled = false;
    private webRtcStatsIntervalId!: ReturnType<typeof setInterval>;
    private statsInterval = 1;
    private POST_URL!: string;

    constructor(private stream: Stream) {
    }

    public isEnabled(): boolean {
        return this.webRtcStatsEnabled;
    }

    public initWebRtcStats(): void {
        let webrtcObj;
        // When cross-site (aka third-party) cookies are blocked by the browser,
        // accessing localStorage in a third-party iframe throws a DOMException.
        try {
            webrtcObj = localStorage.getItem(this.STATS_ITEM_NAME);
        } catch (e) { }

        if (!!webrtcObj) {
            this.webRtcStatsEnabled = true;
            const webrtcStatsConfig: WebrtcStatsConfig = JSON.parse(webrtcObj);
            // webrtc object found in local storage
            logger.warn(
                'WebRtc stats enabled for stream ' + this.stream.streamId + ' of connection ' + this.stream.connection.connectionId
            );
            logger.warn('localStorage item: ' + JSON.stringify(webrtcStatsConfig));

            this.POST_URL = webrtcStatsConfig.httpEndpoint;
            this.statsInterval = webrtcStatsConfig.interval; // Interval in seconds

            this.webRtcStatsIntervalId = setInterval(async () => {
                await this.sendStatsToHttpEndpoint();
            }, this.statsInterval * 1000);
        } else {
            logger.debug('WebRtc stats not enabled');
        }
    }

    public getSelectedIceCandidateInfo(): Promise<any> {
        return new Promise(async (resolve, reject) => {
            const statsReport: any = await this.stream.getRTCPeerConnection().getStats();
            let transportStat: any;
            const candidatePairs: Map<string, any> = new Map();
            const localCandidates: Map<string, any> = new Map();
            const remoteCandidates: Map<string, any> = new Map();
            statsReport.forEach((stat: any) => {
                // TODO: check platform
                if (stat.type === 'transport') {
                    transportStat = stat;
                }
                switch (stat.type) {
                    case 'candidate-pair':
                        candidatePairs.set(stat.id, stat);
                        break;
                    case 'local-candidate':
                        localCandidates.set(stat.id, stat);
                        break;
                    case 'remote-candidate':
                        remoteCandidates.set(stat.id, stat);
                        break;
                }
            });
            let selectedCandidatePair;
            if (transportStat != null) {
                const selectedCandidatePairId = transportStat.selectedCandidatePairId;
                selectedCandidatePair = candidatePairs.get(selectedCandidatePairId);
            } else {
                // This is basically Firefox
                const length = candidatePairs.size;
                const iterator = candidatePairs.values();
                for (let i = 0; i < length; i++) {
                    const candidatePair = iterator.next().value;
                    if (candidatePair['selected']) {
                        selectedCandidatePair = candidatePair;
                        break;
                    }
                }
            }
            const localCandidateId = selectedCandidatePair.localCandidateId;
            const remoteCandidateId = selectedCandidatePair.remoteCandidateId;
            let finalLocalCandidate = localCandidates.get(localCandidateId);
            if (!!finalLocalCandidate) {
                const candList = this.stream.getLocalIceCandidateList();
                const cand = candList.filter((c: RTCIceCandidate) => {
                    return (
                        !!c.candidate &&
                        (c.candidate.indexOf(finalLocalCandidate.ip) >= 0 || c.candidate.indexOf(finalLocalCandidate.address) >= 0) &&
                        c.candidate.indexOf(finalLocalCandidate.port) >= 0
                    );
                });
                finalLocalCandidate.raw = [];
                for (let c of cand) {
                    finalLocalCandidate.raw.push(c.candidate);
                }
            } else {
                finalLocalCandidate = 'ERROR: No active local ICE candidate. Probably ICE-TCP is being used';
            }

            let finalRemoteCandidate = remoteCandidates.get(remoteCandidateId);
            if (!!finalRemoteCandidate) {
                const candList = this.stream.getRemoteIceCandidateList();
                const cand = candList.filter((c: RTCIceCandidate) => {
                    return (
                        !!c.candidate &&
                        (c.candidate.indexOf(finalRemoteCandidate.ip) >= 0 || c.candidate.indexOf(finalRemoteCandidate.address) >= 0) &&
                        c.candidate.indexOf(finalRemoteCandidate.port) >= 0
                    );
                });
                finalRemoteCandidate.raw = [];
                for (let c of cand) {
                    finalRemoteCandidate.raw.push(c.candidate);
                }
            } else {
                finalRemoteCandidate = 'ERROR: No active remote ICE candidate. Probably ICE-TCP is being used';
            }

            return resolve({
                localCandidate: finalLocalCandidate,
                remoteCandidate: finalRemoteCandidate
            });
        });
    }

    public stopWebRtcStats() {
        if (this.webRtcStatsEnabled) {
            clearInterval(this.webRtcStatsIntervalId);
            logger.warn(
                'WebRtc stats stopped for disposed stream ' + this.stream.streamId + ' of connection ' + this.stream.connection.connectionId
            );
        }
    }

    private async sendStats(url: string, response: JSONStatsResponse): Promise<void> {
        try {
            const configuration: RequestInit = {
                headers: {
                    'Content-type': 'application/json'
                },
                body: JSON.stringify(response),
                method: 'POST'
            };
            await fetch(url, configuration);
        } catch (error) {
            logger.error(`sendStats error: ${JSON.stringify(error)}`);
        }
    }

    private async sendStatsToHttpEndpoint(): Promise<void> {
        try {
            const webrtcStats: IWebrtcStats = await this.getCommonStats();
            const response = this.generateJSONStatsResponse(webrtcStats);
            await this.sendStats(this.POST_URL, response);
        } catch (error) {
            logger.log(error);
        }
    }
    public async getCommonStats(): Promise<IWebrtcStats> {
        return new Promise(async (resolve, reject) => {
            try {
                const statsReport: any = await this.stream.getRTCPeerConnection().getStats();
                const response: IWebrtcStats = this.getWebRtcStatsResponseOutline();
                const videoTrackStats = ['framesReceived', 'framesDropped', 'framesSent', 'frameHeight', 'frameWidth'];
                const candidatePairStats = ['availableOutgoingBitrate', 'currentRoundTripTime'];

                statsReport.forEach((stat: any) => {
                    let mediaType = stat.mediaType != null ? stat.mediaType : stat.kind;
                    const addStat = (direction: string, key: string): void => {
                        if (stat[key] != null && response[direction] != null) {
                            if (!mediaType && videoTrackStats.indexOf(key) > -1) {
                                mediaType = 'video';
                            }
                            if (direction != null && mediaType != null && key != null && response[direction][mediaType] != null) {
                                response[direction][mediaType][key] = Number(stat[key]);
                            } else if (direction != null && key != null && candidatePairStats.includes(key)) {
                                // candidate-pair-stats
                                response[direction][key] = Number(stat[key]);
                            }
                        }
                    };

                    switch (stat.type) {
                        case 'outbound-rtp':
                            addStat('outbound', 'bytesSent');
                            addStat('outbound', 'packetsSent');
                            addStat('outbound', 'framesEncoded');
                            addStat('outbound', 'nackCount');
                            addStat('outbound', 'firCount');
                            addStat('outbound', 'pliCount');
                            addStat('outbound', 'qpSum');
                            break;
                        case 'inbound-rtp':
                            addStat('inbound', 'bytesReceived');
                            addStat('inbound', 'packetsReceived');
                            addStat('inbound', 'packetsLost');
                            addStat('inbound', 'jitter');
                            addStat('inbound', 'framesDecoded');
                            addStat('inbound', 'nackCount');
                            addStat('inbound', 'firCount');
                            addStat('inbound', 'pliCount');
                            break;
                        case 'track':
                            addStat('inbound', 'jitterBufferDelay');
                            addStat('inbound', 'framesReceived');
                            addStat('outbound', 'framesDropped');
                            addStat('outbound', 'framesSent');
                            addStat(this.stream.isLocal() ? 'outbound' : 'inbound', 'frameHeight');
                            addStat(this.stream.isLocal() ? 'outbound' : 'inbound', 'frameWidth');
                            break;
                        case 'candidate-pair':
                            addStat('candidatepair', 'currentRoundTripTime');
                            addStat('candidatepair', 'availableOutgoingBitrate');
                            break;
                    }
                });

                // Delete candidatepair from response if null
                if (!response?.candidatepair || Object.keys(<Object>response.candidatepair).length === 0) {
                    delete response.candidatepair;
                }

                return resolve(response);
            } catch (error) {
                logger.error('Error getting common stats: ', error);
                return reject(error);
            }
        });
    }

    private generateJSONStatsResponse(stats: IWebrtcStats): JSONStatsResponse {
        return {
            '@timestamp': new Date().toISOString(),
            participant_id: this.stream.connection.data,
            session_id: this.stream.session.sessionId,
            platform: PlatformUtils.getName(),
            platform_description: PlatformUtils.getDescription(),
            stream: 'webRTC',
            webrtc_stats: stats
        };
    }

    private getWebRtcStatsResponseOutline(): IWebrtcStats {
        if (this.stream.isLocal()) {
            return {
                outbound: {
                    audio: {},
                    video: {}
                },
                candidatepair: {}
            };
        } else {
            return {
                inbound: {
                    audio: {},
                    video: {}
                }
            };
        }
    }
}
