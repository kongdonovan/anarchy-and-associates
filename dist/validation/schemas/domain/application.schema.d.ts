/**
 * @module ApplicationSchemas
 * @description Zod schemas for Job Application domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Application answer schema
 * @description Answer to a job application question
 */
export declare const ApplicationAnswerSchema: z.ZodObject<{
    questionId: z.ZodString;
    answer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    questionId: string;
    answer: string;
}, {
    questionId: string;
    answer: string;
}>;
export type ApplicationAnswer = z.infer<typeof ApplicationAnswerSchema>;
/**
 * Application entity schema
 * @description Complete validation schema for job applications
 */
export declare const ApplicationSchema: z.ZodObject<{
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
}>;
export type Application = z.infer<typeof ApplicationSchema>;
/**
 * Application submission request schema
 * @description Validates data for submitting new applications
 */
export declare const ApplicationSubmissionRequestSchema: z.ZodObject<{
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
export type ApplicationSubmissionRequest = z.infer<typeof ApplicationSubmissionRequestSchema>;
/**
 * Application search filters schema
 */
export declare const ApplicationSearchFiltersSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    jobId: z.ZodOptional<z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>>;
    applicantId: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["pending", "accepted", "rejected", "withdrawn"]>>;
    reviewedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    status?: "pending" | "accepted" | "rejected" | "withdrawn" | undefined;
    jobId?: string | undefined;
    applicantId?: string | undefined;
    reviewedBy?: string | undefined;
}, {
    guildId?: string | undefined;
    status?: "pending" | "accepted" | "rejected" | "withdrawn" | undefined;
    jobId?: string | import("bson").ObjectId | undefined;
    applicantId?: string | undefined;
    reviewedBy?: string | undefined;
}>;
export type ApplicationSearchFilters = z.infer<typeof ApplicationSearchFiltersSchema>;
/**
 * Validate application answers against job questions
 * @description Ensures all required questions are answered
 */
export declare const validateApplicationAnswers: (answers: ApplicationAnswer[], questions: Array<{
    id: string;
    required: boolean;
}>) => boolean;
//# sourceMappingURL=application.schema.d.ts.map