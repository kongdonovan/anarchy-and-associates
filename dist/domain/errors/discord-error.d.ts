import { BaseError, ErrorContext } from './base-error';
/**
 * Error specific to Discord API operations
 */
export declare class DiscordError extends BaseError {
    readonly discordCode?: number;
    readonly discordMessage?: string;
    readonly httpStatus?: number;
    constructor(message: string, errorCode?: string, context?: Partial<ErrorContext>, discordCode?: number, discordMessage?: string, httpStatus?: number);
    protected getClientMessage(): string;
    /**
     * Creates a DiscordError from a Discord.js error
     */
    static fromDiscordJSError(error: any, context?: Partial<ErrorContext>): DiscordError;
    /**
     * Checks if the error is a rate limit error
     */
    isRateLimit(): boolean;
    /**
     * Checks if the error is a permission error
     */
    isPermissionError(): boolean;
    /**
     * Checks if the error is a not found error
     */
    isNotFoundError(): boolean;
    /**
     * Gets retry delay for rate limit errors
     */
    getRetryDelay(): number;
}
/**
 * Error codes specific to Discord operations
 */
export declare enum DiscordErrorCode {
    DISCORD_API_ERROR = "DISCORD_001",
    DISCORD_RATE_LIMITED = "DISCORD_002",
    DISCORD_PERMISSION_DENIED = "DISCORD_003",
    DISCORD_ENTITY_NOT_FOUND = "DISCORD_004",
    DISCORD_INVALID_INPUT = "DISCORD_005",
    DISCORD_SERVICE_UNAVAILABLE = "DISCORD_006"
}
//# sourceMappingURL=discord-error.d.ts.map