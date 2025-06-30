import { BaseError, ErrorContext, ErrorCode } from './base-error';

/**
 * Error specific to Discord API operations
 */
export class DiscordError extends BaseError {
  public readonly discordCode?: number;
  public readonly discordMessage?: string;
  public readonly httpStatus?: number;

  constructor(
    message: string,
    errorCode: string = ErrorCode.SYS_SERVICE_UNAVAILABLE,
    context?: Partial<ErrorContext>,
    discordCode?: number,
    discordMessage?: string,
    httpStatus?: number
  ) {
    super(message, errorCode, context);
    this.discordCode = discordCode;
    this.discordMessage = discordMessage;
    this.httpStatus = httpStatus;
  }

  protected getClientMessage(): string {
    // Handle specific Discord error codes
    switch (this.discordCode) {
      case 10003:
        return 'Unknown channel. The channel may have been deleted.';
      case 10004:
        return 'Unknown guild. This server may no longer exist.';
      case 10008:
        return 'Unknown message. The message may have been deleted.';
      case 10009:
        return 'Unknown user. The user may no longer exist.';
      case 10011:
        return 'Unknown role. The role may have been deleted.';
      case 50001:
        return 'Missing access permissions.';
      case 50013:
        return 'Missing permissions to perform this action.';
      case 50035:
        return 'Invalid form body. Please check your input.';
      case 50001:
        return 'Bot is missing access to this channel or server.';
      case 50021:
        return 'Cannot execute action on a system message.';
      default:
        if (this.httpStatus === 429) {
          return 'Rate limited. Please try again in a moment.';
        }
        if (this.httpStatus && this.httpStatus >= 500) {
          return 'Discord service is temporarily unavailable. Please try again later.';
        }
        return 'A Discord API error occurred. Please try again.';
    }
  }

  /**
   * Creates a DiscordError from a Discord.js error
   */
  public static fromDiscordJSError(
    error: any,
    context?: Partial<ErrorContext>
  ): DiscordError {
    const message = error.message || 'Unknown Discord error';
    const discordCode = error.code || error.status;
    const httpStatus = error.status || error.response?.status;
    const discordMessage = error.rawError?.message || error.message;

    let errorCode = ErrorCode.SYS_SERVICE_UNAVAILABLE;

    // Map specific Discord errors to our error codes
    if (discordCode === 50013 || discordCode === 50001) {
      errorCode = ErrorCode.PERM_INSUFFICIENT_PERMISSIONS;
    } else if ([10003, 10004, 10008, 10009, 10011].includes(discordCode)) {
      errorCode = ErrorCode.NF_ENTITY_NOT_FOUND;
    } else if (discordCode === 50035) {
      errorCode = ErrorCode.VAL_INVALID_INPUT;
    }

    return new DiscordError(
      message,
      errorCode,
      context,
      discordCode,
      discordMessage,
      httpStatus
    );
  }

  /**
   * Checks if the error is a rate limit error
   */
  public isRateLimit(): boolean {
    return this.httpStatus === 429 || this.discordCode === 429;
  }

  /**
   * Checks if the error is a permission error
   */
  public isPermissionError(): boolean {
    return this.discordCode === 50013 || this.discordCode === 50001;
  }

  /**
   * Checks if the error is a not found error
   */
  public isNotFoundError(): boolean {
    return [10003, 10004, 10008, 10009, 10011].includes(this.discordCode || 0);
  }

  /**
   * Gets retry delay for rate limit errors
   */
  public getRetryDelay(): number {
    if (this.isRateLimit()) {
      // Extract retry delay from error if available, otherwise default to 1 second
      return 1000;
    }
    return 0;
  }
}

/**
 * Error codes specific to Discord operations
 */
export enum DiscordErrorCode {
  DISCORD_API_ERROR = 'DISCORD_001',
  DISCORD_RATE_LIMITED = 'DISCORD_002',
  DISCORD_PERMISSION_DENIED = 'DISCORD_003',
  DISCORD_ENTITY_NOT_FOUND = 'DISCORD_004',
  DISCORD_INVALID_INPUT = 'DISCORD_005',
  DISCORD_SERVICE_UNAVAILABLE = 'DISCORD_006'
}