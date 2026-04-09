class ConsoleLogger {
    logger;
    constructor(logger) {
        this.logger = logger;
    }
    log(...args) {
        this.logger.log(...args);
    }
    error(...args) {
        this.logger.error(...args);
    }
    warn(...args) {
        this.logger.warn(...args);
    }
    info(...args) {
        this.logger.info(...args);
    }
    debug(...args) {
        this.logger.debug(...args);
    }
}
export class Logger {
    static instance;
    logging = true;
    defaultLogger = new ConsoleLogger(console);
    static getInstance() {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }
    log(...args) {
        if (this.logging) {
            this.defaultLogger.log(...args);
        }
    }
    error(...args) {
        if (this.logging) {
            this.defaultLogger.error(...args);
        }
    }
    warn(...args) {
        if (this.logging) {
            this.defaultLogger.warn(...args);
        }
    }
    info(...args) {
        if (this.logging) {
            this.defaultLogger.info(...args);
        }
    }
    debug(...args) {
        if (this.logging) {
            this.defaultLogger.debug(...args);
        }
    }
    disableLogging() {
        this.logging = false;
    }
}
