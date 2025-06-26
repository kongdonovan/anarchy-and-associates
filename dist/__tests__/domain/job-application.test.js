"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const job_1 = require("../../domain/entities/job");
const staff_role_1 = require("../../domain/entities/staff-role");
const test_utils_1 = require("../helpers/test-utils");
const case_1 = require("../../domain/entities/case");
describe('Job and Application Entities', () => {
    describe('Job Entity', () => {
        describe('Job Creation and Validation', () => {
            it('should create a valid job with required fields', () => {
                const job = test_utils_1.TestUtils.generateMockJob();
                expect(job.guildId).toBeTruthy();
                expect(job.title).toBeTruthy();
                expect(job.description).toBeTruthy();
                expect(job.staffRole).toBe(staff_role_1.StaffRole.PARALEGAL);
                expect(job.roleId).toBeTruthy();
                expect(job.isOpen).toBe(true);
                expect(Array.isArray(job.questions)).toBe(true);
                expect(job.postedBy).toBeTruthy();
                expect(typeof job.applicationCount).toBe('number');
                expect(typeof job.hiredCount).toBe('number');
                expect(job.createdAt).toBeInstanceOf(Date);
                expect(job.updatedAt).toBeInstanceOf(Date);
            });
            it('should handle all valid staff roles', () => {
                const validRoles = Object.values(staff_role_1.StaffRole);
                validRoles.forEach(role => {
                    const job = test_utils_1.TestUtils.generateMockJob({ staffRole: role });
                    expect(job.staffRole).toBe(role);
                });
            });
            it('should handle custom role strings', () => {
                const customRole = 'Custom Legal Advisor';
                const job = test_utils_1.TestUtils.generateMockJob({
                    staffRole: customRole
                });
                expect(job.staffRole).toBe(customRole);
            });
            it('should track job status correctly', () => {
                const openJob = test_utils_1.TestUtils.generateMockJob({ isOpen: true });
                const closedJob = test_utils_1.TestUtils.generateMockJob({
                    isOpen: false,
                    closedAt: new Date(),
                    closedBy: 'hr123'
                });
                expect(openJob.isOpen).toBe(true);
                expect(closedJob.isOpen).toBe(false);
                expect(closedJob.closedAt).toBeInstanceOf(Date);
                expect(closedJob.closedBy).toBeTruthy();
            });
            it('should handle position limits', () => {
                const limitedJob = test_utils_1.TestUtils.generateMockJob({
                    staffRole: staff_role_1.StaffRole.MANAGING_PARTNER,
                    limit: 1
                });
                expect(limitedJob.limit).toBe(1);
            });
        });
        describe('Job Questions Management', () => {
            it('should handle default job questions', () => {
                expect(job_1.DEFAULT_JOB_QUESTIONS).toBeDefined();
                expect(Array.isArray(job_1.DEFAULT_JOB_QUESTIONS)).toBe(true);
                expect(job_1.DEFAULT_JOB_QUESTIONS.length).toBeGreaterThan(0);
                // Verify required questions
                const requiredQuestions = job_1.DEFAULT_JOB_QUESTIONS.filter(q => q.required);
                expect(requiredQuestions.length).toBeGreaterThan(0);
                // Verify question types
                const questionTypes = job_1.DEFAULT_JOB_QUESTIONS.map(q => q.type);
                expect(questionTypes).toContain('short');
                expect(questionTypes).toContain('paragraph');
                expect(questionTypes).toContain('choice');
            });
            it('should handle custom job questions', () => {
                const customQuestions = [
                    {
                        id: 'custom1',
                        question: 'What is your experience with corporate law?',
                        type: 'paragraph',
                        required: true,
                        maxLength: 500
                    },
                    {
                        id: 'custom2',
                        question: 'Years of experience?',
                        type: 'number',
                        required: true,
                        minValue: 0,
                        maxValue: 50
                    },
                    {
                        id: 'custom3',
                        question: 'Preferred work schedule?',
                        type: 'choice',
                        required: false,
                        choices: ['Full-time', 'Part-time', 'Contract', 'Flexible']
                    }
                ];
                const job = test_utils_1.TestUtils.generateMockJob({
                    questions: customQuestions
                });
                expect(job.questions).toHaveLength(3);
                expect(job.questions[0]?.type).toBe('paragraph');
                expect(job.questions[1]?.type).toBe('number');
                expect(job.questions[2]?.type).toBe('choice');
                expect(job.questions[2]?.choices).toEqual(['Full-time', 'Part-time', 'Contract', 'Flexible']);
            });
            it('should validate question type constraints', () => {
                const questionsWithConstraints = [
                    {
                        id: 'short_text',
                        question: 'Brief summary?',
                        type: 'short',
                        required: true,
                        placeholder: 'Enter a brief summary...',
                        maxLength: 100
                    },
                    {
                        id: 'long_text',
                        question: 'Detailed explanation?',
                        type: 'paragraph',
                        required: true,
                        placeholder: 'Provide detailed explanation...',
                        maxLength: 1000
                    },
                    {
                        id: 'numeric_input',
                        question: 'Rate your expertise (1-10)?',
                        type: 'number',
                        required: true,
                        minValue: 1,
                        maxValue: 10
                    },
                    {
                        id: 'choice_input',
                        question: 'Select your specialty?',
                        type: 'choice',
                        required: true,
                        choices: ['Criminal', 'Corporate', 'Family', 'Immigration']
                    }
                ];
                const job = test_utils_1.TestUtils.generateMockJob({
                    questions: questionsWithConstraints
                });
                const shortQ = job.questions.find(q => q.id === 'short_text');
                const numQ = job.questions.find(q => q.id === 'numeric_input');
                const choiceQ = job.questions.find(q => q.id === 'choice_input');
                expect(shortQ?.maxLength).toBe(100);
                expect(numQ?.minValue).toBe(1);
                expect(numQ?.maxValue).toBe(10);
                expect(choiceQ?.choices).toHaveLength(4);
            });
            it('should handle questions with no constraints', () => {
                const unconstrainedQuestion = {
                    id: 'open_ended',
                    question: 'Tell us about yourself',
                    type: 'paragraph',
                    required: false
                };
                const job = test_utils_1.TestUtils.generateMockJob({
                    questions: [unconstrainedQuestion]
                });
                const question = job.questions[0];
                expect(question?.maxLength).toBeUndefined();
                expect(question?.minValue).toBeUndefined();
                expect(question?.maxValue).toBeUndefined();
                expect(question?.choices).toBeUndefined();
                expect(question?.placeholder).toBeUndefined();
            });
        });
        describe('Job Statistics Tracking', () => {
            it('should track application and hire counts', () => {
                const job = test_utils_1.TestUtils.generateMockJob({
                    applicationCount: 15,
                    hiredCount: 3
                });
                expect(job.applicationCount).toBe(15);
                expect(job.hiredCount).toBe(3);
            });
            it('should handle zero counts', () => {
                const newJob = test_utils_1.TestUtils.generateMockJob({
                    applicationCount: 0,
                    hiredCount: 0
                });
                expect(newJob.applicationCount).toBe(0);
                expect(newJob.hiredCount).toBe(0);
            });
        });
    });
    describe('Application Entity', () => {
        describe('Application Creation and Validation', () => {
            it('should create a valid application with required fields', () => {
                const application = test_utils_1.TestUtils.generateMockApplication();
                expect(application.guildId).toBeTruthy();
                expect(application.jobId).toBeTruthy();
                expect(application.applicantId).toBeTruthy();
                expect(application.robloxUsername).toBeTruthy();
                expect(Array.isArray(application.answers)).toBe(true);
                expect(application.status).toBe('pending');
                expect(application.createdAt).toBeInstanceOf(Date);
                expect(application.updatedAt).toBeInstanceOf(Date);
            });
            it('should handle all valid application statuses', () => {
                const validStatuses = ['pending', 'accepted', 'rejected'];
                validStatuses.forEach(status => {
                    const application = test_utils_1.TestUtils.generateMockApplication({ status });
                    expect(application.status).toBe(status);
                });
            });
            it('should track review information', () => {
                const reviewDate = new Date();
                const reviewedBy = 'hr123';
                const reviewReason = 'Excellent qualifications';
                const reviewedApplication = test_utils_1.TestUtils.generateMockApplication({
                    status: 'accepted',
                    reviewedBy,
                    reviewedAt: reviewDate,
                    reviewReason
                });
                expect(reviewedApplication.reviewedBy).toBe(reviewedBy);
                expect(reviewedApplication.reviewedAt).toBe(reviewDate);
                expect(reviewedApplication.reviewReason).toBe(reviewReason);
            });
        });
        describe('Application Answers Management', () => {
            it('should handle application answers for different question types', () => {
                const answers = [
                    {
                        questionId: 'roblox_username',
                        answer: 'TestRobloxUser123'
                    },
                    {
                        questionId: 'legal_experience',
                        answer: 'I have 5 years of experience in corporate law...'
                    },
                    {
                        questionId: 'availability',
                        answer: '20+ hours'
                    },
                    {
                        questionId: 'years_experience',
                        answer: '5'
                    }
                ];
                const application = test_utils_1.TestUtils.generateMockApplication({ answers });
                expect(application.answers).toHaveLength(4);
                expect(application.answers[0]?.questionId).toBe('roblox_username');
                expect(application.answers[0]?.answer).toBe('TestRobloxUser123');
            });
            it('should handle empty answers', () => {
                const application = test_utils_1.TestUtils.generateMockApplication({ answers: [] });
                expect(application.answers).toEqual([]);
                expect(application.answers).toHaveLength(0);
            });
            it('should handle answers with special characters', () => {
                const specialAnswers = [
                    {
                        questionId: 'experience',
                        answer: 'Experience with "quotes", & symbols, (parentheses), etc.'
                    },
                    {
                        questionId: 'languages',
                        answer: 'English, Español, Français, 中文'
                    }
                ];
                const application = test_utils_1.TestUtils.generateMockApplication({
                    answers: specialAnswers
                });
                expect(application.answers[0]?.answer).toContain('"quotes"');
                expect(application.answers[1]?.answer).toContain('中文');
            });
            it('should handle very long answers', () => {
                const longAnswer = 'A'.repeat(2000);
                const answers = [
                    {
                        questionId: 'detailed_experience',
                        answer: longAnswer
                    }
                ];
                const application = test_utils_1.TestUtils.generateMockApplication({ answers });
                expect(application.answers[0]?.answer).toBe(longAnswer);
                expect(application.answers[0]?.answer.length).toBe(2000);
            });
        });
        describe('Application Review Process', () => {
            it('should handle application acceptance', () => {
                const acceptanceDate = new Date();
                const acceptedApplication = test_utils_1.TestUtils.generateMockApplication({
                    status: 'accepted',
                    reviewedBy: 'hr_manager',
                    reviewedAt: acceptanceDate,
                    reviewReason: 'Strong qualifications and good fit'
                });
                expect(acceptedApplication.status).toBe('accepted');
                expect(acceptedApplication.reviewedBy).toBe('hr_manager');
                expect(acceptedApplication.reviewedAt).toBe(acceptanceDate);
                expect(acceptedApplication.reviewReason).toBe('Strong qualifications and good fit');
            });
            it('should handle application rejection', () => {
                const rejectionDate = new Date();
                const rejectedApplication = test_utils_1.TestUtils.generateMockApplication({
                    status: 'rejected',
                    reviewedBy: 'hr_manager',
                    reviewedAt: rejectionDate,
                    reviewReason: 'Insufficient experience for the role'
                });
                expect(rejectedApplication.status).toBe('rejected');
                expect(rejectedApplication.reviewedBy).toBe('hr_manager');
                expect(rejectedApplication.reviewedAt).toBe(rejectionDate);
                expect(rejectedApplication.reviewReason).toBe('Insufficient experience for the role');
            });
            it('should handle applications without review details', () => {
                const pendingApplication = test_utils_1.TestUtils.generateMockApplication({
                    status: case_1.CaseStatus.PENDING
                });
                expect(pendingApplication.reviewedBy).toBeUndefined();
                expect(pendingApplication.reviewedAt).toBeUndefined();
                expect(pendingApplication.reviewReason).toBeUndefined();
            });
        });
    });
    describe('Job-Application Relationship', () => {
        it('should link applications to jobs correctly', () => {
            const job = test_utils_1.TestUtils.generateMockJob();
            const application = test_utils_1.TestUtils.generateMockApplication({
                jobId: job._id.toString()
            });
            expect(application.jobId).toBe(job._id.toString());
            expect(application.guildId).toBe(job.guildId);
        });
        it('should handle multiple applications for same job', () => {
            const job = test_utils_1.TestUtils.generateMockJob();
            const applications = [
                test_utils_1.TestUtils.generateMockApplication({
                    jobId: job._id.toString(),
                    applicantId: 'user1'
                }),
                test_utils_1.TestUtils.generateMockApplication({
                    jobId: job._id.toString(),
                    applicantId: 'user2'
                }),
                test_utils_1.TestUtils.generateMockApplication({
                    jobId: job._id.toString(),
                    applicantId: 'user3'
                })
            ];
            applications.forEach(app => {
                expect(app.jobId).toBe(job._id.toString());
                expect(app.guildId).toBe(job.guildId);
            });
            const applicantIds = applications.map(app => app.applicantId);
            expect(new Set(applicantIds).size).toBe(3); // All unique applicants
        });
        it('should handle job closure impact on applications', () => {
            const closedJob = test_utils_1.TestUtils.generateMockJob({
                isOpen: false,
                closedAt: new Date(),
                closedBy: 'hr123'
            });
            const application = test_utils_1.TestUtils.generateMockApplication({
                jobId: closedJob._id.toString(),
                status: case_1.CaseStatus.PENDING
            });
            expect(closedJob.isOpen).toBe(false);
            expect(application.status).toBe('pending'); // Application status independent of job status
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain separate job postings per guild', () => {
            const guild1Job = test_utils_1.TestUtils.generateMockJob({
                guildId: 'guild1',
                title: 'Corporate Lawyer',
                staffRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            const guild2Job = test_utils_1.TestUtils.generateMockJob({
                guildId: 'guild2',
                title: 'Corporate Lawyer', // Same title, different guild
                staffRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE // Different requirements
            });
            expect(guild1Job.guildId).not.toBe(guild2Job.guildId);
            expect(guild1Job.title).toBe(guild2Job.title);
            expect(guild1Job.staffRole).not.toBe(guild2Job.staffRole);
        });
        it('should maintain separate applications per guild', () => {
            const sameUserDifferentGuilds = [
                test_utils_1.TestUtils.generateMockApplication({
                    applicantId: 'user123',
                    guildId: 'guild1',
                    robloxUsername: 'RobloxUser123'
                }),
                test_utils_1.TestUtils.generateMockApplication({
                    applicantId: 'user123',
                    guildId: 'guild2',
                    robloxUsername: 'RobloxUser123'
                })
            ];
            sameUserDifferentGuilds.forEach(app => {
                expect(app.applicantId).toBe('user123');
                expect(app.robloxUsername).toBe('RobloxUser123');
            });
            expect(sameUserDifferentGuilds[0]?.guildId)
                .not.toBe(sameUserDifferentGuilds[1]?.guildId);
        });
    });
    describe('Edge Cases and Validation', () => {
        it('should handle jobs with no questions', () => {
            const job = test_utils_1.TestUtils.generateMockJob({ questions: [] });
            expect(job.questions).toEqual([]);
            expect(job.questions).toHaveLength(0);
        });
        it('should handle applications with missing optional fields', () => {
            const minimalApplication = test_utils_1.TestUtils.generateMockApplication({
                reviewedBy: undefined,
                reviewedAt: undefined,
                reviewReason: undefined
            });
            expect(minimalApplication.reviewedBy).toBeUndefined();
            expect(minimalApplication.reviewedAt).toBeUndefined();
            expect(minimalApplication.reviewReason).toBeUndefined();
        });
        it('should handle special characters in job titles and descriptions', () => {
            const specialJob = test_utils_1.TestUtils.generateMockJob({
                title: 'Senior Legal Counsel - M&A (Remote)',
                description: 'Looking for experienced lawyer with 5+ years in M&A, IPOs & securities law...'
            });
            expect(specialJob.title).toContain('M&A');
            expect(specialJob.description).toContain('M&A, IPOs & securities');
        });
        it('should handle concurrent application submissions', () => {
            const simultaneousApplications = Array.from({ length: 5 }, (_, i) => test_utils_1.TestUtils.generateMockApplication({
                applicantId: `user${i}`,
                createdAt: new Date(),
                updatedAt: new Date()
            }));
            simultaneousApplications.forEach(app => {
                expect(app.createdAt).toBeInstanceOf(Date);
                expect(app.updatedAt).toBeInstanceOf(Date);
            });
        });
    });
});
//# sourceMappingURL=job-application.test.js.map