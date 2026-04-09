import { Logger } from './Logger';
import { JsonRpcRequest } from './interfaces';

const logger = Logger.getInstance();

/** Callback для обработки серверных событий (JSON-RPC notifications) */
type ServerEventHandler = (method: string, params: Record<string, any>) => void;

type ErrorHandler = (error: Event) => void;

/** Callback при отключении WebSocket */
type DisconnectHandler = () => void;

/**
 * JSON-RPC 2.0 клиент поверх WebSocket.
 *
 * Отправляет RPC-запросы, обрабатывает ответы по id,
 * и делегирует серверные события (notifications) наверх.
 */
export class JsonRpcClient {
    private ws: WebSocket | null = null;
    private rpcId = 0;
    private readonly callbacks = new Map<number, {
        resolve: (data: any) => void;
        reject: (error: any) => void;
    }>();

    constructor(
        private readonly onEvent: ServerEventHandler,
        private readonly onError: ErrorHandler,
        private readonly onDisconnect: DisconnectHandler
    ) { }

    /**
     * Установить WebSocket-соединение.
     */
    public connect(wsUri: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUri);

            this.ws.onopen = () => resolve();

            this.ws.onerror = (e) => {
                this.onError(e);
                reject(e);
            };

            this.ws.onclose = () => this.onDisconnect();

            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
        });
    }

    /**
     * Отправить JSON-RPC запрос и дождаться ответа
     *
     * @typeParam T - тип ожидаемого result в ответе
     */
    public send<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket is not open'));
            }

            const id = ++this.rpcId;
            this.callbacks.set(id, { resolve, reject });

            const request: JsonRpcRequest = {
                jsonrpc: '2.0',
                method,
                params,
                id,
            };

            const payload = JSON.stringify(request);
            this.ws.send(payload);
            logger.debug(`[RPC] → ${method} (id=${id})`, params);
        });
    }

    /**
     * Закрыть WebSocket-соединение и отменить все ожидающие запросы.
     */
    public close(): void {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.callbacks.forEach(({ reject }) => {
            reject(new Error('Connection closed'));
        });
        this.callbacks.clear();
    }

    private handleMessage(data: string): void {
        let msg: any;
        try {
            msg = JSON.parse(data);
        } catch {
            logger.warn('[RPC] Failed to parse message:', data);
            return;
        }

        if (msg.id !== undefined && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id)!;
            this.callbacks.delete(msg.id);

            if (msg.error) {
                logger.debug(`[RPC] ← ERROR (id=${msg.id})`, msg.error);
                reject(msg.error);
            } else {
                logger.debug(`[RPC] ← OK (id=${msg.id})`, msg.result);
                resolve(msg.result);
            }
            return;
        }

        if (msg.method) {
            if (msg.method === 'ping') {
                this.ws?.send(JSON.stringify({
                    jsonrpc: '2.0',
                    result: { value: 'pong' },
                    id: msg.id,
                }));
            } else {
                this.onEvent(msg.method, msg.params);
            }
        }
    }
}
