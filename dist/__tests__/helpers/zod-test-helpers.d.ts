/**
 * Helper functions for converting between domain entities and Zod-validated types in tests
 */
import { ObjectId } from 'mongodb';
import { Staff, Case, Job, Application, Retainer, Reminder, Feedback } from '../../validation';
export declare class ZodTestHelpers {
    /**
     * Ensure a valid Discord snowflake ID
     */
    static ensureSnowflake(id: string | undefined): string;
    /**
     * Convert ObjectId to string
     */
    static objectIdToString(id: ObjectId | string | undefined): string | undefined;
    /**
     * Convert application with proper status type
     */
    static toZodApplication(app: any): Application;
    /**
     * Convert staff with proper role type
     */
    static toZodStaff(staff: any): Staff;
    /**
     * Convert job with proper type
     */
    static toZodJob(job: any): Job;
    /**
     * Convert case with proper type
     */
    static toZodCase(caseEntity: any): Case;
    /**
     * Convert feedback with proper rating
     */
    static toZodFeedback(feedback: any): Feedback;
    /**
     * Convert retainer with proper status
     */
    static toZodRetainer(retainer: any): Retainer;
    /**
     * Convert reminder
     */
    static toZodReminder(reminder: any): Reminder;
}
//# sourceMappingURL=zod-test-helpers.d.ts.map