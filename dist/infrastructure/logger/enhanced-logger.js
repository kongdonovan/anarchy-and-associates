"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedLogger = void 0;
const winston_1 = __importDefault(require("winston"));
const base_error_1 = require("../../domain/errors/base-error");
/**
 * Enhanced logger with specialized error handling capabilities
 */
class EnhancedLogger {
    /**
     * Initialize the enhanced logger
     */
    static initialize() {
        if (this.instance) {
            return this.instance;
        }
        const logLevel = process.env.LOG_LEVEL || 'info';
        const isProduction = process.env.NODE_ENV === 'production';
        // Custom format for error correlation
        const errorCorrelationFormat = winston_1.default.format((info) => {
            if (info.correlationId) {
                // Track error in correlation map
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    level: info.level,
                    message: info.message,
                    correlationId: info.correlationId,
                    operationId: info.operationId,
                    metadata: info
                };
                if (!this.errorCorrelations.has(info.correlationId)) {
                    this.errorCorrelations.set(info.correlationId, []);
                }
                this.errorCorrelations.get(info.correlationId).push(logEntry);
                // Clean up old correlations (older than 1 hour)
                this.cleanupOldCorrelations();
            }
            return info;
        });
        // Custom format for sensitive data redaction
        const sensitiveDataRedactionFormat = winston_1.default.format((info) => {
            const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth', 'bearer'];
            const redactSensitiveData = (obj) => {
                if (typeof obj !== 'object' || obj === null) {
                    return obj;
                }
                if (Array.isArray(obj)) {
                    return obj.map(redactSensitiveData);
                }
                const redacted = { ...obj };
                for (const [key, value] of Object.entries(redacted)) {
                    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                        redacted[key] = '[REDACTED]';
                    }
                    else if (typeof value === 'object') {
                        redacted[key] = redactSensitiveData(value);
                    }
                }
                return redacted;
            };
            return redactSensitiveData(info);
        });
        // Custom format for error enrichment
        const errorEnrichmentFormat = winston_1.default.format((info) => {
            if (info.error instanceof base_error_1.BaseError) {
                info.enrichedError = {
                    ...info.error.serialize(),
                    clientMessage: info.error.toClientError().message
                };
            }
            return info;
        });
        this.instance = winston_1.default.createLogger({
            level: logLevel,
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), errorCorrelationFormat(), sensitiveDataRedactionFormat(), errorEnrichmentFormat(), winston_1.default.format.json()),
            defaultMeta: {
                service: 'anarchy-associates-bot',
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development'
            },
            transports: [
                // Error-specific log file
                new winston_1.default.transports.File({
                    filename: 'logs/error.log',
                    level: 'error',
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.printf((info) => {
                        return JSON.stringify({
                            ...info,
                            errorCorrelationChain: info.correlationId ?
                                this.getCorrelationChain(info.correlationId) : undefined
                        }, null, 2);
                    }))
                }),
                // Operational errors log file
                new winston_1.default.transports.File({
                    filename: 'logs/operational.log',
                    level: 'warn',
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format((info) => {
                        // Only log operational errors to this file
                        if (info.isOperational === true) {
                            return info;
                        }
                        return false;
                    })())
                }),
                // Performance metrics log file
                new winston_1.default.transports.File({
                    filename: 'logs/performance.log',
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format((info) => {
                        // Only log entries with performance metrics
                        if (info.performanceMetrics) {
                            return info;
                        }
                        return false;
                    })())
                }),
                // Combined log file
                new winston_1.default.transports.File({
                    filename: 'logs/combined.log',
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format.prettyPrint())
                }),
                // Security events log file
                new winston_1.default.transports.File({
                    filename: 'logs/security.log',
                    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json(), winston_1.default.format((info) => {
                        // Log security-related events
                        const securityKeywords = ['permission', 'auth', 'access', 'security', 'unauthorized'];
                        const message = info.message || '';
                        const errorCode = info.errorCode || '';
                        const action = info.action || '';
                        const isSecurityEvent = securityKeywords.some(keyword => message.toLowerCase().includes(keyword) ||
                            errorCode.includes('PERM_') ||
                            action.includes('security'));
                        if (isSecurityEvent) {
                            return info;
                        }
                        return false;
                    })())
                })
            ],
        });
        // Add console transport for non-production
        if (!isProduction) {
            this.instance.add(new winston_1.default.transports.Console({
                format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.timestamp({ format: 'HH:mm:ss' }), winston_1.default.format.printf((info) => {
                    const correlationId = info.correlationId ? ` [${info.correlationId.slice(-8)}]` : '';
                    const operationId = info.operationId ? ` {${info.operationId.slice(-6)}}` : '';
                    return `${info.timestamp} ${info.level}${correlationId}${operationId}: ${info.message}`;
                }))
            }));
        }
        return this.instance;
    }
    /**
     * Get the logger instance
     */
    static getLogger() {
        if (!this.instance) {
            return this.initialize();
        }
        return this.instance;
    }
    /**
     * Log error with enhanced context
     */
    static logError(error, context, additionalMetadata) {
        const logger = this.getLogger();
        const logData = {
            error,
            errorName: error.name,
            errorMessage: error.message,
            errorCode: error instanceof base_error_1.BaseError ? error.errorCode : base_error_1.ErrorCode.SYS_INTERNAL_ERROR,
            stack: error.stack,
            isOperational: error instanceof base_error_1.BaseError ? error.isOperational : false,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            parentOperationId: context?.parentOperationId,
            guildId: context?.guildId,
            userId: context?.userId,
            commandName: context?.commandName,
            breadcrumbs: context ? this.createBreadcrumbs(context) : [],
            performanceMetrics: context?.performanceMetrics,
            discordContext: context?.discordContext,
            operationStack: context?.operationStack,
            ...context?.metadata,
            ...additionalMetadata
        };
        if (error instanceof base_error_1.BaseError && error.isOperational) {
            logger.warn('Operational error occurred', logData);
        }
        else {
            logger.error('System error occurred', logData);
        }
    }
    /**
     * Log operational warning with context
     */
    static logOperationalWarning(message, context, metadata) {
        const logger = this.getLogger();
        logger.warn(message, {
            isOperational: true,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            commandName: context?.commandName,
            ...context?.metadata,
            ...metadata
        });
    }
    /**
     * Log performance metrics
     */
    static logPerformanceMetrics(operationName, metrics, context) {
        const logger = this.getLogger();
        logger.info(`Performance: ${operationName}`, {
            performanceMetrics: metrics,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            ...context?.metadata
        });
    }
    /**
     * Log security event
     */
    static logSecurityEvent(event, severity, context, metadata) {
        const logger = this.getLogger();
        const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
        logger.log(logLevel, `Security Event: ${event}`, {
            securityEvent: true,
            severity,
            correlationId: context?.correlationId,
            operationId: context?.operationId,
            guildId: context?.guildId,
            userId: context?.userId,
            action: context?.action,
            permissions: context?.discordContext?.permissions,
            ...context?.metadata,
            ...metadata
        });
    }
    /**
     * Get correlation chain for an error
     */
    static getCorrelationChain(correlationId) {
        return this.errorCorrelations.get(correlationId) || [];
    }
    /**
     * Create breadcrumbs from context
     */
    static createBreadcrumbs(context) {
        const breadcrumbs = [];
        if (context.discordContext?.guildName) {
            breadcrumbs.push(`Guild: ${context.discordContext.guildName}`);
        }
        if (context.commandName) {
            breadcrumbs.push(`Command: ${context.commandName}`);
        }
        if (context.metadata?.serviceName) {
            breadcrumbs.push(`Service: ${context.metadata.serviceName}`);
        }
        if (context.metadata?.operation) {
            breadcrumbs.push(`Operation: ${context.metadata.operation}`);
        }
        return breadcrumbs;
    }
    /**
     * Clean up old correlation entries
     */
    static cleanupOldCorrelations() {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        for (const [correlationId, entries] of this.errorCorrelations.entries()) {
            const hasRecentEntries = entries.some(entry => new Date(entry.timestamp) > oneHourAgo);
            if (!hasRecentEntries) {
                this.errorCorrelations.delete(correlationId);
            }
        }
    }
    /**
     * Get error statistics for monitoring
     */
    static getErrorStatistics() {
        const stats = {
            totalErrors: 0,
            operationalErrors: 0,
            systemErrors: 0,
            errorsByType: {},
            errorsByGuild: {},
            recentErrors: []
        };
        for (const entries of this.errorCorrelations.values()) {
            for (const entry of entries) {
                if (entry.level === 'error' || entry.level === 'warn') {
                    stats.totalErrors++;
                    if (entry.metadata.isOperational) {
                        stats.operationalErrors++;
                    }
                    else {
                        stats.systemErrors++;
                    }
                    // Count by error type
                    const errorCode = entry.metadata.errorCode || 'UNKNOWN';
                    stats.errorsByType[errorCode] = (stats.errorsByType[errorCode] || 0) + 1;
                    // Count by guild
                    if (entry.metadata.guildId) {
                        stats.errorsByGuild[entry.metadata.guildId] =
                            (stats.errorsByGuild[entry.metadata.guildId] || 0) + 1;
                    }
                    // Add to recent errors (last 10)
                    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
                    if (new Date(entry.timestamp) > oneHourAgo) {
                        stats.recentErrors.push({
                            timestamp: entry.timestamp,
                            message: entry.message,
                            errorCode: entry.metadata.errorCode,
                            correlationId: entry.correlationId
                        });
                    }
                }
            }
        }
        // Sort recent errors by timestamp
        stats.recentErrors.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10);
        return stats;
    }
}
exports.EnhancedLogger = EnhancedLogger;
EnhancedLogger.errorCorrelations = new Map();
//# sourceMappingURL=enhanced-logger.js.map