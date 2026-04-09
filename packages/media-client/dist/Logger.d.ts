declare class ConsoleLogger {
    private logger;
    constructor(logger: Console);
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
}
export declare class Logger {
    private static instance;
    private logging;
    defaultLogger: ConsoleLogger;
    static getInstance(): Logger;
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
    debug(...args: any[]): void;
    disableLogging(): void;
}
export {};
