/**
 * @module CaseSchemas
 * @description Zod schemas for Case domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Case priority enum schema
 * @description Defines urgency levels for case handling
 */
export declare const CasePrioritySchema: z.ZodEnum<["low", "medium", "high", "urgent"]>;
export type CasePriority = z.infer<typeof CasePrioritySchema>;
/**
 * Case result enum schema
 * @description Possible outcomes when a case is closed
 */
export declare const CaseResultSchema: z.ZodEnum<["win", "loss", "settlement", "dismissed", "withdrawn"]>;
export type CaseResult = z.infer<typeof CaseResultSchema>;
/**
 * Case document schema
 * @description Document attached to a case (evidence, contracts, etc.)
 */
export declare const CaseDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    title: z.ZodString;
    content: z.ZodString;
    createdBy: z.ZodString;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    id: string;
    title: string;
    content: string;
    createdBy: string;
}, {
    createdAt: string | number | Date;
    id: string;
    title: string;
    content: string;
    createdBy: string;
}>;
export type CaseDocument = z.infer<typeof CaseDocumentSchema>;
/**
 * Case note schema
 * @description Notes and updates about a case
 */
export declare const CaseNoteSchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodString;
    createdBy: z.ZodString;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    isInternal: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    createdAt: Date;
    id: string;
    content: string;
    createdBy: string;
    isInternal: boolean;
}, {
    createdAt: string | number | Date;
    id: string;
    content: string;
    createdBy: string;
    isInternal: boolean;
}>;
export type CaseNote = z.infer<typeof CaseNoteSchema>;
/**
 * Case entity schema
 * @description Complete validation schema for legal cases
 */
export declare const CaseSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    caseNumber: z.ZodString;
    clientId: z.ZodString;
    clientUsername: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    status: z.ZodEnum<["pending", "in-progress", "closed"]>;
    priority: z.ZodEnum<["low", "medium", "high", "urgent"]>;
    leadAttorneyId: z.ZodOptional<z.ZodString>;
    assignedLawyerIds: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    channelId: z.ZodOptional<z.ZodString>;
    result: z.ZodOptional<z.ZodEnum<["win", "loss", "settlement", "dismissed", "withdrawn"]>>;
    resultNotes: z.ZodOptional<z.ZodString>;
    closedAt: z.ZodOptional<z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>>;
    closedBy: z.ZodOptional<z.ZodString>;
    documents: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        title: z.ZodString;
        content: z.ZodString;
        createdBy: z.ZodString;
        createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        id: string;
        title: string;
        content: string;
        createdBy: string;
    }, {
        createdAt: string | number | Date;
        id: string;
        title: string;
        content: string;
        createdBy: string;
    }>, "many">>;
    notes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        createdBy: z.ZodString;
        createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        isInternal: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        createdAt: Date;
        id: string;
        content: string;
        createdBy: string;
        isInternal: boolean;
    }, {
        createdAt: string | number | Date;
        id: string;
        content: string;
        createdBy: string;
        isInternal: boolean;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdAt: Date;
    status: "closed" | "pending" | "in-progress";
    updatedAt: Date;
    title: string;
    caseNumber: string;
    clientId: string;
    clientUsername: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    assignedLawyerIds: string[];
    documents: {
        createdAt: Date;
        id: string;
        title: string;
        content: string;
        createdBy: string;
    }[];
    notes: {
        createdAt: Date;
        id: string;
        content: string;
        createdBy: string;
        isInternal: boolean;
    }[];
    _id?: string | undefined;
    leadAttorneyId?: string | undefined;
    channelId?: string | undefined;
    result?: "withdrawn" | "win" | "loss" | "settlement" | "dismissed" | undefined;
    resultNotes?: string | undefined;
    closedAt?: Date | undefined;
    closedBy?: string | undefined;
}, {
    guildId: string;
    createdAt: string | number | Date;
    status: "closed" | "pending" | "in-progress";
    updatedAt: string | number | Date;
    title: string;
    caseNumber: string;
    clientId: string;
    clientUsername: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    _id?: string | import("bson").ObjectId | undefined;
    leadAttorneyId?: string | undefined;
    assignedLawyerIds?: string[] | undefined;
    channelId?: string | undefined;
    result?: "withdrawn" | "win" | "loss" | "settlement" | "dismissed" | undefined;
    resultNotes?: string | undefined;
    closedAt?: string | number | Date | undefined;
    closedBy?: string | undefined;
    documents?: {
        createdAt: string | number | Date;
        id: string;
        title: string;
        content: string;
        createdBy: string;
    }[] | undefined;
    notes?: {
        createdAt: string | number | Date;
        id: string;
        content: string;
        createdBy: string;
        isInternal: boolean;
    }[] | undefined;
}>;
export type Case = z.infer<typeof CaseSchema>;
/**
 * Case creation request schema
 * @description Validates data for creating new cases
 */
