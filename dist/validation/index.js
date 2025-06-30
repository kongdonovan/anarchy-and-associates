"use strict";
/**
 * @module Validation
 * @description Central export point for all validation schemas and utilities
 * @category Validation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.z = void 0;
// Export shared schemas and utilities
__exportStar(require("./schemas/shared"), exports);
// Export domain schemas
__exportStar(require("./schemas/domain"), exports);
// Export infrastructure schemas
__exportStar(require("./schemas/infrastructure/discord.schema"), exports);
__exportStar(require("./schemas/infrastructure/mongodb.schema"), exports);
// Export application schemas
__exportStar(require("./schemas/application/permission.schema"), exports);
__exportStar(require("./schemas/application/service.schema"), exports);
// Export command schemas
__exportStar(require("./schemas/commands/command.schema"), exports);
// Re-export zod for convenience
var zod_1 = require("zod");
Object.defineProperty(exports, "z", { enumerable: true, get: function () { return zod_1.z; } });
//# sourceMappingURL=index.js.map