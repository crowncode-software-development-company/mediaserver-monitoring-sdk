export declare class TypedEventEmitter<TEventMap extends Record<string, unknown>> {
    private listeners;
    on<K extends keyof TEventMap>(event: K, callback: (data: TEventMap[K]) => void): void;
    emit<K extends keyof TEventMap>(event: K, ...[data]: TEventMap[K] extends void ? [] : [TEventMap[K]]): void;
    off<K extends keyof TEventMap>(event: K, callback: (data: TEventMap[K]) => void): void;
    removeAllListeners<K extends keyof TEventMap>(event?: K): void;
}
