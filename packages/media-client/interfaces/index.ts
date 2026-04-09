import type { Connection } from '../Connection';
import type { Stream } from '../Stream';
import type { Session } from '../Session';
import type { StreamManager } from '../StreamManager';


export enum TypeOfVideo {
    CAMERA = 'CAMERA',
    SCREEN = 'SCREEN',
    CUSTOM = 'CUSTOM',
    IPCAM = 'IPCAM'
}

export enum VideoInsertMode {
    AFTER = 'AFTER',
    APPEND = 'APPEND',
    BEFORE = 'BEFORE',
    PREPEND = 'PREPEND',
    REPLACE = 'REPLACE'
}


export type SessionEventMap = {
    streamCreated: StreamEvent;
    streamDestroyed: StreamEvent;
    connectionCreated: ConnectionEvent;
    error: Error | Event;
    disconnected: void;
    reconnected: void;
    reconnecting: void;
    signal: SignalEvent;
    exception: ExceptionEvent;
}

export type StreamManagerEventMap = {
    streamPlaying: StreamPlayingEvent;
    error: Error;
}

export type StreamInternalEventMap = {
    'mediastream-updated': void;
}

export interface StreamEvent {
    session: Session;
    stream: Stream;
}

export interface ConnectionEvent {
    session: Session;
    connection: Connection;
}

export interface StreamPlayingEvent {
    streamManager: StreamManager;
}

export interface SignalEvent {
    type?: string;
    data?: string;
    from?: Connection;
}

export interface ExceptionEvent {
    name: string;
    message: string;
    data?: unknown;
}

export interface TokenParams {
    wsUri: string;
    sessionId: string;
    secret: string;
}

export interface JsonRpcRequest {
    jsonrpc: '2.0';
    method: string;
    params: Record<string, unknown>;
    id: number;
}

export interface JsonRpcResponse<T = unknown> {
    jsonrpc: '2.0';
    result?: T;
    error?: JsonRpcError;
    id: number;
}

export interface JsonRpcError {
    code: number;
    message: string;
    data?: unknown;
}

export interface LocalConnectionOptions {
    id: string;
    finalUserId: string;
    createdAt: number;
    metadata: string;
    value: RemoteConnectionOptions[];
    session: string;
    sessionId: string;
    role: string;
    coturnIp: string;
    coturnPort: number;
    turnUsername: string;
    turnCredential: string;
    version: string;
    mediaServer: string;
    videoSimulcast: boolean;
    life: number;
    customIceServers?: IceServerProperties[];
}

export interface RemoteConnectionOptions {
    id: string;
    createdAt: number;
    metadata: string;
    streams: StreamOptionsServer[];
}

export interface StreamOptionsServer {
    id: string;
    createdAt: number;
    hasAudio: boolean;
    hasVideo: boolean;
    audioActive: boolean;
    videoActive: boolean;
    typeOfVideo: TypeOfVideo;
    frameRate: number;
    videoDimensions: string;
}

export interface IceServerProperties {
    url: string;
    username?: string;
    credential?: string;
}


export interface InboundStreamOptions {
    id: string;
    createdAt: number;
    connection: Connection;
    hasAudio: boolean;
    hasVideo: boolean;
    audioActive: boolean;
    videoActive: boolean;
    typeOfVideo: TypeOfVideo;
    frameRate: number;
    videoDimensions: VideoDimensions;
}

export interface OutboundStreamOptions {
    publisherProperties: PublisherProperties;
    mediaConstraints: StreamMediaConstraints;
}

export interface VideoDimensions {
    width: number;
    height: number;
}

export interface PublisherProperties {
    audioSource?: string | MediaStreamTrack | boolean;
    frameRate?: number;
    insertMode?: VideoInsertMode | string;
    mirror?: boolean;
    publishAudio?: boolean;
    publishVideo?: boolean;
    resolution?: string;
    videoSource?: string | MediaStreamTrack | boolean;
}

export interface SubscriberProperties {
    insertMode?: VideoInsertMode | string;
    subscribeToAudio?: boolean;
    subscribeToVideo?: boolean;
}

export interface StreamMediaConstraints {
    audio?: boolean | MediaTrackConstraints;
    peerIdentity?: string;
    preferCurrentTab?: boolean;
    video?: boolean | MediaTrackConstraints;
}

export interface StreamManagerVideo {
    video: HTMLVideoElement;
    id: string;
    targetElement?: HTMLElement;
    insertMode?: VideoInsertMode;
    canplayListenerAdded: boolean;
}

export interface MediaClientConfig {
    iceServers?: RTCIceServer[];
    rtcConfiguration?: RTCConfiguration;
}
