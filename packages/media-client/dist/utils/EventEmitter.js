export class TypedEventEmitter {
    listeners = new Map();
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }
    emit(event, ...[data]) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(cb => cb(data));
        }
    }
    off(event, callback) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            this.listeners.set(event, eventListeners.filter(cb => cb !== callback));
        }
    }
    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        }
        else {
            this.listeners.clear();
        }
    }
}
