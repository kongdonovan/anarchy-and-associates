import { BaseEntity } from './base';
import { StaffRole } from './staff-role';
export interface Job extends BaseEntity {
    guildId: string;
    title: string;
    description: string;
    staffRole: StaffRole | string;
    roleId: string;
    limit?: number;
    isOpen: boolean;
    questions: JobQuestion[];
    postedBy: string;
    closedAt?: Date;
    closedBy?: string;
    applicationCount: number;
    hiredCount: number;
}
export interface JobQuestion {
    id: string;
    question: string;
    type: 'short' | 'paragraph' | 'number' | 'choice';
    required: boolean;
    choices?: string[];
    placeholder?: string;
    maxLength?: number;
    minValue?: number;
    maxValue?: number;
}
export declare enum JobStatus {
    OPEN = "open",
    CLOSED = "closed",
    REMOVED = "removed"
}
export declare const DEFAULT_JOB_QUESTIONS: JobQuestion[];
//# sourceMappingURL=job.d.ts.map