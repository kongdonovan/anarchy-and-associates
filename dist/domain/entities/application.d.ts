import { BaseEntity } from './base';
export interface Application extends BaseEntity {
    guildId: string;
    jobId: string;
    applicantId: string;
    robloxUsername: string;
    answers: ApplicationAnswer[];
    status: 'pending' | 'accepted' | 'rejected';
    reviewedBy?: string;
    reviewedAt?: Date;
    reviewReason?: string;
}
export interface ApplicationAnswer {
    questionId: string;
    answer: string;
}
//# sourceMappingURL=application.d.ts.map