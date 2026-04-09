import { Logger } from './Logger';
const logger = Logger.getInstance();
/**
 * JSON-RPC 2.0 клиент поверх WebSocket.
 *
 * Отправляет RPC-запросы, обрабатывает ответы по id,
 * и делегирует серверные события (notifications) наверх.
 */
export class JsonRpcClient {
    onEvent;
    onError;
    onDisconnect;
    ws = null;
    rpcId = 0;
    callbacks = new Map();
    constructor(onEvent, onError, onDisconnect) {
        this.onEvent = onEvent;
        this.onError = onError;
        this.onDisconnect = onDisconnect;
    }
    /**
     * Установить WebSocket-соединение.
     */
    connect(wsUri) {
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
    send(method, params) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                return reject(new Error('WebSocket is not open'));
            }
            const id = ++this.rpcId;
            this.callbacks.set(id, { resolve, reject });
            const request = {
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
    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.callbacks.forEach(({ reject }) => {
            reject(new Error('Connection closed'));
        });
        this.callbacks.clear();
    }
    handleMessage(data) {
        let msg;
        try {
            msg = JSON.parse(data);
        }
        catch {
            logger.warn('[RPC] Failed to parse message:', data);
            return;
        }
        if (msg.id !== undefined && this.callbacks.has(msg.id)) {
            const { resolve, reject } = this.callbacks.get(msg.id);
            this.callbacks.delete(msg.id);
            if (msg.error) {
                logger.debug(`[RPC] ← ERROR (id=${msg.id})`, msg.error);
                reject(msg.error);
            }
            else {
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
            }
            else {
                this.onEvent(msg.method, msg.params);
            }
        }
    }
}
