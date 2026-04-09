import { Logger } from "../Logger";
import { PlatformUtils } from "../utils/platform";
const logger = Logger.getInstance();
export class WebRtcStats {
    stream;
    STATS_ITEM_NAME = 'webrtc-stats-config';
    webRtcStatsEnabled = false;
    webRtcStatsIntervalId;
    statsInterval = 1;
    POST_URL;
    constructor(stream) {
        this.stream = stream;
    }
    isEnabled() {
        return this.webRtcStatsEnabled;
    }
    initWebRtcStats() {
        let webrtcObj;
        // When cross-site (aka third-party) cookies are blocked by the browser,
        // accessing localStorage in a third-party iframe throws a DOMException.
        try {
            webrtcObj = localStorage.getItem(this.STATS_ITEM_NAME);
        }
        catch (e) { }
        if (!!webrtcObj) {
            this.webRtcStatsEnabled = true;
            const webrtcStatsConfig = JSON.parse(webrtcObj);
            // webrtc object found in local storage
            logger.warn('WebRtc stats enabled for stream ' + this.stream.streamId + ' of connection ' + this.stream.connection.connectionId);
            logger.warn('localStorage item: ' + JSON.stringify(webrtcStatsConfig));
            this.POST_URL = webrtcStatsConfig.httpEndpoint;
            this.statsInterval = webrtcStatsConfig.interval; // Interval in seconds
            this.webRtcStatsIntervalId = setInterval(async () => {
                await this.sendStatsToHttpEndpoint();
            }, this.statsInterval * 1000);
        }
        else {
            logger.debug('WebRtc stats not enabled');
        }
    }
    getSelectedIceCandidateInfo() {
        return new Promise(async (resolve, reject) => {
            const statsReport = await this.stream.getRTCPeerConnection().getStats();
            let transportStat;
            const candidatePairs = new Map();
            const localCandidates = new Map();
            const remoteCandidates = new Map();
            statsReport.forEach((stat) => {
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
            }
            else {
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
                const cand = candList.filter((c) => {
                    return (!!c.candidate &&
                        (c.candidate.indexOf(finalLocalCandidate.ip) >= 0 || c.candidate.indexOf(finalLocalCandidate.address) >= 0) &&
                        c.candidate.indexOf(finalLocalCandidate.port) >= 0);
                });
                finalLocalCandidate.raw = [];
                for (let c of cand) {
                    finalLocalCandidate.raw.push(c.candidate);
                }
            }
            else {
                finalLocalCandidate = 'ERROR: No active local ICE candidate. Probably ICE-TCP is being used';
            }
            let finalRemoteCandidate = remoteCandidates.get(remoteCandidateId);
            if (!!finalRemoteCandidate) {
                const candList = this.stream.getRemoteIceCandidateList();
                const cand = candList.filter((c) => {
                    return (!!c.candidate &&
                        (c.candidate.indexOf(finalRemoteCandidate.ip) >= 0 || c.candidate.indexOf(finalRemoteCandidate.address) >= 0) &&
                        c.candidate.indexOf(finalRemoteCandidate.port) >= 0);
                });
                finalRemoteCandidate.raw = [];
                for (let c of cand) {
                    finalRemoteCandidate.raw.push(c.candidate);
                }
            }
            else {
                finalRemoteCandidate = 'ERROR: No active remote ICE candidate. Probably ICE-TCP is being used';
            }
            return resolve({
                localCandidate: finalLocalCandidate,
                remoteCandidate: finalRemoteCandidate
            });
        });
    }
    stopWebRtcStats() {
        if (this.webRtcStatsEnabled) {
            clearInterval(this.webRtcStatsIntervalId);
            logger.warn('WebRtc stats stopped for disposed stream ' + this.stream.streamId + ' of connection ' + this.stream.connection.connectionId);
        }
    }
    async sendStats(url, response) {
        try {
            const configuration = {
                headers: {
                    'Content-type': 'application/json'
                },
                body: JSON.stringify(response),
                method: 'POST'
            };
            await fetch(url, configuration);
        }
        catch (error) {
            logger.error(`sendStats error: ${JSON.stringify(error)}`);
        }
    }
    async sendStatsToHttpEndpoint() {
        try {
            const webrtcStats = await this.getCommonStats();
            const response = this.generateJSONStatsResponse(webrtcStats);
            await this.sendStats(this.POST_URL, response);
        }
        catch (error) {
            logger.log(error);
        }
    }
    async getCommonStats() {
        return new Promise(async (resolve, reject) => {
            try {
                const statsReport = await this.stream.getRTCPeerConnection().getStats();
                const response = this.getWebRtcStatsResponseOutline();
                const videoTrackStats = ['framesReceived', 'framesDropped', 'framesSent', 'frameHeight', 'frameWidth'];
                const candidatePairStats = ['availableOutgoingBitrate', 'currentRoundTripTime'];
                statsReport.forEach((stat) => {
                    let mediaType = stat.mediaType != null ? stat.mediaType : stat.kind;
                    const addStat = (direction, key) => {
                        if (stat[key] != null && response[direction] != null) {
                            if (!mediaType && videoTrackStats.indexOf(key) > -1) {
                                mediaType = 'video';
                            }
                            if (direction != null && mediaType != null && key != null && response[direction][mediaType] != null) {
                                response[direction][mediaType][key] = Number(stat[key]);
                            }
                            else if (direction != null && key != null && candidatePairStats.includes(key)) {
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
                if (!response?.candidatepair || Object.keys(response.candidatepair).length === 0) {
                    delete response.candidatepair;
                }
                return resolve(response);
            }
            catch (error) {
                logger.error('Error getting common stats: ', error);
                return reject(error);
            }
        });
    }
    generateJSONStatsResponse(stats) {
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
    getWebRtcStatsResponseOutline() {
        if (this.stream.isLocal()) {
            return {
                outbound: {
                    audio: {},
                    video: {}
                },
                candidatepair: {}
            };
        }
        else {
            return {
                inbound: {
                    audio: {},
                    video: {}
                }
            };
        }
    }
}
