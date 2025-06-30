"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedLogger = exports.logger = void 0;
const enhanced_logger_1 = require("./enhanced-logger");
Object.defineProperty(exports, "EnhancedLogger", { enumerable: true, get: function () { return enhanced_logger_1.EnhancedLogger; } });
// Initialize and export the enhanced logger
const logger = enhanced_logger_1.EnhancedLogger.initialize();
exports.logger = logger;
//# sourceMappingURL=index.js.map