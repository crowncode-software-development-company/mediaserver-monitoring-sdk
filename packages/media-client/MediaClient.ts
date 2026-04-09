import { Logger } from './Logger';
import { Session } from './Session';
import { MediaClientConfig } from './interfaces';

const logger = Logger.getInstance();
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
export class MediaClient {
    public session: Session | null = null;

    public iceServers: RTCIceServer[] = [];

    public finalUserId: string = '';

    public mediaServer: string = '';

    public configuration: MediaClientConfig;

    constructor(configuration?: MediaClientConfig) {
        this.configuration = configuration ?? {};
    }

    /**
     * Подключиться к медиа-серверу по токену.
     * Создаёт новую сессию и устанавливает WebSocket-соединение.
     */
    public async connect(token: string): Promise<void> {
        this.session = new Session(this);
        return this.session.connect(token);
    }

    /**
     * Отключиться от медиа-сервера.
     * Закрывает сессию и очищает все ресурсы.
     */
    public disconnect(): void {
        this.session?.disconnect();
        this.session = null;
    }

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
    public initSession(): Session {
        this.session = new Session(this);
        return this.session;
    }


    public setConfiguration(config: Partial<MediaClientConfig>): void {
        this.configuration = { ...this.configuration, ...config };
        if (config.iceServers) {
            this.iceServers = config.iceServers;
        }
    }
    public disableLogging() {
        logger.disableLogging();
    }
}
