/**
 * @module ServiceSchemas
 * @description Zod schemas for service method inputs and outputs
 * @category Application/Validation
 */
import { z } from 'zod';
/**
 * Service operation result schemas
 */
export declare const StaffOperationResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
        createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    } & {
        userId: z.ZodString;
        guildId: z.ZodString;
        robloxUsername: z.ZodString;
        role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
        hiredAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        hiredBy: z.ZodString;
        promotionHistory: z.ZodDefault<z.ZodArray<z.ZodObject<{
            fromRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
            toRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
            promotedBy: z.ZodString;
            promotedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
            reason: z.ZodOptional<z.ZodString>;
            actionType: z.ZodEnum<["promotion", "demotion", "hire", "fire"]>;
        }, "strip", z.ZodTypeAny, {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }, {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: string | number | Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }>, "many">>;
        status: z.ZodEnum<["active", "inactive", "terminated"]>;
        discordRoleId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        userId: string;
        createdAt: Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: Date;
        hiredBy: string;
        promotionHistory: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[];
        _id?: string | undefined;
        discordRoleId?: string | undefined;
    }, {
        guildId: string;
        userId: string;
        createdAt: string | number | Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: string | number | Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: string | number | Date;
        hiredBy: string;
        _id?: string | import("bson").ObjectId | undefined;
        promotionHistory?: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: string | number | Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[] | undefined;
        discordRoleId?: string | undefined;
    }>>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
        guildId: string;
        userId: string;
        createdAt: Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: Date;
        hiredBy: string;
        promotionHistory: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[];
        _id?: string | undefined;
        discordRoleId?: string | undefined;
    } | undefined;
}, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
        guildId: string;
        userId: string;
        createdAt: string | number | Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: string | number | Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: string | number | Date;
        hiredBy: string;
        _id?: string | import("bson").ObjectId | undefined;
        promotionHistory?: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: string | number | Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[] | undefined;
        discordRoleId?: string | undefined;
    } | undefined;
}>;
export declare const CaseOperationResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
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
    }>>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
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
    } | undefined;
}, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
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
    } | undefined;
}>;
export declare const JobOperationResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
        createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    } & {
        guildId: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        staffRole: z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>;
        roleId: z.ZodString;
        limit: z.ZodOptional<z.ZodNumber>;
        isOpen: z.ZodBoolean;
        questions: z.ZodDefault<z.ZodArray<z.ZodEffects<z.ZodObject<{
            id: z.ZodString;
            question: z.ZodString;
            type: z.ZodEnum<["short", "paragraph", "number", "choice"]>;
            required: z.ZodBoolean;
            choices: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            placeholder: z.ZodOptional<z.ZodString>;
            maxLength: z.ZodOptional<z.ZodNumber>;
            minValue: z.ZodOptional<z.ZodNumber>;
            maxValue: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }, {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }>, {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }, {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }>, "many">>;
        postedBy: z.ZodString;
        closedAt: z.ZodOptional<z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>>;
        closedBy: z.ZodOptional<z.ZodString>;
        applicationCount: z.ZodDefault<z.ZodNumber>;
        hiredCount: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        staffRole: string;
        roleId: string;
        isOpen: boolean;
        questions: {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }[];
        postedBy: string;
        applicationCount: number;
        hiredCount: number;
        limit?: number | undefined;
        _id?: string | undefined;
        closedAt?: Date | undefined;
        closedBy?: string | undefined;
    }, {
        guildId: string;
        createdAt: string | number | Date;
        updatedAt: string | number | Date;
        title: string;
        description: string;
        staffRole: string;
        roleId: string;
        isOpen: boolean;
        postedBy: string;
        limit?: number | undefined;
        _id?: string | import("bson").ObjectId | undefined;
        closedAt?: string | number | Date | undefined;
        closedBy?: string | undefined;
        questions?: {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }[] | undefined;
        applicationCount?: number | undefined;
        hiredCount?: number | undefined;
    }>>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
        guildId: string;
        createdAt: Date;
        updatedAt: Date;
        title: string;
        description: string;
        staffRole: string;
        roleId: string;
        isOpen: boolean;
        questions: {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }[];
        postedBy: string;
        applicationCount: number;
        hiredCount: number;
        limit?: number | undefined;
        _id?: string | undefined;
        closedAt?: Date | undefined;
        closedBy?: string | undefined;
    } | undefined;
}, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
        guildId: string;
        createdAt: string | number | Date;
        updatedAt: string | number | Date;
        title: string;
        description: string;
        staffRole: string;
        roleId: string;
        isOpen: boolean;
        postedBy: string;
        limit?: number | undefined;
        _id?: string | import("bson").ObjectId | undefined;
        closedAt?: string | number | Date | undefined;
        closedBy?: string | undefined;
        questions?: {
            type: "number" | "short" | "paragraph" | "choice";
            id: string;
            question: string;
            required: boolean;
            choices?: string[] | undefined;
            placeholder?: string | undefined;
            maxLength?: number | undefined;
            minValue?: number | undefined;
            maxValue?: number | undefined;
        }[] | undefined;
        applicationCount?: number | undefined;
        hiredCount?: number | undefined;
    } | undefined;
}>;
export declare const ApplicationOperationResultSchema: z.ZodObject<{
    success: z.ZodBoolean;
    data: z.ZodOptional<z.ZodObject<{
        _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
        createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    } & {
        guildId: z.ZodString;
        jobId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
        applicantId: z.ZodString;
        robloxUsername: z.ZodString;
        answers: z.ZodArray<z.ZodObject<{
            questionId: z.ZodString;
            answer: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            questionId: string;
            answer: string;
        }, {
            questionId: string;
            answer: string;
        }>, "many">;
        status: z.ZodEnum<["pending", "accepted", "rejected", "withdrawn"]>;
        reviewedBy: z.ZodOptional<z.ZodString>;
        reviewedAt: z.ZodOptional<z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>>;
        reviewReason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        createdAt: Date;
        status: "pending" | "accepted" | "rejected" | "withdrawn";
        updatedAt: Date;
        robloxUsername: string;
        jobId: string;
        applicantId: string;
        answers: {
            questionId: string;
            answer: string;
        }[];
        _id?: string | undefined;
        reviewedBy?: string | undefined;
        reviewedAt?: Date | undefined;
        reviewReason?: string | undefined;
    }, {
        guildId: string;
        createdAt: string | number | Date;
        status: "pending" | "accepted" | "rejected" | "withdrawn";
        updatedAt: string | number | Date;
        robloxUsername: string;
        jobId: string | import("bson").ObjectId;
        applicantId: string;
        answers: {
            questionId: string;
            answer: string;
        }[];
        _id?: string | import("bson").ObjectId | undefined;
        reviewedBy?: string | undefined;
        reviewedAt?: string | number | Date | undefined;
        reviewReason?: string | undefined;
    }>>;
    error: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
        guildId: string;
        createdAt: Date;
        status: "pending" | "accepted" | "rejected" | "withdrawn";
        updatedAt: Date;
        robloxUsername: string;
        jobId: string;
        applicantId: string;
        answers: {
            questionId: string;
            answer: string;
        }[];
        _id?: string | undefined;
        reviewedBy?: string | undefined;
        reviewedAt?: Date | undefined;
        reviewReason?: string | undefined;
    } | undefined;
}, {
    success: boolean;
    error?: string | undefined;
    code?: string | undefined;
    data?: {
        guildId: string;
        createdAt: string | number | Date;
        status: "pending" | "accepted" | "rejected" | "withdrawn";
        updatedAt: string | number | Date;
        robloxUsername: string;
        jobId: string | import("bson").ObjectId;
        applicantId: string;
        answers: {
            questionId: string;
            answer: string;
        }[];
        _id?: string | import("bson").ObjectId | undefined;
        reviewedBy?: string | undefined;
        reviewedAt?: string | number | Date | undefined;
        reviewReason?: string | undefined;
    } | undefined;
}>;
export type StaffOperationResult = z.infer<typeof StaffOperationResultSchema>;
export type CaseOperationResult = z.infer<typeof CaseOperationResultSchema>;
export type JobOperationResult = z.infer<typeof JobOperationResultSchema>;
export type ApplicationOperationResult = z.infer<typeof ApplicationOperationResultSchema>;
/**
 * Staff service request schemas
 */
