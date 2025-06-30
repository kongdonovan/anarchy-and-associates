/**
 * @module RetainerSchema
 * @description Zod schemas for retainer agreement validation
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Retainer status enum schema
 */
export declare const RetainerStatusSchema: z.ZodEnum<["pending", "signed", "cancelled"]>;
export type RetainerStatus = z.infer<typeof RetainerStatusSchema>;
/**
 * Retainer entity schema
 */
export declare const RetainerSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    clientId: z.ZodString;
    lawyerId: z.ZodString;
    status: z.ZodEnum<["pending", "signed", "cancelled"]>;
    agreementTemplate: z.ZodString;
    clientRobloxUsername: z.ZodOptional<z.ZodString>;
    digitalSignature: z.ZodOptional<z.ZodString>;
    signedAt: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdAt: Date;
    status: "pending" | "signed" | "cancelled";
    updatedAt: Date;
    clientId: string;
    lawyerId: string;
    agreementTemplate: string;
    _id?: string | undefined;
    clientRobloxUsername?: string | undefined;
    digitalSignature?: string | undefined;
    signedAt?: Date | undefined;
}, {
    guildId: string;
    createdAt: string | number | Date;
    status: "pending" | "signed" | "cancelled";
    updatedAt: string | number | Date;
    clientId: string;
    lawyerId: string;
    agreementTemplate: string;
    _id?: string | import("bson").ObjectId | undefined;
    clientRobloxUsername?: string | undefined;
    digitalSignature?: string | undefined;
    signedAt?: Date | undefined;
}>;
export type Retainer = z.infer<typeof RetainerSchema>;
/**
 * Retainer creation request schema
 */
export declare const RetainerCreationRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    clientId: z.ZodString;
    lawyerId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    clientId: string;
    lawyerId: string;
}, {
    guildId: string;
    clientId: string;
    lawyerId: string;
}>;
export type RetainerCreationRequest = z.infer<typeof RetainerCreationRequestSchema>;
/**
 * Retainer signature request schema
 */
export declare const RetainerSignatureRequestSchema: z.ZodObject<{
    retainerId: z.ZodString;
    clientRobloxUsername: z.ZodString;
    clientAgreement: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    clientRobloxUsername: string;
    retainerId: string;
    clientAgreement: boolean;
}, {
    clientRobloxUsername: string;
    retainerId: string;
    clientAgreement: boolean;
}>;
export type RetainerSignatureRequest = z.infer<typeof RetainerSignatureRequestSchema>;
/**
 * Retainer activation request schema
 */
export declare const RetainerActivationRequestSchema: z.ZodObject<{
    retainerId: z.ZodString;
    activatedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    retainerId: string;
    activatedBy: string;
}, {
    retainerId: string;
    activatedBy: string;
}>;
export type RetainerActivationRequest = z.infer<typeof RetainerActivationRequestSchema>;
/**
 * Retainer termination request schema
 */
export declare const RetainerTerminationRequestSchema: z.ZodObject<{
    retainerId: z.ZodString;
    terminatedBy: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    terminatedBy: string;
    retainerId: string;
}, {
    reason: string;
    terminatedBy: string;
    retainerId: string;
}>;
export type RetainerTerminationRequest = z.infer<typeof RetainerTerminationRequestSchema>;
//# sourceMappingURL=retainer.schema.d.ts.map