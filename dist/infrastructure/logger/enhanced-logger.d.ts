import winston from 'winston';
import { EnhancedErrorContext } from '../../application/services/error-context-service';
/**
 * Enhanced logger with specialized error handling capabilities
 */
export declare class EnhancedLogger {
    private static instance;
    private static errorCorrelations;
    /**
     * Initialize the enhanced logger
     */
    static initialize(): winston.Logger;
    /**
     * Get the logger instance
     */
    static getLogger(): winston.Logger;
    /**
     * Log error with enhanced context
     */
    static logError(error: Error, context?: EnhancedErrorContext, additionalMetadata?: Record<string, any>): void;
    /**
     * Log operational warning with context
     */
    static logOperationalWarning(message: string, context?: EnhancedErrorContext, metadata?: Record<string, any>): void;
    /**
     * Log performance metrics
     */
    static logPerformanceMetrics(operationName: string, metrics: {
        duration: number;
        memoryUsage?: NodeJS.MemoryUsage;
        resourcesAccessed?: string[];
        operationType: string;
    }, context?: EnhancedErrorContext): void;
    /**
     * Log security event
     */
    static logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: EnhancedErrorContext, metadata?: Record<string, any>): void;
    /**
     * Get correlation chain for an error
     */
    private static getCorrelationChain;
    /**
     * Create breadcrumbs from context
     */
    private static createBreadcrumbs;
    /**
     * Clean up old correlation entries
     */
    private static cleanupOldCorrelations;
    /**
     * Get error statistics for monitoring
     */
    static getErrorStatistics(): ErrorStatistics;
}
/**
 * Error statistics for monitoring
 */
export interface ErrorStatistics {
    totalErrors: number;
    operationalErrors: number;
    systemErrors: number;
    errorsByType: Record<string, number>;
    errorsByGuild: Record<string, number>;
    recentErrors: Array<{
        timestamp: string;
        message: string;
        errorCode?: string;
        correlationId?: string;
    }>;
}
//# sourceMappingURL=enhanced-logger.d.ts.map