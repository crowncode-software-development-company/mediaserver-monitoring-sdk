import { MediaClient } from './MediaClient';
import { TypedEventEmitter } from './utils/EventEmitter';
import { JsonRpcClient } from './JsonRpcClient';
import { SessionEventMap, SubscriberProperties } from './interfaces';
import { Stream } from './Stream';
import { Subscriber } from './Subscriber';
import { StreamManager } from './StreamManager';
/**
 * Сессия — основной объект для подключения к медиа-серверу.
 *
 * Управляет WebSocket-соединением, обрабатывает серверные события,
 * и предоставляет API для подписки на потоки.
 *
 * @example
 * const session = mediaClient.initSession();
 * session.on('streamCreated', ({ stream }) => {
 *     const subscriber = session.subscribe(stream);
 *     subscriber.addVideoElement(videoEl);
 * });
 * await session.connect(token);
 */
export declare class Session extends TypedEventEmitter<SessionEventMap> {
    sessionId: string;
    rpcClient: JsonRpcClient;
    readonly mediaClient: MediaClient;
    streamManagers: StreamManager[];
    private connection;
    /** Удалённые подключения (камеры) */
    private remoteConnections;
    private remoteStreamsCreated;
    constructor(mediaClient: MediaClient);
    /**
     * Подключиться к медиа-серверу по токену.
     *
     * Разбирает токен, устанавливает WebSocket-соединение
     */
    connect(token: string): Promise<void>;
    /**
     * Подписаться на удалённый поток.
     *
     * Запускает WebRTC-рукопожатие и возвращает объект Subscriber,
     * через который можно привязать видео-элемент.
     */
    subscribe(stream: Stream, properties?: SubscriberProperties): Subscriber;
    disconnect(): void;
    private parseToken;
    private handleServerEvent;
    private handleIceCandidate;
    private handleParticipantJoined;
    private handleParticipantPublished;
    private handleParticipantLeft;
    private handleParticipantUnpublished;
}
