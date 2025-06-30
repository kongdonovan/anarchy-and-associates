/**
 * @module GuildConfigSchemas
 * @description Zod schemas for Guild Configuration domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Channel cleanup configuration schema
 * @description Settings for automated channel cleanup
 */
export declare const ChannelCleanupConfigSchema: z.ZodObject<{
    scanInterval: z.ZodNumber;
    inactivityThreshold: z.ZodNumber;
    archiveThreshold: z.ZodNumber;
    deleteThreshold: z.ZodNumber;
    batchSize: z.ZodNumber;
    enableAutoCleanup: z.ZodBoolean;
    notificationChannelId: z.ZodOptional<z.ZodString>;
    excludedCategories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    excludedChannels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    scanInterval: number;
    inactivityThreshold: number;
    archiveThreshold: number;
    deleteThreshold: number;
    batchSize: number;
    enableAutoCleanup: boolean;
    excludedCategories: string[];
    excludedChannels: string[];
    notificationChannelId?: string | undefined;
}, {
    scanInterval: number;
    inactivityThreshold: number;
    archiveThreshold: number;
    deleteThreshold: number;
    batchSize: number;
    enableAutoCleanup: boolean;
    notificationChannelId?: string | undefined;
    excludedCategories?: string[] | undefined;
    excludedChannels?: string[] | undefined;
}>;
export type ChannelCleanupConfig = z.infer<typeof ChannelCleanupConfigSchema>;
/**
 * Guild permissions schema
 * @description Permission mappings for different actions
 */
export declare const GuildPermissionsSchema: z.ZodObject<{
    admin: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    'senior-staff': z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    case: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    config: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    lawyer: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    'lead-attorney': z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    repair: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    admin: string[];
    'senior-staff': string[];
    case: string[];
    config: string[];
    lawyer: string[];
    'lead-attorney': string[];
    repair: string[];
}, {
    admin?: string[] | undefined;
    'senior-staff'?: string[] | undefined;
    case?: string[] | undefined;
    config?: string[] | undefined;
    lawyer?: string[] | undefined;
    'lead-attorney'?: string[] | undefined;
    repair?: string[] | undefined;
}>;
export type GuildPermissions = z.infer<typeof GuildPermissionsSchema>;
/**
 * Guild configuration entity schema
 * @description Complete validation schema for guild settings
 */
