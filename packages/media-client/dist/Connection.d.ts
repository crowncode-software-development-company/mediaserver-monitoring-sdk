import { Session } from './Session';
import { LocalConnectionOptions, RemoteConnectionOptions, StreamOptionsServer } from './interfaces';
import { Stream } from './Stream';
/**
 * Connection — представление потока сессии.
 *
 * Может быть локальным (наше подключение) или удалённым (камера).
 * Содержит один или несколько потоков.
 */
export declare class Connection {
    private readonly session;
    /** Опции локального подключения (заполнены только для нашего) */
    readonly localOptions?: LocalConnectionOptions;
    /** Опции удалённого подключения (камеры) */
    readonly remoteOptions?: RemoteConnectionOptions;
    readonly connectionId: string;
    readonly creationTime: number;
    data: string;
    rpcSessionId: string;
    role: string;
    stream?: Stream;
    /** Отключено ли подключение */
    disposed: boolean;
    constructor(session: Session, connectionOptions: LocalConnectionOptions | RemoteConnectionOptions);
    /**
     * Отправить ICE-кандидат серверу для этого подключения.
     */
    sendIceCandidate(candidate: RTCIceCandidate): Promise<void>;
    /**
     * Инициализировать удалённые потоки по данным от сервера.
     */
    initRemoteStreams(options: StreamOptionsServer[]): void;
    addStream(stream: Stream): void;
    removeStream(): void;
    dispose(): void;
}