export declare const StaffHireRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    userId: z.ZodString;
    robloxUsername: z.ZodString;
    role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    hiredBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    isGuildOwner: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    robloxUsername: string;
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    hiredBy: string;
    reason?: string | undefined;
    isGuildOwner?: boolean | undefined;
}, {
    guildId: string;
    userId: string;
    robloxUsername: string;
    role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    hiredBy: string;
    reason?: string | undefined;
    isGuildOwner?: boolean | undefined;
}>;
export type StaffHireRequest = z.infer<typeof StaffHireRequestSchema>;
export declare const StaffPromoteRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    userId: z.ZodString;
    newRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
    promotedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    promotedBy: string;
    newRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    reason?: string | undefined;
}, {
    guildId: string;
    userId: string;
    promotedBy: string;
    newRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
    reason?: string | undefined;
}>;
export type StaffPromoteRequest = z.infer<typeof StaffPromoteRequestSchema>;
export declare const StaffFireRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    userId: z.ZodString;
    terminatedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    userId: string;
    terminatedBy: string;
    reason?: string | undefined;
}, {
    guildId: string;
    userId: string;
    terminatedBy: string;
    reason?: string | undefined;
}>;
export type StaffFireRequest = z.infer<typeof StaffFireRequestSchema>;
export declare const StaffListRequestSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    guildId: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "terminated"]>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    status?: "active" | "terminated" | "inactive" | undefined;
    sortBy?: string | undefined;
    role?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
}, {
    guildId: string;
    status?: "active" | "terminated" | "inactive" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    role?: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal" | undefined;
}>;
export type StaffListRequest = z.infer<typeof StaffListRequestSchema>;
export declare const StaffListResponseSchema: z.ZodObject<{
    staff: z.ZodArray<z.ZodObject<{
        _id: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
        createdAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        updatedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
    } & {
        userId: z.ZodString;
        guildId: z.ZodString;
        robloxUsername: z.ZodString;
        role: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
        hiredAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
        hiredBy: z.ZodString;
        promotionHistory: z.ZodDefault<z.ZodArray<z.ZodObject<{
            fromRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
            toRole: z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>;
            promotedBy: z.ZodString;
            promotedAt: z.ZodUnion<[z.ZodDate, z.ZodEffects<z.ZodString, Date, string>, z.ZodEffects<z.ZodNumber, Date, number>]>;
            reason: z.ZodOptional<z.ZodString>;
            actionType: z.ZodEnum<["promotion", "demotion", "hire", "fire"]>;
        }, "strip", z.ZodTypeAny, {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }, {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: string | number | Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }>, "many">>;
        status: z.ZodEnum<["active", "inactive", "terminated"]>;
        discordRoleId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        guildId: string;
        userId: string;
        createdAt: Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: Date;
        hiredBy: string;
        promotionHistory: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[];
        _id?: string | undefined;
        discordRoleId?: string | undefined;
    }, {
        guildId: string;
        userId: string;
        createdAt: string | number | Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: string | number | Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: string | number | Date;
        hiredBy: string;
        _id?: string | import("bson").ObjectId | undefined;
        promotionHistory?: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: string | number | Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[] | undefined;
        discordRoleId?: string | undefined;
    }>, "many">;
    pagination: z.ZodObject<{
        total: z.ZodNumber;
        page: z.ZodNumber;
        limit: z.ZodNumber;
        totalPages: z.ZodNumber;
        hasNext: z.ZodBoolean;
        hasPrevious: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    }, {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    }>;
    total: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    total: number;
    staff: {
        guildId: string;
        userId: string;
        createdAt: Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: Date;
        hiredBy: string;
        promotionHistory: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[];
        _id?: string | undefined;
        discordRoleId?: string | undefined;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}, {
    total: number;
    staff: {
        guildId: string;
        userId: string;
        createdAt: string | number | Date;
        status: "active" | "terminated" | "inactive";
        updatedAt: string | number | Date;
        robloxUsername: string;
        role: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
        hiredAt: string | number | Date;
        hiredBy: string;
        _id?: string | import("bson").ObjectId | undefined;
        promotionHistory?: {
            fromRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            toRole: "Managing Partner" | "Senior Partner" | "Junior Partner" | "Senior Associate" | "Junior Associate" | "Paralegal";
            promotedBy: string;
            promotedAt: string | number | Date;
            actionType: "promotion" | "demotion" | "hire" | "fire";
            reason?: string | undefined;
        }[] | undefined;
        discordRoleId?: string | undefined;
    }[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    };
}>;
export type StaffListResponse = z.infer<typeof StaffListResponseSchema>;
/**
 * Case service request schemas
 */
export declare const CaseOpenRequestSchema: z.ZodObject<{
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
export type CaseOpenRequest = z.infer<typeof CaseOpenRequestSchema>;
export declare const CaseAssignRequestSchema: z.ZodObject<{
    caseId: z.ZodString;
    lawyerIds: z.ZodArray<z.ZodString, "many">;
    leadAttorneyId: z.ZodOptional<z.ZodString>;
    assignedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    caseId: string;
    lawyerIds: string[];
    assignedBy: string;
    leadAttorneyId?: string | undefined;
}, {
    caseId: string;
    lawyerIds: string[];
    assignedBy: string;
    leadAttorneyId?: string | undefined;
}>;
export type CaseAssignRequest = z.infer<typeof CaseAssignRequestSchema>;
export declare const CaseListRequestSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    guildId: z.ZodString;
    clientId: z.ZodOptional<z.ZodString>;
    lawyerId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending", "in-progress", "closed"]>>;
    priority: z.ZodOptional<z.ZodEnum<["low", "medium", "high", "urgent"]>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    status?: "closed" | "pending" | "in-progress" | undefined;
    sortBy?: string | undefined;
    clientId?: string | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    lawyerId?: string | undefined;
}, {
    guildId: string;
    status?: "closed" | "pending" | "in-progress" | undefined;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    clientId?: string | undefined;
    priority?: "low" | "medium" | "high" | "urgent" | undefined;
    lawyerId?: string | undefined;
}>;
export type CaseListRequest = z.infer<typeof CaseListRequestSchema>;
export declare const CaseCloseRequestSchema: z.ZodObject<{
    caseId: z.ZodString;
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
    caseId: string;
    resultNotes?: string | undefined;
}>;
export type CaseCloseRequest = z.infer<typeof CaseCloseRequestSchema>;
/**
 * Job service request schemas
 */
export declare const JobPostRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    staffRole: z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>;
    roleId: z.ZodString;
    questions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        question: z.ZodString;
        type: z.ZodEnum<["short", "paragraph", "number", "choice"]>;
        required: z.ZodBoolean;
        choices: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "number" | "short" | "paragraph" | "choice";
        id: string;
        question: string;
        required: boolean;
        choices?: string[] | undefined;
    }, {
        type: "number" | "short" | "paragraph" | "choice";
        id: string;
        question: string;
        required: boolean;
        choices?: string[] | undefined;
    }>, "many">>;
    postedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    title: string;
    description: string;
    staffRole: string;
    roleId: string;
    postedBy: string;
    questions?: {
        type: "number" | "short" | "paragraph" | "choice";
        id: string;
        question: string;
        required: boolean;
        choices?: string[] | undefined;
    }[] | undefined;
}, {
    guildId: string;
    title: string;
    description: string;
    staffRole: string;
    roleId: string;
    postedBy: string;
    questions?: {
        type: "number" | "short" | "paragraph" | "choice";
        id: string;
        question: string;
        required: boolean;
        choices?: string[] | undefined;
    }[] | undefined;
}>;
export type JobPostRequest = z.infer<typeof JobPostRequestSchema>;
export declare const JobListRequestSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
    sortBy: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
} & {
    guildId: z.ZodString;
    isOpen: z.ZodOptional<z.ZodBoolean>;
    staffRole: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>>;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    page: number;
    limit: number;
    sortOrder: "asc" | "desc";
    sortBy?: string | undefined;
    staffRole?: string | undefined;
    isOpen?: boolean | undefined;
}, {
    guildId: string;
    page?: number | undefined;
    limit?: number | undefined;
    sortBy?: string | undefined;
    sortOrder?: "asc" | "desc" | undefined;
    staffRole?: string | undefined;
    isOpen?: boolean | undefined;
}>;
export type JobListRequest = z.infer<typeof JobListRequestSchema>;
export declare const JobCloseRequestSchema: z.ZodObject<{
    jobId: z.ZodString;
    closedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    closedBy: string;
    jobId: string;
    reason?: string | undefined;
}, {
    closedBy: string;
    jobId: string;
    reason?: string | undefined;
}>;
export type JobCloseRequest = z.infer<typeof JobCloseRequestSchema>;
/**
 * Application service request schemas
 */
