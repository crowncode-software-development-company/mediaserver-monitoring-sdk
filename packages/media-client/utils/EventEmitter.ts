
export class TypedEventEmitter<TEventMap extends Record<string, unknown>> {
    private listeners = new Map<keyof TEventMap, Array<(data: any) => void>>();

    public on<K extends keyof TEventMap>(
        event: K,
        callback: (data: TEventMap[K]) => void
    ): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback as (data: any) => void);
    }

    public emit<K extends keyof TEventMap>(
        event: K,
        ...[data]: TEventMap[K] extends void ? [] : [TEventMap[K]]
    ): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(cb => cb(data));
        }
    }

    public off<K extends keyof TEventMap>(
        event: K,
        callback: (data: TEventMap[K]) => void
    ): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            this.listeners.set(
                event,
                eventListeners.filter(cb => cb !== (callback as (data: any) => void))
            );
        }
    }

    public removeAllListeners<K extends keyof TEventMap>(event?: K): void {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}