export declare const GuildConfigSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    feedbackChannelId: z.ZodOptional<z.ZodString>;
    retainerChannelId: z.ZodOptional<z.ZodString>;
    caseReviewCategoryId: z.ZodOptional<z.ZodString>;
    caseArchiveCategoryId: z.ZodOptional<z.ZodString>;
    modlogChannelId: z.ZodOptional<z.ZodString>;
    applicationChannelId: z.ZodOptional<z.ZodString>;
    defaultInformationChannelId: z.ZodOptional<z.ZodString>;
    defaultRulesChannelId: z.ZodOptional<z.ZodString>;
    clientRoleId: z.ZodOptional<z.ZodString>;
    permissions: z.ZodObject<{
        admin: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        'senior-staff': z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        case: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        config: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        lawyer: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        'lead-attorney': z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        repair: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        admin: string[];
        'senior-staff': string[];
        case: string[];
        config: string[];
        lawyer: string[];
        'lead-attorney': string[];
        repair: string[];
    }, {
        admin?: string[] | undefined;
        'senior-staff'?: string[] | undefined;
        case?: string[] | undefined;
        config?: string[] | undefined;
        lawyer?: string[] | undefined;
        'lead-attorney'?: string[] | undefined;
        repair?: string[] | undefined;
    }>;
    adminRoles: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    adminUsers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    channelCleanupConfig: z.ZodOptional<z.ZodObject<{
        scanInterval: z.ZodNumber;
        inactivityThreshold: z.ZodNumber;
        archiveThreshold: z.ZodNumber;
        deleteThreshold: z.ZodNumber;
        batchSize: z.ZodNumber;
        enableAutoCleanup: z.ZodBoolean;
        notificationChannelId: z.ZodOptional<z.ZodString>;
        excludedCategories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        excludedChannels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        excludedCategories: string[];
        excludedChannels: string[];
        notificationChannelId?: string | undefined;
    }, {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        notificationChannelId?: string | undefined;
        excludedCategories?: string[] | undefined;
        excludedChannels?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    permissions: {
        admin: string[];
        'senior-staff': string[];
        case: string[];
        config: string[];
        lawyer: string[];
        'lead-attorney': string[];
        repair: string[];
    };
    createdAt: Date;
    updatedAt: Date;
    adminRoles: string[];
    adminUsers: string[];
    _id?: string | undefined;
    feedbackChannelId?: string | undefined;
    retainerChannelId?: string | undefined;
    caseReviewCategoryId?: string | undefined;
    caseArchiveCategoryId?: string | undefined;
    modlogChannelId?: string | undefined;
    applicationChannelId?: string | undefined;
    defaultInformationChannelId?: string | undefined;
    defaultRulesChannelId?: string | undefined;
    clientRoleId?: string | undefined;
    channelCleanupConfig?: {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        excludedCategories: string[];
        excludedChannels: string[];
        notificationChannelId?: string | undefined;
    } | undefined;
}, {
    guildId: string;
    permissions: {
        admin?: string[] | undefined;
        'senior-staff'?: string[] | undefined;
        case?: string[] | undefined;
        config?: string[] | undefined;
        lawyer?: string[] | undefined;
        'lead-attorney'?: string[] | undefined;
        repair?: string[] | undefined;
    };
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    _id?: string | import("bson").ObjectId | undefined;
    feedbackChannelId?: string | undefined;
    retainerChannelId?: string | undefined;
    caseReviewCategoryId?: string | undefined;
    caseArchiveCategoryId?: string | undefined;
    modlogChannelId?: string | undefined;
    applicationChannelId?: string | undefined;
    defaultInformationChannelId?: string | undefined;
    defaultRulesChannelId?: string | undefined;
    clientRoleId?: string | undefined;
    adminRoles?: string[] | undefined;
    adminUsers?: string[] | undefined;
    channelCleanupConfig?: {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        notificationChannelId?: string | undefined;
        excludedCategories?: string[] | undefined;
        excludedChannels?: string[] | undefined;
    } | undefined;
}>;
export type GuildConfig = z.infer<typeof GuildConfigSchema>;
/**
 * Guild config update request schema
 * @description Validates partial guild config updates
 */
