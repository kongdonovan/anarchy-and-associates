import { EnhancedLogger } from './enhanced-logger';

// Initialize and export the enhanced logger
const logger = EnhancedLogger.initialize();

// Export both the standard logger interface and enhanced features
export { logger, EnhancedLogger };