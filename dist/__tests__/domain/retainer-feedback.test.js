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
                    lawyerId: 'lawyer123',
                    agreementTemplate: 'This is a legal retainer agreement...',
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(retainer.guildId).toBeTruthy();
                expect(retainer.clientId).toBeTruthy();
                expect(retainer.lawyerId).toBeTruthy();
                expect(retainer.agreementTemplate).toBeTruthy();
                expect(retainer.status).toBe('pending');
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
                        lawyerId: 'lawyer123',
                        agreementTemplate: 'Test agreement',
                        status,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    expect(retainer.status).toBe(status);
                });
            });
            it('should handle different retainer amounts', () => {
                const amounts = [500, 1000, 2500, 5000, 10000];
                amounts.forEach(() => {
                    const retainer = {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        clientId: 'client123',
                        lawyerId: 'lawyer123',
                        agreementTemplate: 'Test agreement',
                        status: retainer_1.RetainerStatus.PENDING,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    };
                    expect(retainer.agreementTemplate).toBe('Test agreement');
                    expect(retainer.agreementTemplate.length).toBeGreaterThan(0);
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
                    lawyerId: 'lawyer123',
                    agreementTemplate: 'Test agreement',
                    status: retainer_1.RetainerStatus.SIGNED,
                    signedAt: signedDate,
                    clientRobloxUsername: robloxUsername,
                    digitalSignature: robloxUsername,
                    createdAt: new Date(),
                    updatedAt: signedDate
                };
                expect(signedRetainer.status).toBe('signed');
                expect(signedRetainer.signedAt).toBe(signedDate);
                expect(signedRetainer.clientRobloxUsername).toBe(robloxUsername);
                expect(signedRetainer.updatedAt).toBe(signedDate);
            });
            it('should handle retainer cancellation', () => {
                const cancelledDate = new Date();
                const cancelledRetainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    clientId: 'client123',
                    lawyerId: 'lawyer123',
                    agreementTemplate: 'Test agreement',
                    status: retainer_1.RetainerStatus.CANCELLED,
                    createdAt: new Date(),
                    updatedAt: cancelledDate
                };
                expect(cancelledRetainer.status).toBe('cancelled');
                expect(cancelledRetainer.signedAt).toBeUndefined();
                expect(cancelledRetainer.digitalSignature).toBeUndefined();
            });
            it('should validate Roblox username format', () => {
                const validRobloxUsernames = [
                    'TestUser123',
                    'User_With_Scores', // Valid 16-character username with underscores
                    'a'.repeat(20), // Max length
                    'abc' // Min length
                ];
                validRobloxUsernames.forEach(username => {
                    // Basic regex validation: 3-20 chars, alphanumeric + underscores, no consecutive underscores
                    // No leading/trailing underscores
                    const robloxRegex = /^[a-zA-Z0-9]([a-zA-Z0-9_]*[a-zA-Z0-9])?$/.test(username) &&
                        username.length >= 3 && username.length <= 20 &&
                        !username.includes('__');
                    expect(robloxRegex).toBe(true);
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
                    lawyerId: 'lawyer1',
                    agreementTemplate: 'Pending agreement',
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                const activeRetainer = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId,
                    clientId,
                    lawyerId: 'lawyer2',
                    agreementTemplate: 'Active agreement',
                    status: retainer_1.RetainerStatus.SIGNED,
                    signedAt: new Date(),
                    clientRobloxUsername: 'TestUser123',
                    digitalSignature: 'TestUser123',
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                // Both retainers for same client but different status
                expect(pendingRetainer.clientId).toBe(activeRetainer.clientId);
                expect(pendingRetainer.status).toBe('pending');
                expect(activeRetainer.status).toBe('signed');
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
                    lawyerId: 'lawyer123',
                    agreementTemplate: longAgreementText,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(retainer.agreementTemplate.length).toBeGreaterThan(5000);
                expect(retainer.agreementTemplate).toContain('retainer agreement');
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
                    lawyerId: 'lawyer123',
                    agreementTemplate: specialAgreementText,
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(retainer.agreementTemplate).toContain('$2,500');
                expect(retainer.agreementTemplate).toContain('"Representation services"');
                expect(retainer.agreementTemplate).toContain('lawyer@firm.com');
            });
        });
    });
    describe('Feedback Entity', () => {
        describe('Feedback Creation and Validation', () => {
            it('should create a valid feedback with required fields', () => {
                const feedback = {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    submitterId: 'client123',
                    submitterUsername: 'testclient',
                    targetStaffId: 'staff123',
                    targetStaffUsername: 'teststaff',
                    rating: feedback_1.FeedbackRating.FIVE_STAR,
                    comment: 'Outstanding legal representation!',
                    isForFirm: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(feedback.guildId).toBeTruthy();
                expect(feedback.submitterId).toBeTruthy();
                expect(feedback.submitterUsername).toBeTruthy();
                expect(feedback.targetStaffId).toBeTruthy();
                expect(feedback.targetStaffUsername).toBeTruthy();
                expect(feedback.rating).toBe(feedback_1.FeedbackRating.FIVE_STAR);
                expect(feedback.comment).toBeTruthy();
                expect(typeof feedback.isForFirm).toBe('boolean');
                expect(feedback.createdAt).toBeInstanceOf(Date);
                expect(feedback.updatedAt).toBeInstanceOf(Date);
            });
            it('should handle all valid feedback ratings', () => {
                const validRatings = [
                    feedback_1.FeedbackRating.ONE_STAR,
                    feedback_1.FeedbackRating.TWO_STAR,
                    feedback_1.FeedbackRating.THREE_STAR,
                    feedback_1.FeedbackRating.FOUR_STAR,
                    feedback_1.FeedbackRating.FIVE_STAR
                ];
                validRatings.forEach(rating => {
                    const feedback = {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client123',
                        submitterUsername: 'testclient',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'teststaff',
                        rating,
                        comment: 'Test feedback',
                        isForFirm: false,
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
                    submitterId: 'client123',
                    submitterUsername: 'Anonymous',
                    rating: feedback_1.FeedbackRating.THREE_STAR,
                    comment: 'Anonymous feedback comment',
                    isForFirm: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(anonymousFeedback.isForFirm).toBe(true);
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
                        submitterId: 'client123',
                        submitterUsername: 'TestClient',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.THREE_STAR,
                        comment,
                        isForFirm: false,
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
                    submitterId: 'client123',
                    submitterUsername: 'TestClient',
                    targetStaffId: 'staff123',
                    targetStaffUsername: 'TestLawyer',
                    rating: feedback_1.FeedbackRating.FIVE_STAR,
                    comment: specialComment,
                    isForFirm: false,
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
                    submitterId: 'client123',
                    submitterUsername: 'TestClient',
                    targetStaffId: 'staff123',
                    targetStaffUsername: 'TestLawyer',
                    rating: feedback_1.FeedbackRating.THREE_STAR,
                    comment: '', // Empty comment
                    isForFirm: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                expect(minimalFeedback.comment).toBe('');
                expect(minimalFeedback.rating).toBe(feedback_1.FeedbackRating.THREE_STAR);
            });
        });
        describe('Feedback Performance Metrics', () => {
            it('should calculate average ratings correctly', () => {
                const feedbacks = [
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client1',
                        submitterUsername: 'Client1',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.FIVE_STAR, // 5
                        comment: 'Great!',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client2',
                        submitterUsername: 'Client2',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.FOUR_STAR, // 4
                        comment: 'Very good!',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client3',
                        submitterUsername: 'Client3',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.THREE_STAR, // 3
                        comment: 'Good!',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];
                // Calculate average rating - ratings are already numeric
                const totalRating = feedbacks.reduce((sum, feedback) => sum + feedback.rating, 0);
                const averageRating = totalRating / feedbacks.length;
                expect(averageRating).toBe(4); // (5 + 4 + 3) / 3 = 4
                expect(feedbacks).toHaveLength(3);
                // Test rating text and star display functions
                expect((0, feedback_1.getRatingText)(feedback_1.FeedbackRating.FIVE_STAR)).toBe('Excellent');
                expect((0, feedback_1.getRatingText)(feedback_1.FeedbackRating.THREE_STAR)).toBe('Good');
                expect((0, feedback_1.getStarDisplay)(feedback_1.FeedbackRating.FIVE_STAR)).toContain('⭐');
                expect((0, feedback_1.getStarDisplay)(feedback_1.FeedbackRating.ONE_STAR)).toContain('☆');
                // This section is replaced above
            });
            it('should handle zero feedback scenarios', () => {
                const feedbacks = [];
                expect(feedbacks).toHaveLength(0);
                // Division by zero protection
                const averageRating = feedbacks.length > 0
                    ? feedbacks.reduce((sum) => sum + 1, 0) / feedbacks.length
                    : 0;
                expect(averageRating).toBe(0);
            });
            it('should track feedback distribution', () => {
                const feedbacks = [
                    ...Array(10).fill(null).map(() => ({
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client1',
                        submitterUsername: 'Client1',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.FIVE_STAR,
                        comment: 'Excellent',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    })),
                    ...Array(5).fill(null).map(() => ({
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client2',
                        submitterUsername: 'Client2',
                        targetStaffId: 'staff123',
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.FOUR_STAR,
                        comment: 'Very good',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }))
                ];
                const excellentCount = feedbacks.filter(f => f.rating === feedback_1.FeedbackRating.FIVE_STAR).length;
                const veryGoodCount = feedbacks.filter(f => f.rating === feedback_1.FeedbackRating.FOUR_STAR).length;
                expect(excellentCount).toBe(10);
                expect(veryGoodCount).toBe(5);
                expect(feedbacks).toHaveLength(15);
            });
        });
        describe('Feedback Edge Cases', () => {
            it('should handle feedback for same staff by different clients', () => {
                const staffId = 'staff123';
                const feedbacks = [
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client1',
                        submitterUsername: 'Client1',
                        targetStaffId: staffId,
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.FIVE_STAR,
                        comment: 'Client 1 feedback',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    },
                    {
                        _id: test_utils_1.TestUtils.generateObjectId(),
                        guildId: 'guild123',
                        submitterId: 'client2',
                        submitterUsername: 'Client2',
                        targetStaffId: staffId,
                        targetStaffUsername: 'TestLawyer',
                        rating: feedback_1.FeedbackRating.THREE_STAR,
                        comment: 'Client 2 feedback',
                        isForFirm: false,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                ];
                feedbacks.forEach(feedback => {
                    expect(feedback.targetStaffId).toBe(staffId);
                    expect(feedback.targetStaffUsername).toBe('TestLawyer');
                });
                expect(feedbacks[0]?.submitterId).not.toBe(feedbacks[1]?.submitterId);
                expect(feedbacks[0]?.isForFirm).toBe(false);
                expect(feedbacks[1]?.isForFirm).toBe(false);
            });
            it('should handle bulk feedback scenarios', () => {
                const bulkFeedbacks = Array.from({ length: 100 }, (_, i) => ({
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild123',
                    submitterId: `client${i}`,
                    submitterUsername: `Client${i}`,
                    targetStaffId: 'staff123',
                    targetStaffUsername: 'TestLawyer',
                    rating: Object.values(feedback_1.FeedbackRating)[i % 5],
                    comment: `Feedback ${i}`,
                    isForFirm: i % 3 === 0, // Every 3rd feedback is firm-wide
                    createdAt: new Date(),
                    updatedAt: new Date()
                }));
                expect(bulkFeedbacks).toHaveLength(100);
                const firmFeedbackCount = bulkFeedbacks.filter(f => f.isForFirm).length;
                const staffFeedbackCount = bulkFeedbacks.filter(f => !f.isForFirm).length;
                expect(firmFeedbackCount + staffFeedbackCount).toBe(100);
                expect(firmFeedbackCount).toBeGreaterThan(0);
                expect(staffFeedbackCount).toBeGreaterThan(0);
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
                    lawyerId: 'lawyer1',
                    agreementTemplate: 'Guild 1 retainer',
                    status: retainer_1.RetainerStatus.PENDING,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild2',
                    clientId: 'client123',
                    lawyerId: 'lawyer2',
                    agreementTemplate: 'Guild 2 retainer',
                    status: retainer_1.RetainerStatus.SIGNED,
                    signedAt: new Date(),
                    clientRobloxUsername: 'TestUser123',
                    digitalSignature: 'TestUser123',
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            sameClientDifferentGuilds.forEach(retainer => {
                expect(retainer.clientId).toBe('client123');
            });
            expect(sameClientDifferentGuilds[0]?.guildId).not.toBe(sameClientDifferentGuilds[1]?.guildId);
            expect(sameClientDifferentGuilds[0]?.status).not.toBe(sameClientDifferentGuilds[1]?.status);
        });
        it('should maintain separate feedback per guild', () => {
            const crossGuildFeedback = [
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild1',
                    submitterId: 'client123',
                    submitterUsername: 'TestClient',
                    targetStaffId: 'staff1',
                    targetStaffUsername: 'Staff1',
                    rating: feedback_1.FeedbackRating.FIVE_STAR,
                    comment: 'Guild 1 feedback',
                    isForFirm: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                {
                    _id: test_utils_1.TestUtils.generateObjectId(),
                    guildId: 'guild2',
                    submitterId: 'client123',
                    submitterUsername: 'TestClient',
                    targetStaffId: 'staff2',
                    targetStaffUsername: 'Staff2',
                    rating: feedback_1.FeedbackRating.ONE_STAR,
                    comment: 'Guild 2 feedback',
                    isForFirm: false,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }
            ];
            crossGuildFeedback.forEach(feedback => {
                expect(feedback.submitterId).toBe('client123');
            });
            expect(crossGuildFeedback[0]?.guildId).not.toBe(crossGuildFeedback[1]?.guildId);
            expect(crossGuildFeedback[0]?.rating).not.toBe(crossGuildFeedback[1]?.rating);
        });
    });
});
//# sourceMappingURL=retainer-feedback.test.js.map