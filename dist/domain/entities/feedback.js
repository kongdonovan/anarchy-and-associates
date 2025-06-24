"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FeedbackRating = void 0;
exports.isValidRating = isValidRating;
exports.validateFeedbackSubmission = validateFeedbackSubmission;
exports.getStarDisplay = getStarDisplay;
exports.getRatingText = getRatingText;
var FeedbackRating;
(function (FeedbackRating) {
    FeedbackRating[FeedbackRating["ONE_STAR"] = 1] = "ONE_STAR";
    FeedbackRating[FeedbackRating["TWO_STAR"] = 2] = "TWO_STAR";
    FeedbackRating[FeedbackRating["THREE_STAR"] = 3] = "THREE_STAR";
    FeedbackRating[FeedbackRating["FOUR_STAR"] = 4] = "FOUR_STAR";
    FeedbackRating[FeedbackRating["FIVE_STAR"] = 5] = "FIVE_STAR";
})(FeedbackRating || (exports.FeedbackRating = FeedbackRating = {}));
// Validation helpers
function isValidRating(rating) {
    return Object.values(FeedbackRating).includes(rating);
}
function validateFeedbackSubmission(request) {
    const errors = [];
    if (!request.guildId || request.guildId.trim() === '') {
        errors.push('Guild ID is required');
    }
    if (!request.submitterId || request.submitterId.trim() === '') {
        errors.push('Submitter ID is required');
    }
    if (!request.submitterUsername || request.submitterUsername.trim() === '') {
        errors.push('Submitter username is required');
    }
    if (!isValidRating(request.rating)) {
        errors.push('Rating must be between 1 and 5 stars');
    }
    if (!request.comment || request.comment.trim() === '') {
        errors.push('Comment is required');
    }
    if (request.comment && request.comment.length > 1000) {
        errors.push('Comment cannot exceed 1000 characters');
    }
    // If targetStaffId is provided, targetStaffUsername should also be provided
    if (request.targetStaffId && !request.targetStaffUsername) {
        errors.push('Target staff username is required when staff ID is provided');
    }
    return errors;
}
function getStarDisplay(rating) {
    const filledStar = '⭐';
    const emptyStar = '☆';
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? filledStar : emptyStar;
    }
    return stars;
}
function getRatingText(rating) {
    switch (rating) {
        case FeedbackRating.ONE_STAR:
            return 'Poor';
        case FeedbackRating.TWO_STAR:
            return 'Fair';
        case FeedbackRating.THREE_STAR:
            return 'Good';
        case FeedbackRating.FOUR_STAR:
            return 'Very Good';
        case FeedbackRating.FIVE_STAR:
            return 'Excellent';
        default:
            return 'Unknown';
    }
}
//# sourceMappingURL=feedback.js.map