export interface QueuedOperation {
    id: string;
    operation: () => Promise<any>;
    userId: string;
    guildId: string;
    isGuildOwner: boolean;
    priority: number;
    createdAt: Date;
    timeout: number;
    timeoutId?: NodeJS.Timeout;
    resolve: (value: any) => void;
    reject: (error: any) => void;
}
export declare class OperationQueue {
    private static instance;
    private queue;
    private processing;
    private TIMEOUT_MS;
    private readonly HIGH_PRIORITY;
    private readonly NORMAL_PRIORITY;
    private runningOperations;
    private constructor();
    static getInstance(): OperationQueue;
    enqueue<T>(operation: () => Promise<T>, userId: string, guildId: string, isGuildOwner?: boolean): Promise<T>;
    private sortQueue;
    private processQueue;
    private timeoutOperation;
    getQueueLength(): number;
    getQueueStatus(): {
        queueLength: number;
        processing: boolean;
        operations: Array<{
            id: string;
            userId: string;
            guildId: string;
            priority: number;
            createdAt: Date;
        }>;
    };
    clearQueue(): void;
    isProcessing(): boolean;
    setTimeoutMs(timeoutMs: number): void;
    hasOperationsForUser(userId: string): boolean;
}
//# sourceMappingURL=operation-queue.d.ts.map