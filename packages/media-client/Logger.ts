
class ConsoleLogger {
    constructor(private logger: Console) { }

    log(...args: any[]) {
        this.logger.log(...args);
    }

    error(...args: any[]) {
        this.logger.error(...args);
    }

    warn(...args: any[]) {
        this.logger.warn(...args);
    }

    info(...args: any[]) {
        this.logger.info(...args);
    }

    debug(...args: any[]) {
        this.logger.debug(...args);
    }
}

export class Logger {
    private static instance: Logger;
    private logging = true;
    defaultLogger: ConsoleLogger = new ConsoleLogger(console);
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    public log(...args: any[]) {
        if (this.logging) {
            this.defaultLogger.log(...args);
        }
    }

    public error(...args: any[]) {
        if (this.logging) {
            this.defaultLogger.error(...args);
        }
    }

    public warn(...args: any[]) {
        if (this.logging) {
            this.defaultLogger.warn(...args);
        }
    }

    public info(...args: any[]) {
        if (this.logging) {
            this.defaultLogger.info(...args);
        }
    }

    public debug(...args: any[]) {
        if (this.logging) {
            this.defaultLogger.debug(...args);
        }
    }

    public disableLogging() {
        this.logging = false;
    }
}