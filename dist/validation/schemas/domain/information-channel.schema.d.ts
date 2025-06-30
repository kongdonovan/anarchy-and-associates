/**
 * @module InformationChannelSchemas
 * @description Zod schemas for information channel domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Information channel entity schema
 * @description Complete validation schema for information channels
 */
export declare const InformationChannelSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    channelId: z.ZodString;
    messageId: z.ZodOptional<z.ZodString>;
    content: z.ZodString;
    lastUpdatedBy: z.ZodString;
    lastUpdatedAt: z.ZodDate;
    createdBy: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdAt: Date;
    updatedAt: Date;
    content: string;
    createdBy: string;
    channelId: string;
    lastUpdatedBy: string;
    lastUpdatedAt: Date;
    version: number;
    _id?: string | undefined;
    messageId?: string | undefined;
}, {
    guildId: string;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    content: string;
    createdBy: string;
    channelId: string;
    lastUpdatedBy: string;
    lastUpdatedAt: Date;
    _id?: string | import("bson").ObjectId | undefined;
    messageId?: string | undefined;
    version?: number | undefined;
}>;
export type InformationChannel = z.infer<typeof InformationChannelSchema>;
/**
 * Information channel creation request schema
 * @description Validates data for creating new information channels
 */
export declare const InformationChannelCreateRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    channelId: z.ZodString;
    content: z.ZodString;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    content: string;
    createdBy: string;
    channelId: string;
}, {
    guildId: string;
    content: string;
    createdBy: string;
    channelId: string;
}>;
export type InformationChannelCreateRequest = z.infer<typeof InformationChannelCreateRequestSchema>;
/**
 * Information channel update request schema
 * @description Validates data for updating information channels
 */
export declare const InformationChannelUpdateRequestSchema: z.ZodObject<{
    content: z.ZodString;
    updatedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    content: string;
    updatedBy: string;
}, {
    content: string;
    updatedBy: string;
}>;
export type InformationChannelUpdateRequest = z.infer<typeof InformationChannelUpdateRequestSchema>;
//# sourceMappingURL=information-channel.schema.d.ts.map