export declare const CaseCreationRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    clientId: z.ZodString;
    clientUsername: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    priority: z.ZodDefault<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    title: string;
    clientId: string;
    clientUsername: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
}, {
    guildId: string;
    title: string;
    clientId: string;
    clientUsername: string;
    description: string;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
}>;
export type CaseCreationRequest = z.infer<typeof CaseCreationRequestSchema>;
/**
 * Case assignment request schema
 * @description Validates lawyer assignment requests
 */
export declare const CaseAssignmentRequestSchema: z.ZodObject<{
    caseId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    lawyerIds: z.ZodArray<z.ZodString, "many">;
    leadAttorneyId: z.ZodOptional<z.ZodString>;
    assignedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    caseId: string;
    lawyerIds: string[];
    assignedBy: string;
    leadAttorneyId?: string | undefined;
}, {
    caseId: string | import("bson").ObjectId;
    lawyerIds: string[];
    assignedBy: string;
    leadAttorneyId?: string | undefined;
}>;
export type CaseAssignmentRequest = z.infer<typeof CaseAssignmentRequestSchema>;
/**
 * Case update request schema
 * @description Validates partial case updates
 */
export declare const CaseUpdateRequestSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
    status: z.ZodOptional<z.ZodEnum<["pending", "in-progress", "closed"]>>;
    channelId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "closed" | "pending" | "in-progress" | undefined;
    title?: string | undefined;
    description?: string | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    channelId?: string | undefined;
}, {
    status?: "closed" | "pending" | "in-progress" | undefined;
    title?: string | undefined;
    description?: string | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    channelId?: string | undefined;
}>;
/**
 * Case Counter schema
 * @description Tracks case numbers per guild per year
 */
export declare const CaseCounterSchema: z.ZodObject<{
    _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
} & {
    guildId: z.ZodString;
    year: z.ZodNumber;
    count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    createdAt: Date;
    updatedAt: Date;
    year: number;
    count: number;
    _id?: string | undefined;
}, {
    guildId: string;
    createdAt: string | number | Date;
    updatedAt: string | number | Date;
    year: number;
    count: number;
    _id?: string | import("bson").ObjectId | undefined;
}>;
export type CaseCounter = z.infer<typeof CaseCounterSchema>;
export type CaseUpdateRequest = z.infer<typeof CaseUpdateRequestSchema>;
/**
 * Case closure request schema
 * @description Validates case closure data
 */
export declare const CaseClosureRequestSchema: z.ZodObject<{
    caseId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    result: z.ZodEnum<["win", "loss", "settlement", "dismissed", "withdrawn"]>;
    resultNotes: z.ZodOptional<z.ZodString>;
    closedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    result: "withdrawn" | "win" | "loss" | "settlement" | "dismissed";
    closedBy: string;
    caseId: string;
    resultNotes?: string | undefined;
}, {
    result: "withdrawn" | "win" | "loss" | "settlement" | "dismissed";
    closedBy: string;
    caseId: string | import("bson").ObjectId;
    resultNotes?: string | undefined;
}>;
export type CaseClosureRequest = z.infer<typeof CaseClosureRequestSchema>;
/**
 * Case search filters schema
 */
export declare const CaseSearchFiltersSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    clientId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending", "in-progress", "closed"]>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
    leadAttorneyId: z.ZodOptional<z.ZodString>;
    assignedLawyerId: z.ZodOptional<z.ZodString>;
    caseNumber: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    status?: "closed" | "pending" | "in-progress" | undefined;
    caseNumber?: string | undefined;
    clientId?: string | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    leadAttorneyId?: string | undefined;
    assignedLawyerId?: string | undefined;
}, {
    guildId?: string | undefined;
    status?: "closed" | "pending" | "in-progress" | undefined;
    caseNumber?: string | undefined;
    clientId?: string | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    leadAttorneyId?: string | undefined;
    assignedLawyerId?: string | undefined;
}>;
export type CaseSearchFilters = z.infer<typeof CaseSearchFiltersSchema>;
/**
 * Add document request schema
 */
export declare const AddDocumentRequestSchema: z.ZodObject<{
    caseId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    title: z.ZodString;
    content: z.ZodString;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    content: string;
    createdBy: string;
    caseId: string;
}, {
    title: string;
    content: string;
    createdBy: string;
    caseId: string | import("bson").ObjectId;
}>;
export type AddDocumentRequest = z.infer<typeof AddDocumentRequestSchema>;
/**
 * Add note request schema
 */
export declare const AddNoteRequestSchema: z.ZodObject<{
    caseId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    content: z.ZodString;
    createdBy: z.ZodString;
    isInternal: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    content: string;
    createdBy: string;
    isInternal: boolean;
    caseId: string;
}, {
    content: string;
    createdBy: string;
    caseId: string | import("bson").ObjectId;
    isInternal?: boolean | undefined;
}>;
export type AddNoteRequest = z.infer<typeof AddNoteRequestSchema>;
//# sourceMappingURL=case.schema.d.ts.map