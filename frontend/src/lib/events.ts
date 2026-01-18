type ToastType = 'success' | 'error' | 'info';

export interface ToastEvent {
    id: string;
    message: string;
    type: ToastType;
}

class EventBus {
    private listeners: ((event: ToastEvent) => void)[] = [];

    subscribe(listener: (event: ToastEvent) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    emit(type: ToastType, message: string) {
        const event: ToastEvent = {
            id: Math.random().toString(36).substring(7),
            message,
            type
        };
        this.listeners.forEach(listener => listener(event));
    }
}

export const toastEvents = new EventBus();

// Helper for non-React files
export const toast = {
    success: (msg: string) => toastEvents.emit('success', msg),
    error: (msg: string) => toastEvents.emit('error', msg),
    info: (msg: string) => toastEvents.emit('info', msg),
};
