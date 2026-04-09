import { Logger } from '../Logger';
import { v4 as uuid } from 'uuid';
const logger = Logger.getInstance();
export var ExceptionEventName;
(function (ExceptionEventName) {
    ExceptionEventName["ICE_CANDIDATE_ERROR"] = "ICE_CANDIDATE_ERROR";
    ExceptionEventName["ICE_CONNECTION_FAILED"] = "ICE_CONNECTION_FAILED";
    ExceptionEventName["ICE_CONNECTION_DISCONNECTED"] = "ICE_CONNECTION_DISCONNECTED";
    ExceptionEventName["NO_STREAM_PLAYING_EVENT"] = "NO_STREAM_PLAYING_EVENT";
})(ExceptionEventName || (ExceptionEventName = {}));
const DEFAULT_ICE_SERVERS = [
    {
        urls: 'stun:stun.l.google.com:19302'
    }
];
export class WebRtcPeer {
    pc;
    remoteCandidatesQueue = [];
    localCandidatesQueue = [];
    // Same as WebRtcPeerConfiguration but without optional fields.
    configuration;
    iceCandidateList = [];
    constructor(configuration) {
        this.configuration = {
            ...configuration,
            iceServers: !!configuration.iceServers && configuration.iceServers.length > 0 ? configuration.iceServers : DEFAULT_ICE_SERVERS,
            rtcConfiguration: configuration.rtcConfiguration !== undefined ? configuration.rtcConfiguration : {},
            mediaStream: configuration.mediaStream !== undefined ? configuration.mediaStream : null,
            mode: !!configuration.mode ? configuration.mode : 'sendrecv',
            id: !!configuration.id ? configuration.id : this.generateUniqueId()
        };
        // prettier-ignore
        logger.debug(`[WebRtcPeer] configuration:\n${JSON.stringify(this.configuration, null, 2)}`);
        let rtcConfiguration = this.configuration.rtcConfiguration
            ? this.configuration.rtcConfiguration
            : { iceServers: this.configuration.iceServers };
        if (!rtcConfiguration.iceServers && this.configuration.iceServers) {
            rtcConfiguration.iceServers = this.configuration.iceServers;
        }
        this.pc = new RTCPeerConnection(rtcConfiguration);
        this.pc.addEventListener('icecandidate', (event) => {
            if (event.candidate !== null) {
                const candidateInit = event.candidate;
                const iceCandidate = new RTCIceCandidate(candidateInit);
                this.configuration.onIceCandidate(iceCandidate);
                if (iceCandidate.candidate !== '') {
                    this.localCandidatesQueue.push(iceCandidate);
                }
            }
        });
        this.pc.addEventListener('signalingstatechange', async () => {
            if (this.pc.signalingState === 'stable') {
                while (this.iceCandidateList.length > 0) {
                    let candidate = this.iceCandidateList.shift();
                    try {
                        await this.pc.addIceCandidate(candidate);
                    }
                    catch (error) {
                        logger.error('Error when calling RTCPeerConnection#addIceCandidate for RTCPeerConnection ' + this.getId(), error);
                    }
                }
            }
        });
    }
    getId() {
        return this.configuration.id;
    }
    dispose() {
        logger.debug('Disposing WebRtcPeer');
        if (this.pc) {
            if (this.pc.signalingState === 'closed') {
                return;
            }
            this.pc.close();
            this.remoteCandidatesQueue = [];
            this.localCandidatesQueue = [];
        }
    }
    async createOffer() {
        if (this.configuration.mode !== 'recvonly') {
            if (!this.configuration.mediaStream) {
                throw new Error(`[WebRtcPeer.createOffer] Direction is '${this.configuration.mode}', but no stream was configured to be sent`);
            }
            for (const track of this.configuration.mediaStream.getTracks()) {
                const tcInit = {
                    direction: this.configuration.mode,
                    streams: [this.configuration.mediaStream]
                };
                if (track.kind === 'video' && this.configuration.simulcast) {
                    // Check if the requested size is enough to ask for 3 layers.
                    const trackSettings = track.getSettings();
                    const trackConsts = track.getConstraints();
                    const trackWidth = trackSettings.width ?? trackConsts.width.ideal ?? trackConsts.width ?? 0;
                    const trackHeight = trackSettings.height ?? trackConsts.height.ideal ?? trackConsts.height ?? 0;
                    logger.info(`[createOffer] Video track dimensions: ${trackWidth}x${trackHeight}`);
                    const trackPixels = trackWidth * trackHeight;
                    let maxLayers = 0;
                    if (trackPixels >= 960 * 540) {
                        maxLayers = 3;
                    }
                    else if (trackPixels >= 480 * 270) {
                        maxLayers = 2;
                    }
                    else {
                        maxLayers = 1;
                    }
                    tcInit.sendEncodings = [];
                    for (let l = 0; l < maxLayers; l++) {
                        const layerDiv = 2 ** (maxLayers - l - 1);
                        const encoding = {
                            rid: 'rdiv' + layerDiv.toString(),
                            // @ts-ignore -- Property missing from DOM types.
                            scalabilityMode: 'L1T1'
                        };
                        if (['detail', 'text'].includes(track.contentHint)) {
                            // Prioritize best resolution, for maximum picture detail.
                            encoding.scaleResolutionDownBy = 1.0;
                            // @ts-ignore -- Property missing from DOM types.
                            encoding.maxFramerate = Math.floor(30 / layerDiv);
                        }
                        else {
                            encoding.scaleResolutionDownBy = layerDiv;
                        }
                        tcInit.sendEncodings.push(encoding);
                    }
                }
                const tc = this.pc.addTransceiver(track, tcInit);
                if (track.kind === 'video') {
                    let sendParams = tc.sender.getParameters();
                    let needSetParams = false;
                    if (!sendParams.degradationPreference?.length) {
                        if (['detail', 'text'].includes(track.contentHint)) {
                            sendParams.degradationPreference = 'maintain-resolution';
                        }
                        else {
                            sendParams.degradationPreference = 'balanced';
                        }
                        logger.info(`[createOffer] Video sender Degradation Preference set: ${sendParams.degradationPreference}`);
                        needSetParams = true;
                    }
                    if (this.configuration.simulcast) {
                        if (sendParams.encodings?.length !== tcInit.sendEncodings.length) {
                            sendParams.encodings = tcInit.sendEncodings;
                            needSetParams = true;
                        }
                    }
                    if (needSetParams) {
                        logger.debug(`[createOffer] Setting new RTCRtpSendParameters to video sender`);
                        try {
                            await tc.sender.setParameters(sendParams);
                        }
                        catch (error) {
                            let message = `[WebRtcPeer.createOffer] Cannot set RTCRtpSendParameters to video sender`;
                            if (error instanceof Error) {
                                message += `: ${error.message}`;
                            }
                            throw new Error(message);
                        }
                    }
                }
            }
        }
        else {
            for (const kind of ['audio', 'video']) {
                if (!this.configuration.mediaConstraints[kind]) {
                    continue;
                }
                this.configuration.mediaStream = new MediaStream();
                this.pc.addTransceiver(kind, {
                    direction: this.configuration.mode,
                    streams: [this.configuration.mediaStream]
                });
            }
        }
        let sdpOffer;
        try {
            sdpOffer = await this.pc.createOffer();
        }
        catch (error) {
            let message = `[WebRtcPeer.createOffer] Browser failed creating an SDP Offer`;
            if (error instanceof Error) {
                message += `: ${error.message}`;
            }
            throw new Error(message);
        }
        return sdpOffer;
    }
    deprecatedPeerConnectionTrackApi() {
        for (const track of this.configuration.mediaStream.getTracks()) {
            this.pc.addTrack(track, this.configuration.mediaStream);
        }
    }
    /**
     * Creates an SDP answer from the local RTCPeerConnection to send to the other peer
     * Only if the negotiation was initiated by the other peer
     */
    createAnswer() {
        return new Promise((resolve, reject) => {
            // TODO: Delete this conditional when all supported browsers are
            // modern enough to implement the Transceiver methods.
            if ('getTransceivers' in this.pc) {
                logger.debug('[createAnswer] Method RTCPeerConnection.getTransceivers() is available; using it');
                // Ensure that the PeerConnection already contains one Transceiver
                // for each kind of media.
                // The Transceivers should have been already created internally by
                // the PC itself, when `pc.setRemoteDescription(sdpOffer)` was called.
                for (const kind of ['audio', 'video']) {
                    // Check if the media kind should be used.
                    if (!this.configuration.mediaConstraints[kind]) {
                        continue;
                    }
                    let tc = this.pc.getTransceivers().find((tc) => tc.receiver.track.kind === kind);
                    if (tc) {
                        // Enforce our desired direction.
                        tc.direction = this.configuration.mode;
                    }
                    else {
                        return reject(new Error(`${kind} requested, but no transceiver was created from remote description`));
                    }
                }
                this.pc
                    .createAnswer()
                    .then((sdpAnswer) => resolve(sdpAnswer))
                    .catch((error) => reject(error));
            }
            else {
                // TODO: Delete else branch when all supported browsers are
                // modern enough to implement the Transceiver methods
                let offerAudio, offerVideo = true;
                if (!!this.configuration.mediaConstraints) {
                    offerAudio =
                        typeof this.configuration.mediaConstraints.audio === 'boolean' ? this.configuration.mediaConstraints.audio : true;
                    offerVideo =
                        typeof this.configuration.mediaConstraints.video === 'boolean' ? this.configuration.mediaConstraints.video : true;
                    const constraints = {
                        offerToReceiveAudio: offerAudio,
                        offerToReceiveVideo: offerVideo
                    };
                    this.pc
                        .createAnswer(constraints)
                        .then((sdpAnswer) => resolve(sdpAnswer))
                        .catch((error) => reject(error));
                }
            }
            // else, there is nothing to do; the legacy createAnswer() options do
            // not offer any control over which tracks are included in the answer.
        });
    }
    /**
     * This peer initiated negotiation. Step 1/4 of SDP offer-answer protocol
     */
    processLocalOffer(offer) {
        return new Promise((resolve, reject) => {
            this.pc
                .setLocalDescription(offer)
                .then(() => {
                const localDescription = this.pc.localDescription;
                if (!!localDescription) {
                    logger.debug('Local description set', localDescription.sdp);
                    return resolve();
                }
                else {
                    return reject('Local description is not defined');
                }
            })
                .catch((error) => reject(error));
        });
    }
    /**
     * Other peer initiated negotiation. Step 2/4 of SDP offer-answer protocol
     */
    processRemoteOffer(sdpOffer) {
        return new Promise((resolve, reject) => {
            const offer = {
                type: 'offer',
                sdp: sdpOffer
            };
            logger.debug('SDP offer received, setting remote description', offer);
            if (this.pc.signalingState === 'closed') {
                return reject('RTCPeerConnection is closed when trying to set remote description');
            }
            this.setRemoteDescription(offer)
                .then(() => resolve())
                .catch((error) => reject(error));
        });
    }
    processLocalAnswer(answer) {
        return new Promise((resolve, reject) => {
            logger.debug('SDP answer created, setting local description');
            if (this.pc.signalingState === 'closed') {
                return reject('RTCPeerConnection is closed when trying to set local description');
            }
            this.pc
                .setLocalDescription(answer)
                .then(() => resolve())
                .catch((error) => reject(error));
        });
    }
    processRemoteAnswer(sdpAnswer) {
        return new Promise((resolve, reject) => {
            const answer = {
                type: 'answer',
                sdp: sdpAnswer
            };
            logger.debug('SDP answer received, setting remote description');
            if (this.pc.signalingState === 'closed') {
                return reject('RTCPeerConnection is closed when trying to set remote description');
            }
            this.setRemoteDescription(answer)
                .then(() => resolve())
                .catch((error) => reject(error));
        });
    }
    /**
     * @hidden
     */
    async setRemoteDescription(sdp) {
        return this.pc.setRemoteDescription(sdp);
    }
    /**
     * Callback function invoked when an ICE candidate is received
     */
    addIceCandidate(iceCandidate) {
        return new Promise((resolve, reject) => {
            logger.debug('Remote ICE candidate received', iceCandidate);
            this.remoteCandidatesQueue.push(iceCandidate);
            switch (this.pc.signalingState) {
                case 'closed':
                    reject(new Error('PeerConnection object is closed'));
                    break;
                case 'stable':
                    logger.debug('Signaling state is stable');
                    if (!!this.pc.remoteDescription) {
                        logger.debug('Remote description is defined');
                        this.pc
                            .addIceCandidate(iceCandidate)
                            .then(() => resolve())
                            .catch((error) => reject(error));
                    }
                    else {
                        logger.debug('Remote description is not defined');
                        this.iceCandidateList.push(iceCandidate);
                        resolve();
                    }
                    break;
                default:
                    this.iceCandidateList.push(iceCandidate);
                    resolve();
            }
        });
    }
    addIceConnectionStateChangeListener(otherId) {
        this.pc.addEventListener('iceconnectionstatechange', () => {
            const iceConnectionState = this.pc.iceConnectionState;
            switch (iceConnectionState) {
                case 'disconnected':
                    // Possible network disconnection
                    const msg1 = 'IceConnectionState of RTCPeerConnection ' +
                        this.configuration.id +
                        ' (' +
                        otherId +
                        ') change to "disconnected". Possible network disconnection';
                    logger.warn(msg1);
                    this.configuration.onIceConnectionStateException(ExceptionEventName.ICE_CONNECTION_DISCONNECTED, msg1);
                    break;
                case 'failed':
                    const msg2 = 'IceConnectionState of RTCPeerConnection ' + this.configuration.id + ' (' + otherId + ') to "failed"';
                    logger.error(msg2);
                    this.configuration.onIceConnectionStateException(ExceptionEventName.ICE_CONNECTION_FAILED, msg2);
                    break;
                case 'closed':
                    logger.log('IceConnectionState of RTCPeerConnection ' + this.configuration.id + ' (' + otherId + ') change to "closed"');
                    break;
                case 'new':
                    logger.log('IceConnectionState of RTCPeerConnection ' + this.configuration.id + ' (' + otherId + ') change to "new"');
                    break;
                case 'checking':
                    logger.log('IceConnectionState of RTCPeerConnection ' + this.configuration.id + ' (' + otherId + ') change to "checking"');
                    break;
                case 'connected':
                    logger.log('IceConnectionState of RTCPeerConnection ' + this.configuration.id + ' (' + otherId + ') change to "connected"');
                    break;
                case 'completed':
                    logger.log('IceConnectionState of RTCPeerConnection ' + this.configuration.id + ' (' + otherId + ') change to "completed"');
                    break;
            }
        });
    }
    /**
     * @hidden
     */
    generateUniqueId() {
        return uuid();
    }
}
export class WebRtcPeerRecvonly extends WebRtcPeer {
    constructor(configuration) {
        configuration.mode = 'recvonly';
        super(configuration);
    }
}
export class WebRtcPeerSendonly extends WebRtcPeer {
    constructor(configuration) {
        configuration.mode = 'sendonly';
        super(configuration);
    }
}
export class WebRtcPeerSendrecv extends WebRtcPeer {
    constructor(configuration) {
        configuration.mode = 'sendrecv';
        super(configuration);
    }
}
