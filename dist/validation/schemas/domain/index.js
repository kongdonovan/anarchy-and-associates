"use strict";
/**
 * @module DomainSchemas
 * @description Central export point for all domain entity validation schemas
 * @category Domain/Validation
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
// Re-export all domain schemas
__exportStar(require("./staff.schema"), exports);
__exportStar(require("./case.schema"), exports);
__exportStar(require("./job.schema"), exports);
__exportStar(require("./application.schema"), exports);
__exportStar(require("./guild-config.schema"), exports);
__exportStar(require("./feedback.schema"), exports);
__exportStar(require("./retainer.schema"), exports);
__exportStar(require("./reminder.schema"), exports);
__exportStar(require("./audit-log.schema"), exports);
__exportStar(require("./information-channel.schema"), exports);
__exportStar(require("./rules-channel.schema"), exports);
//# sourceMappingURL=index.js.map