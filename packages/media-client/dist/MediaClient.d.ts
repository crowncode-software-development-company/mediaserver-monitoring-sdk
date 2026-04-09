import { Session } from './Session';
import { MediaClientConfig } from './interfaces';
/**
 * MediaClient — точка входа в SDK.
 *
 * Создаёт и управляет сессиями, хранит общую конфигурацию
 * (ICE-серверы, RTC-настройки).
 *
 * @example
 * const client = new MediaClient({
 *     iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
 * });
 *
 * const session = client.initSession();
 * session.on('streamCreated', ({ stream }) => { ... });
 * await session.connect(token);
 */
export declare class MediaClient {
    session: Session | null;
    iceServers: RTCIceServer[];
    finalUserId: string;
    mediaServer: string;
    configuration: MediaClientConfig;
    constructor(configuration?: MediaClientConfig);
    /**
     * Подключиться к медиа-серверу по токену.
     * Создаёт новую сессию и устанавливает WebSocket-соединение.
     */
    connect(token: string): Promise<void>;
    /**
     * Отключиться от медиа-сервера.
     * Закрывает сессию и очищает все ресурсы.
     */
    disconnect(): void;
    /**
     * Инициализировать сессию без подключения.
     *
     * Используется когда нужно сначала подписаться на события сессии,
     * а затем вызвать `session.connect(token)` отдельно.
     *
     * @example
     * const session = client.initSession();
     * session.on('streamCreated', handler);
     * await session.connect(token);
     */
    initSession(): Session;
    setConfiguration(config: Partial<MediaClientConfig>): void;
    disableLogging(): void;
}
