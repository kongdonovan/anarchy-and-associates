"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../infrastructure/logger");
describe('Logger', () => {
    it('should be defined', () => {
        expect(logger_1.logger).toBeDefined();
    });
    it('should have expected logging methods', () => {
        expect(typeof logger_1.logger.info).toBe('function');
        expect(typeof logger_1.logger.error).toBe('function');
        expect(typeof logger_1.logger.warn).toBe('function');
        expect(typeof logger_1.logger.debug).toBe('function');
    });
    it('should log messages without throwing', () => {
        expect(() => {
            logger_1.logger.info('Test info message');
            logger_1.logger.error('Test error message');
            logger_1.logger.warn('Test warning message');
            logger_1.logger.debug('Test debug message');
        }).not.toThrow();
    });
});
//# sourceMappingURL=logger.test.js.map