"use strict";
/**
 * @module RetainerSchema
 * @description Zod schemas for retainer agreement validation
 * @category Domain/Validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetainerTerminationRequestSchema = exports.RetainerActivationRequestSchema = exports.RetainerSignatureRequestSchema = exports.RetainerCreationRequestSchema = exports.RetainerSchema = exports.RetainerStatusSchema = void 0;
const zod_1 = require("zod");
const shared_1 = require("../shared");
/**
 * Retainer status enum schema
 */
exports.RetainerStatusSchema = zod_1.z.enum(['pending', 'signed', 'cancelled']);
/**
 * Retainer entity schema
 */
exports.RetainerSchema = shared_1.BaseEntitySchema.extend({
    guildId: shared_1.DiscordSnowflakeSchema,
    clientId: shared_1.DiscordSnowflakeSchema,
    lawyerId: shared_1.DiscordSnowflakeSchema,
    status: exports.RetainerStatusSchema,
    agreementTemplate: zod_1.z.string(),
    clientRobloxUsername: zod_1.z.string().optional(),
    digitalSignature: zod_1.z.string().optional(),
    signedAt: zod_1.z.date().optional(),
});
/**
 * Retainer creation request schema
 */
exports.RetainerCreationRequestSchema = zod_1.z.object({
    guildId: shared_1.DiscordSnowflakeSchema,
    clientId: shared_1.DiscordSnowflakeSchema,
    lawyerId: shared_1.DiscordSnowflakeSchema,
});
/**
 * Retainer signature request schema
 */
exports.RetainerSignatureRequestSchema = zod_1.z.object({
    retainerId: zod_1.z.string(),
    clientRobloxUsername: zod_1.z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
    clientAgreement: zod_1.z.boolean(),
});
/**
 * Retainer activation request schema
 */
exports.RetainerActivationRequestSchema = zod_1.z.object({
    retainerId: zod_1.z.string(),
    activatedBy: shared_1.DiscordSnowflakeSchema,
});
/**
 * Retainer termination request schema
 */
exports.RetainerTerminationRequestSchema = zod_1.z.object({
    retainerId: zod_1.z.string(),
    terminatedBy: shared_1.DiscordSnowflakeSchema,
    reason: zod_1.z.string().max(500),
});
//# sourceMappingURL=retainer.schema.js.map