export declare const ApplicationSubmitRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    jobId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    applicantId: z.ZodString;
    robloxUsername: z.ZodString;
    answers: z.ZodArray<z.ZodObject<{
        questionId: z.ZodString;
        answer: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        questionId: string;
        answer: string;
    }, {
        questionId: string;
        answer: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    guildId: string;
    robloxUsername: string;
    jobId: string;
    applicantId: string;
    answers: {
        questionId: string;
        answer: string;
    }[];
}, {
    guildId: string;
    robloxUsername: string;
    jobId: string | import("bson").ObjectId;
    applicantId: string;
    answers: {
        questionId: string;
        answer: string;
    }[];
}>;
export type ApplicationSubmitRequest = z.infer<typeof ApplicationSubmitRequestSchema>;
export declare const ApplicationReviewRequestSchema: z.ZodObject<{
    applicationId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    decision: z.ZodEnum<["accepted", "rejected"]>;
    reviewedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    reviewedBy: string;
    applicationId: string;
    decision: "accepted" | "rejected";
    reason?: string | undefined;
}, {
    reviewedBy: string;
    applicationId: string | import("bson").ObjectId;
    decision: "accepted" | "rejected";
    reason?: string | undefined;
}>;
export type ApplicationReviewRequest = z.infer<typeof ApplicationReviewRequestSchema>;
/**
 * Service method validator helper
 * @description Wraps service methods with automatic validation
 */
export declare function validateServiceMethod<TInput, TOutput>(inputSchema: z.ZodSchema<TInput>, outputSchema: z.ZodSchema<TOutput>, method: (input: TInput) => Promise<TOutput>): (input: unknown) => Promise<TOutput>;
//# sourceMappingURL=service.schema.d.ts.map