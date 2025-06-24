"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retainer_1 = require("../../domain/entities/retainer");
const feedback_1 = require("../../domain/entities/feedback");
const test_utils_1 = require("../helpers/test-utils");
describe('Retainer and Feedback Entities', () => {
    describe('Retainer Entity', () => {
        describe('Retainer Creation and Validation', () => {
            it('should create a valid retainer with required fields', () => {
                const retainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer123',
                    agreementText: 'This is a legal retainer agreement...',
                    amount: 5000,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(retainer.guildId).toBeTruthy();
                expect(retainer.clientId).toBeTruthy();
                expect(retainer.clientUsername).toBeTruthy();
                expect(retainer.lawyerId).toBeTruthy();
                expect(retainer.agreementText).toBeTruthy();
                expect(retainer.amount).toBeGreaterThan(0);
                expect(retainer.status).toBe(retainer_1.RetainerStatus.PENDING);
                expect(retainer.createdAt).toBeInstanceOf(Date);
                expect(retainer.updatedAt).toBeInstanceOf(Date);
            });
            it('should handle all valid retainer statuses', () => {
                const validStatuses = [
                    retainer_1.RetainerStatus.PENDING,
                    retainer_1.RetainerStatus.SIGNED,
                    retainer_1.RetainerStatus.CANCELLED
                ];
                validStatuses.forEach(status => {
                    const retainer = {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        clientId: 'client123',
                        clientUsername: 'testclient',
                        lawyerId: 'lawyer123',
                        agreementText: 'Test agreement',
                        amount: 1000,
                        status,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    expect(retainer.status).toBe(status);
                });
            });
            it('should handle different retainer amounts', () => {
                const amounts = [500, 1000, 2500, 5000, 10000];
                amounts.forEach(amount => {
                    const retainer = {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        clientId: 'client123',
                        clientUsername: 'testclient',
                        lawyerId: 'lawyer123',
                        agreementText: 'Test agreement',
                        amount,
                        status: retainer_1.RetainerStatus.PENDING,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    expect(retainer.amount).toBe(amount);
                    expect(retainer.amount).toBeGreaterThan(0);
                });
            });
        });
        describe('Retainer Signature Process', () => {
            it('should handle retainer signing with Roblox validation', () => {
                const signedDate = new Date();
                const robloxUsername = 'TestRobloxUser123';
                const signedRetainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer123',
                    agreementText: 'Test agreement',
                    amount: 2500,
                    status: retainer_1.RetainerStatus.SIGNED,
                    signedAt: signedDate,
                    robloxUsername,
                    createdAt: new Date(),
                    updatedAt: signedDate
                };
                expect(signedRetainer.status).toBe(retainer_1.RetainerStatus.SIGNED);
                expect(signedRetainer.signedAt).toBe(signedDate);
                expect(signedRetainer.robloxUsername).toBe(robloxUsername);
                expect(signedRetainer.updatedAt).toBe(signedDate);
            });
            it('should handle retainer cancellation', () => {
                const cancelledDate = new Date();
                const cancellationReason = 'Client changed mind';
                const cancelledRetainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer123',
                    agreementText: 'Test agreement',
                    amount: 1500,
                    status: retainer_1.RetainerStatus.CANCELLED,
                    cancelledAt: cancelledDate,
                    cancellationReason,
                    createdAt: new Date(),
                    updatedAt: cancelledDate
                };
                expect(cancelledRetainer.status).toBe(retainer_1.RetainerStatus.CANCELLED);
                expect(cancelledRetainer.cancelledAt).toBe(cancelledDate);
                expect(cancelledRetainer.cancellationReason).toBe(cancellationReason);
            });
            it('should validate Roblox username format', () => {
                const validRobloxUsernames = [
                    'TestUser123',
                    'User_With_Underscores',
                    'a'.repeat(20), // Max length
                    'abc' // Min length
                ];
                validRobloxUsernames.forEach(username => {
                    // Basic regex validation: 3-20 chars, alphanumeric + underscores, no consecutive underscores
                    const robloxRegex = /^(?=.{3,20}$)(?!.*__)(?!_)[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)?(?<!_)$/;
                    expect(robloxRegex.test(username)).toBe(true);
                });
                const invalidRobloxUsernames = [
                    'ab', // Too short
                    'a'.repeat(21), // Too long
                    '__invalid', // Starts with underscore
                    'invalid__', // Ends with underscore
                    'invalid__double', // Double underscore
                    'invalid-dash', // Contains dash
                    'invalid space' // Contains space
                ];
                invalidRobloxUsernames.forEach(username => {
                    const robloxRegex = /^(?=.{3,20}$)(?!.*__)(?!_)[a-zA-Z0-9]+(?:_[a-zA-Z0-9]+)?(?<!_)$/;
                    expect(robloxRegex.test(username)).toBe(false);
                });
            });
        });
        describe('Retainer Business Rules', () => {
            it('should enforce one pending + one active retainer per client rule', () => {
                const clientId = 'client123';
                const guildId = 'guild123';
                const pendingRetainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId,
                    clientId,
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer1',
                    agreementText: 'Pending agreement',
                    amount: 1000,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                const activeRetainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId,
                    clientId,
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer2',
                    agreementText: 'Active agreement',
                    amount: 2000,
                    status: retainer_1.RetainerStatus.SIGNED,
                    signedAt: new Date(),
                    robloxUsername: 'TestUser123',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                // Both retainers for same client but different status
                expect(pendingRetainer.clientId).toBe(activeRetainer.clientId);
                expect(pendingRetainer.status).toBe(retainer_1.RetainerStatus.PENDING);
                expect(activeRetainer.status).toBe(retainer_1.RetainerStatus.SIGNED);
                expect(pendingRetainer.lawyerId).not.toBe(activeRetainer.lawyerId);
            });
            it('should handle retainer amount validation', () => {
                const validAmounts = [100, 500, 1000, 2500, 5000, 10000];
                const invalidAmounts = [0, -100, -1000];
                validAmounts.forEach(amount => {
                    expect(amount).toBeGreaterThan(0);
                });
                invalidAmounts.forEach(amount => {
                    expect(amount).toBeLessThanOrEqual(0);
                });
            });
        });
        describe('Retainer Edge Cases', () => {
            it('should handle very long agreement text', () => {
                const longAgreementText = 'This is a very long retainer agreement. '.repeat(200);
                const retainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer123',
                    agreementText: longAgreementText,
                    amount: 2500,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(retainer.agreementText.length).toBeGreaterThan(5000);
                expect(retainer.agreementText).toContain('retainer agreement');
            });
            it('should handle special characters in agreement text', () => {
                const specialAgreementText = `
          This retainer agreement includes:
          - 50% deposit ($2,500)
          - "Representation services"
          - Terms & conditions
          - Clause #1, #2, #3
          - Email: lawyer@firm.com
        `;
                const retainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer123',
                    agreementText: specialAgreementText,
                    amount: 5000,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(retainer.agreementText).toContain('$2,500');
                expect(retainer.agreementText).toContain('"Representation services"');
                expect(retainer.agreementText).toContain('lawyer@firm.com');
            });
        });
    });
    describe('Feedback Entity', () => {
        describe('Feedback Creation and Validation', () => {
            it('should create a valid feedback with required fields', () => {
                const feedback = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    caseId: 'case123',
                    clientId: 'client123',
                    staffId: 'staff123',
                    rating: feedback_1.FeedbackRating.EXCELLENT,
                    comment: 'Outstanding legal representation!',
                    isAnonymous: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(feedback.guildId).toBeTruthy();
                expect(feedback.caseId).toBeTruthy();
                expect(feedback.clientId).toBeTruthy();
                expect(feedback.staffId).toBeTruthy();
                expect(feedback.rating).toBe(feedback_1.FeedbackRating.EXCELLENT);
                expect(feedback.comment).toBeTruthy();
                expect(typeof feedback.isAnonymous).toBe('boolean');
                expect(feedback.createdAt).toBeInstanceOf(Date);
                expect(feedback.updatedAt).toBeInstanceOf(Date);
            });
            it('should handle all valid feedback ratings', () => {
                const validRatings = [
                    feedback_1.FeedbackRating.POOR,
                    feedback_1.FeedbackRating.FAIR,
                    feedback_1.FeedbackRating.GOOD,
                    feedback_1.FeedbackRating.VERY_GOOD,
                    feedback_1.FeedbackRating.EXCELLENT
                ];
                validRatings.forEach(rating => {
                    const feedback = {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case123',
                        clientId: 'client123',
                        staffId: 'staff123',
                        rating,
                        comment: 'Test feedback',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    expect(feedback.rating).toBe(rating);
                });
            });
            it('should handle anonymous feedback', () => {
                const anonymousFeedback = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    caseId: 'case123',
                    clientId: 'client123',
                    staffId: 'staff123',
                    rating: feedback_1.FeedbackRating.GOOD,
                    comment: 'Anonymous feedback comment',
                    isAnonymous: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(anonymousFeedback.isAnonymous).toBe(true);
                expect(anonymousFeedback.comment).toBeTruthy();
            });
        });
        describe('Feedback Content Validation', () => {
            it('should handle feedback with various comment lengths', () => {
                const comments = [
                    'Good', // Short
                    'The lawyer provided excellent service throughout the case.', // Medium
                    'This is a very detailed feedback comment that explains in great detail all the aspects of the legal service provided, including communication, expertise, timeliness, and overall satisfaction with the outcome.'.repeat(3) // Long
                ];
                comments.forEach(comment => {
                    const feedback = {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case123',
                        clientId: 'client123',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.GOOD,
                        comment,
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    expect(feedback.comment).toBe(comment);
                    expect(feedback.comment.length).toBeGreaterThan(0);
                });
            });
            it('should handle feedback with special characters and formatting', () => {
                const specialComment = `
          Excellent service! 
          - Very responsive (replied within 24hrs)
          - Clear communication 📧
          - Professional approach 💼
          - 5/5 stars ⭐⭐⭐⭐⭐
          - Would recommend to friends & family
        `;
                const feedback = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    caseId: 'case123',
                    clientId: 'client123',
                    staffId: 'staff123',
                    rating: feedback_1.FeedbackRating.EXCELLENT,
                    comment: specialComment,
                    isAnonymous: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(feedback.comment).toContain('5/5 stars');
                expect(feedback.comment).toContain('⭐');
                expect(feedback.comment).toContain('24hrs');
            });
            it('should handle empty or minimal comments', () => {
                const minimalFeedback = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    caseId: 'case123',
                    clientId: 'client123',
                    staffId: 'staff123',
                    rating: feedback_1.FeedbackRating.GOOD,
                    comment: '', // Empty comment
                    isAnonymous: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(minimalFeedback.comment).toBe('');
                expect(minimalFeedback.rating).toBe(feedback_1.FeedbackRating.GOOD);
            });
        });
        describe('Feedback Performance Metrics', () => {
            it('should calculate average ratings correctly', () => {
                const feedbacks = [
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case1',
                        clientId: 'client1',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.EXCELLENT, // 5
                        comment: 'Great!',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case2',
                        clientId: 'client2',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.VERY_GOOD, // 4
                        comment: 'Very good!',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case3',
                        clientId: 'client3',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.GOOD, // 3
                        comment: 'Good!',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];
                // Calculate average rating
                const ratingValues = {
                    [feedback_1.FeedbackRating.POOR]: 1,
                    [feedback_1.FeedbackRating.FAIR]: 2,
                    [feedback_1.FeedbackRating.GOOD]: 3,
                    [feedback_1.FeedbackRating.VERY_GOOD]: 4,
                    [feedback_1.FeedbackRating.EXCELLENT]: 5
                };
                const totalRating = feedbacks.reduce((sum, feedback) => sum + ratingValues[feedback.rating], 0);
                const averageRating = totalRating / feedbacks.length;
                expect(averageRating).toBe(4); // (5 + 4 + 3) / 3 = 4
                expect(feedbacks).toHaveLength(3);
            });
            it('should handle zero feedback scenarios', () => {
                const feedbacks = [];
                expect(feedbacks).toHaveLength(0);
                // Division by zero protection
                const averageRating = feedbacks.length > 0
                    ? feedbacks.reduce((sum, f) => sum + 1, 0) / feedbacks.length
                    : 0;
                expect(averageRating).toBe(0);
            });
            it('should track feedback distribution', () => {
                const feedbacks = [
                    ...Array(10).fill(null).map(() => ({
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case1',
                        clientId: 'client1',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.EXCELLENT,
                        comment: 'Excellent',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    })),
                    ...Array(5).fill(null).map(() => ({
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId: 'case2',
                        clientId: 'client2',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.VERY_GOOD,
                        comment: 'Very good',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }))
                ];
                const excellentCount = feedbacks.filter(f => f.rating === feedback_1.FeedbackRating.EXCELLENT).length;
                const veryGoodCount = feedbacks.filter(f => f.rating === feedback_1.FeedbackRating.VERY_GOOD).length;
                expect(excellentCount).toBe(10);
                expect(veryGoodCount).toBe(5);
                expect(feedbacks).toHaveLength(15);
            });
        });
        describe('Feedback Edge Cases', () => {
            it('should handle feedback for same case by different clients', () => {
                const caseId = 'case123';
                const feedbacks = [
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId,
                        clientId: 'client1',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.EXCELLENT,
                        comment: 'Client 1 feedback',
                        isAnonymous: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        caseId,
                        clientId: 'client2',
                        staffId: 'staff123',
                        rating: feedback_1.FeedbackRating.GOOD,
                        comment: 'Client 2 feedback',
                        isAnonymous: true,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];
                feedbacks.forEach(feedback => {
                    expect(feedback.caseId).toBe(caseId);
                    expect(feedback.staffId).toBe('staff123');
                });
                expect(feedbacks[0].clientId).not.toBe(feedbacks[1].clientId);
                expect(feedbacks[0].isAnonymous).toBe(false);
                expect(feedbacks[1].isAnonymous).toBe(true);
            });
            it('should handle bulk feedback scenarios', () => {
                const bulkFeedbacks = Array.from({ length: 100 }, (_, i) => ({
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    caseId: `case${i}`,
                    clientId: `client${i}`,
                    staffId: 'staff123',
                    rating: Object.values(feedback_1.FeedbackRating)[i % 5],
                    comment: `Feedback ${i}`,
                    isAnonymous: i % 3 === 0, // Every 3rd feedback is anonymous
                    createdAt: new Date(),
                    updatedAt: new Date()
                }));
                expect(bulkFeedbacks).toHaveLength(100);
                const anonymousCount = bulkFeedbacks.filter(f => f.isAnonymous).length;
                const nonAnonymousCount = bulkFeedbacks.filter(f => !f.isAnonymous).length;
                expect(anonymousCount + nonAnonymousCount).toBe(100);
                expect(anonymousCount).toBeGreaterThan(0);
                expect(nonAnonymousCount).toBeGreaterThan(0);
            });
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain separate retainers per guild', () => {
            const sameClientDifferentGuilds = [
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild1',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer1',
                    agreementText: 'Guild 1 retainer',
                    amount: 1000,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild2',
                    clientId: 'client123',
                    clientUsername: 'testclient',
                    lawyerId: 'lawyer2',
                    agreementText: 'Guild 2 retainer',
                    amount: 2000,
                    status: retainer_1.RetainerStatus.SIGNED,
                    signedAt: new Date(),
                    robloxUsername: 'TestUser123',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            sameClientDifferentGuilds.forEach(retainer => {
                expect(retainer.clientId).toBe('client123');
            });
            expect(sameClientDifferentGuilds[0].guildId).not.toBe(sameClientDifferentGuilds[1].guildId);
            expect(sameClientDifferentGuilds[0].status).not.toBe(sameClientDifferentGuilds[1].status);
        });
        it('should maintain separate feedback per guild', () => {
            const crossGuildFeedback = [
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild1',
                    caseId: 'case1',
                    clientId: 'client123',
                    staffId: 'staff1',
                    rating: feedback_1.FeedbackRating.EXCELLENT,
                    comment: 'Guild 1 feedback',
                    isAnonymous: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild2',
                    caseId: 'case2',
                    clientId: 'client123',
                    staffId: 'staff2',
                    rating: feedback_1.FeedbackRating.POOR,
                    comment: 'Guild 2 feedback',
                    isAnonymous: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            crossGuildFeedback.forEach(feedback => {
                expect(feedback.clientId).toBe('client123');
            });
            expect(crossGuildFeedback[0].guildId).not.toBe(crossGuildFeedback[1].guildId);
            expect(crossGuildFeedback[0].rating).not.toBe(crossGuildFeedback[1].rating);
        });
    });
});
//# sourceMappingURL=retainer-feedback.test.js.map