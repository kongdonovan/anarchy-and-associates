/**
 * @module RulesChannelSchemas
 * @description Zod schemas for rules channel domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Rule category enum schema
 */
export declare const RuleCategorySchema: z.ZodEnum<["general", "conduct", "cases", "staff", "clients", "confidentiality", "communication", "fees", "other"]>;
export type RuleCategory = z.infer<typeof RuleCategorySchema>;
/**
 * Individual rule schema
 * @description Schema for a single rule within a rules channel
 */
export declare const RuleSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    category: z.ZodEnum<["general", "conduct", "cases", "staff", "clients", "confidentiality", "communication", "fees", "other"]>;
    order: z.ZodNumber;
    isActive: z.ZodDefault<z.ZodBoolean>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
    createdAt: z.ZodDate;
    updatedAt: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    id: string;
    updatedAt: Date;
    title: string;
    content: string;
    isActive: boolean;
    order: number;
    category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}, {
    createdAt: Date;
    id: string;
    updatedAt: Date;
    title: string;
    content: string;
    order: number;
    category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
    isActive?: boolean | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type Rule = z.infer<typeof RuleSchema>;
/**
 * Additional field schema for rules channel embeds
 */
export declare const AdditionalFieldSchema: z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
    inline: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    value: string;
    inline?: boolean | undefined;
}, {
    name: string;
    value: string;
    inline?: boolean | undefined;
}>;
/**
 * Rules channel entity schema
 * @description Complete validation schema for rules channels
 */
export declare const RulesChannelSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    channelId: z.ZodString;
    messageId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    rules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
        category: z.ZodEnum<["general", "conduct", "cases", "staff", "clients", "confidentiality", "communication", "fees", "other"]>;
        order: z.ZodNumber;
        isActive: z.ZodDefault<z.ZodBoolean>;
        severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        isActive: boolean;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }, {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        isActive?: boolean | undefined;
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }>, "many">;
    color: z.ZodOptional<z.ZodNumber>;
    thumbnailUrl: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    footer: z.ZodOptional<z.ZodString>;
    showNumbers: z.ZodOptional<z.ZodBoolean>;
    additionalFields: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
        inline: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }, {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }>, "many">>;
    lastUpdatedBy: z.ZodString;
    lastUpdatedAt: z.ZodDate;
    createdBy: z.ZodString;
    version: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    channelId: string;
    rules: {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        isActive: boolean;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }[];
    lastUpdatedBy: string;
    lastUpdatedAt: Date;
    version: number;
    _id?: string | undefined;
    title?: string | undefined;
    content?: string | undefined;
    messageId?: string | undefined;
    color?: number | undefined;
    thumbnailUrl?: string | undefined;
    imageUrl?: string | undefined;
    footer?: string | undefined;
    showNumbers?: boolean | undefined;
    additionalFields?: {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }[] | undefined;
}, {
    guildId: string;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    createdBy: string;
    channelId: string;
    rules: {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        isActive?: boolean | undefined;
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }[];
    lastUpdatedBy: string;
    lastUpdatedAt: Date;
    _id?: string | import("bson").ObjectId | undefined;
    title?: string | undefined;
    content?: string | undefined;
    messageId?: string | undefined;
    version?: number | undefined;
    color?: number | undefined;
    thumbnailUrl?: string | undefined;
    imageUrl?: string | undefined;
    footer?: string | undefined;
    showNumbers?: boolean | undefined;
    additionalFields?: {
        name: string;
        value: string;
        inline?: boolean | undefined;
    }[] | undefined;
}>;
export type RulesChannel = z.infer<typeof RulesChannelSchema>;
/**
 * Rules channel creation request schema
 * @description Validates data for creating new rules channels
 */
export declare const RulesChannelCreateRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    channelId: z.ZodString;
    rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
        category: z.ZodEnum<["general", "conduct", "cases", "staff", "clients", "confidentiality", "communication", "fees", "other"]>;
        order: z.ZodNumber;
        isActive: z.ZodDefault<z.ZodBoolean>;
        severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
        createdAt: z.ZodDate;
        updatedAt: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        isActive: boolean;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }, {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        isActive?: boolean | undefined;
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }>, "many">>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdBy: string;
    channelId: string;
    rules: {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        isActive: boolean;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }[];
}, {
    guildId: string;
    createdBy: string;
    channelId: string;
    rules?: {
        createdAt: Date;
        id: string;
        updatedAt: Date;
        title: string;
        content: string;
        order: number;
        category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
        isActive?: boolean | undefined;
        severity?: "low" | "medium" | "high" | "critical" | undefined;
    }[] | undefined;
}>;
export type RulesChannelCreateRequest = z.infer<typeof RulesChannelCreateRequestSchema>;
/**
 * Rule creation request schema
 * @description Validates data for adding a new rule
 */
export declare const RuleCreateRequestSchema: z.ZodObject<{
    title: z.ZodString;
    content: z.ZodString;
    category: z.ZodEnum<["general", "conduct", "cases", "staff", "clients", "confidentiality", "communication", "fees", "other"]>;
    order: z.ZodOptional<z.ZodNumber>;
    severity: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "critical"]>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
    order?: number | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}, {
    title: string;
    content: string;
    category: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other";
    order?: number | undefined;
    severity?: "low" | "medium" | "high" | "critical" | undefined;
}>;
export type RuleCreateRequest = z.infer<typeof RuleCreateRequestSchema>;
/**
 * Rule update request schema
 * @description Validates data for updating an existing rule
 */
export declare const RuleUpdateRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodEnum<["general", "conduct", "cases", "staff", "clients", "confidentiality", "communication", "fees", "other"]>>;
    order: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    content?: string | undefined;
    isActive?: boolean | undefined;
    order?: number | undefined;
    category?: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other" | undefined;
}, {
    title?: string | undefined;
    content?: string | undefined;
    isActive?: boolean | undefined;
    order?: number | undefined;
    category?: "general" | "conduct" | "cases" | "staff" | "clients" | "confidentiality" | "communication" | "fees" | "other" | undefined;
}>;
export type RuleUpdateRequest = z.infer<typeof RuleUpdateRequestSchema>;
//# sourceMappingURL=rules-channel.schema.d.ts.map