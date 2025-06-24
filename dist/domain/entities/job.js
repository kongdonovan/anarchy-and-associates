"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_JOB_QUESTIONS = exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus["OPEN"] = "open";
    JobStatus["CLOSED"] = "closed";
    JobStatus["REMOVED"] = "removed";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
// Default questions for all job applications
exports.DEFAULT_JOB_QUESTIONS = [
    {
        id: 'roblox_username',
        question: 'What is your Roblox username?',
        type: 'short',
        required: true,
        placeholder: 'Enter your Roblox username',
        maxLength: 20,
    },
    {
        id: 'legal_experience',
        question: 'Describe your legal experience.',
        type: 'paragraph',
        required: true,
        placeholder: 'Detail your legal background, cases, or relevant experience...',
        maxLength: 1000,
    },
    {
        id: 'legal_knowledge',
        question: 'What areas of law interest you most?',
        type: 'paragraph',
        required: true,
        placeholder: 'Criminal, civil, corporate, family law, etc.',
        maxLength: 500,
    },
    {
        id: 'availability',
        question: 'Weekly hours you can commit?',
        type: 'choice',
        required: true,
        choices: ['Less than 5 hours', '5-10 hours', '10-20 hours', '20+ hours'],
    },
    {
        id: 'motivation',
        question: 'Why do you want to work at our firm?',
        type: 'paragraph',
        required: true,
        placeholder: 'What attracts you to Anarchy & Associates?',
        maxLength: 750,
    },
];
//# sourceMappingURL=job.js.map