export declare const GuildConfigUpdateRequestSchema: z.ZodObject<{
    permissions: z.ZodOptional<z.ZodObject<{
        admin: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        'senior-staff': z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        case: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        config: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        lawyer: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        'lead-attorney': z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        repair: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        admin: string[];
        'senior-staff': string[];
        case: string[];
        config: string[];
        lawyer: string[];
        'lead-attorney': string[];
        repair: string[];
    }, {
        admin?: string[] | undefined;
        'senior-staff'?: string[] | undefined;
        case?: string[] | undefined;
        config?: string[] | undefined;
        lawyer?: string[] | undefined;
        'lead-attorney'?: string[] | undefined;
        repair?: string[] | undefined;
    }>>;
    feedbackChannelId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    retainerChannelId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    caseReviewCategoryId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    caseArchiveCategoryId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    modlogChannelId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    applicationChannelId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    defaultInformationChannelId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    defaultRulesChannelId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    clientRoleId: z.ZodOptional<z.ZodOptional<z.ZodString>>;
    adminRoles: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    adminUsers: z.ZodOptional<z.ZodDefault<z.ZodArray<z.ZodString, "many">>>;
    channelCleanupConfig: z.ZodOptional<z.ZodOptional<z.ZodObject<{
        scanInterval: z.ZodNumber;
        inactivityThreshold: z.ZodNumber;
        archiveThreshold: z.ZodNumber;
        deleteThreshold: z.ZodNumber;
        batchSize: z.ZodNumber;
        enableAutoCleanup: z.ZodBoolean;
        notificationChannelId: z.ZodOptional<z.ZodString>;
        excludedCategories: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        excludedChannels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        excludedCategories: string[];
        excludedChannels: string[];
        notificationChannelId?: string | undefined;
    }, {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        notificationChannelId?: string | undefined;
        excludedCategories?: string[] | undefined;
        excludedChannels?: string[] | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    permissions?: {
        admin: string[];
        'senior-staff': string[];
        case: string[];
        config: string[];
        lawyer: string[];
        'lead-attorney': string[];
        repair: string[];
    } | undefined;
    feedbackChannelId?: string | undefined;
    retainerChannelId?: string | undefined;
    caseReviewCategoryId?: string | undefined;
    caseArchiveCategoryId?: string | undefined;
    modlogChannelId?: string | undefined;
    applicationChannelId?: string | undefined;
    defaultInformationChannelId?: string | undefined;
    defaultRulesChannelId?: string | undefined;
    clientRoleId?: string | undefined;
    adminRoles?: string[] | undefined;
    adminUsers?: string[] | undefined;
    channelCleanupConfig?: {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        excludedCategories: string[];
        excludedChannels: string[];
        notificationChannelId?: string | undefined;
    } | undefined;
}, {
    permissions?: {
        admin?: string[] | undefined;
        'senior-staff'?: string[] | undefined;
        case?: string[] | undefined;
        config?: string[] | undefined;
        lawyer?: string[] | undefined;
        'lead-attorney'?: string[] | undefined;
        repair?: string[] | undefined;
    } | undefined;
    feedbackChannelId?: string | undefined;
    retainerChannelId?: string | undefined;
    caseReviewCategoryId?: string | undefined;
    caseArchiveCategoryId?: string | undefined;
    modlogChannelId?: string | undefined;
    applicationChannelId?: string | undefined;
    defaultInformationChannelId?: string | undefined;
    defaultRulesChannelId?: string | undefined;
    clientRoleId?: string | undefined;
    adminRoles?: string[] | undefined;
    adminUsers?: string[] | undefined;
    channelCleanupConfig?: {
        scanInterval: number;
        inactivityThreshold: number;
        archiveThreshold: number;
        deleteThreshold: number;
        batchSize: number;
        enableAutoCleanup: boolean;
        notificationChannelId?: string | undefined;
        excludedCategories?: string[] | undefined;
        excludedChannels?: string[] | undefined;
    } | undefined;
}>;
export type GuildConfigUpdateRequest = z.infer<typeof GuildConfigUpdateRequestSchema>;
/**
 * Set permission request schema
 * @description Validates permission assignment requests
 */
export declare const SetPermissionRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    action: z.ZodEnum<["admin", "senior-staff", "case", "config", "lawyer", "lead-attorney", "repair"]>;
    roleId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    roleId: string;
}, {
    guildId: string;
    action: "admin" | "senior-staff" | "case" | "config" | "lawyer" | "lead-attorney" | "repair";
    roleId: string;
}>;
export type SetPermissionRequest = z.infer<typeof SetPermissionRequestSchema>;
/**
 * Add admin request schema
 * @description Validates admin role/user addition
 */
export declare const AddAdminRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    type: z.ZodEnum<["role", "user"]>;
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    type: "role" | "user";
    id: string;
}, {
    guildId: string;
    type: "role" | "user";
    id: string;
}>;
export type AddAdminRequest = z.infer<typeof AddAdminRequestSchema>;
/**
 * Channel configuration request schema
 * @description Validates channel configuration updates
 */
export declare const ChannelConfigRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    channelType: z.ZodEnum<["feedback", "retainer", "caseReview", "caseArchive", "modlog", "application", "information", "rules"]>;
    channelId: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    channelId: string | null;
    channelType: "feedback" | "retainer" | "caseReview" | "caseArchive" | "modlog" | "application" | "information" | "rules";
}, {
    guildId: string;
    channelId: string | null;
    channelType: "feedback" | "retainer" | "caseReview" | "caseArchive" | "modlog" | "application" | "information" | "rules";
}>;
export type ChannelConfigRequest = z.infer<typeof ChannelConfigRequestSchema>;
//# sourceMappingURL=guild-config.schema.d.ts.map