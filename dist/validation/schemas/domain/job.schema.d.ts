/**
 * @module JobSchemas
 * @description Zod schemas for Job/Employment domain entities
 * @category Domain/Validation
 */
import { z } from 'zod';
/**
 * Job status enum schema
 */
export declare const JobStatusSchema: z.ZodEnum<["open", "closed", "removed"]>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
/**
 * Job question type enum schema
 */
export declare const JobQuestionTypeSchema: z.ZodEnum<["short", "paragraph", "number", "choice"]>;
export type JobQuestionType = z.infer<typeof JobQuestionTypeSchema>;
/**
 * Job question schema
 * @description Questions for job applications
 */
export declare const JobQuestionSchema: z.ZodEffects<z.ZodObject<{
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
}>;
export type JobQuestion = z.infer<typeof JobQuestionSchema>;
/**
 * Job entity schema
 * @description Complete validation schema for job postings
 */
export declare const JobSchema: z.ZodObject<{
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
}>;
export type Job = z.infer<typeof JobSchema>;
/**
 * Job creation request schema
 * @description Validates data for creating new job postings
 */
export declare const JobCreateRequestSchema: z.ZodObject<{
    guildId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    staffRole: z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>;
    roleId: z.ZodString;
    limit: z.ZodOptional<z.ZodNumber>;
    questions: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    guildId: string;
    title: string;
    description: string;
    staffRole: string;
    roleId: string;
    postedBy: string;
    limit?: number | undefined;
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
}, {
    guildId: string;
    title: string;
    description: string;
    staffRole: string;
    roleId: string;
    postedBy: string;
    limit?: number | undefined;
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
}>;
export type JobCreateRequest = z.infer<typeof JobCreateRequestSchema>;
/**
 * Job update request schema
 * @description Validates partial job updates
 */
export declare const JobUpdateRequestSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    staffRole: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>>;
    roleId: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    questions: z.ZodOptional<z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodObject<{
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
    }>, "many">>>;
    postedBy: z.ZodOptional<z.ZodString>;
} & {
    isOpen: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    limit?: number | undefined;
    title?: string | undefined;
    description?: string | undefined;
    staffRole?: string | undefined;
    roleId?: string | undefined;
    isOpen?: boolean | undefined;
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
    postedBy?: string | undefined;
}, {
    guildId?: string | undefined;
    limit?: number | undefined;
    title?: string | undefined;
    description?: string | undefined;
    staffRole?: string | undefined;
    roleId?: string | undefined;
    isOpen?: boolean | undefined;
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
    postedBy?: string | undefined;
}>;
export type JobUpdateRequest = z.infer<typeof JobUpdateRequestSchema>;
/**
 * Job search filters schema
 */
export declare const JobSearchFiltersSchema: z.ZodObject<{
    guildId: z.ZodOptional<z.ZodString>;
    staffRole: z.ZodOptional<z.ZodUnion<[z.ZodEnum<["Managing Partner", "Senior Partner", "Junior Partner", "Senior Associate", "Junior Associate", "Paralegal"]>, z.ZodString]>>;
    isOpen: z.ZodOptional<z.ZodBoolean>;
    postedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    guildId?: string | undefined;
    staffRole?: string | undefined;
    isOpen?: boolean | undefined;
    postedBy?: string | undefined;
}, {
    guildId?: string | undefined;
    staffRole?: string | undefined;
    isOpen?: boolean | undefined;
    postedBy?: string | undefined;
}>;
export type JobSearchFilters = z.infer<typeof JobSearchFiltersSchema>;
/**
 * Job closure request schema
 */
export declare const JobClosureRequestSchema: z.ZodObject<{
    jobId: z.ZodEffects<z.ZodUnion<[z.ZodString, z.ZodType<import("bson").ObjectId, z.ZodTypeDef, import("bson").ObjectId>]>, string, string | import("bson").ObjectId>;
    closedBy: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    closedBy: string;
    jobId: string;
    reason?: string | undefined;
}, {
    closedBy: string;
    jobId: string | import("bson").ObjectId;
    reason?: string | undefined;
}>;
export type JobClosureRequest = z.infer<typeof JobClosureRequestSchema>;
/**
 * Default job questions validation
 * @description Ensures default questions meet requirements
 */
export declare const validateDefaultJobQuestions: (questions: unknown[]) => JobQuestion[];
//# sourceMappingURL=job.schema.d.ts.map