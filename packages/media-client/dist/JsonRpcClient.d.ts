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
export declare class JsonRpcClient {
    private readonly onEvent;
    private readonly onError;
    private readonly onDisconnect;
    private ws;
    private rpcId;
    private readonly callbacks;
    constructor(onEvent: ServerEventHandler, onError: ErrorHandler, onDisconnect: DisconnectHandler);
    /**
     * Установить WebSocket-соединение.
     */
    connect(wsUri: string): Promise<void>;
    /**
     * Отправить JSON-RPC запрос и дождаться ответа
     *
     * @typeParam T - тип ожидаемого result в ответе
     */
    send<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
    /**
     * Закрыть WebSocket-соединение и отменить все ожидающие запросы.
     */
    close(): void;
    private handleMessage;
}
export {};
