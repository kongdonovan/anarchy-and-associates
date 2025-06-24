import { JobQuestion } from '../../domain/entities/job';
export interface QuestionValidationResult {
    valid: boolean;
    error?: string;
}
export interface QuestionTemplate {
    id: string;
    category: string;
    question: string;
    type: 'short' | 'paragraph' | 'number' | 'choice';
    description: string;
    defaultRequired: boolean;
    suggestions?: {
        choices?: string[];
        placeholder?: string;
        maxLength?: number;
        minValue?: number;
        maxValue?: number;
    };
}
export declare class JobQuestionService {
    private static readonly QUESTION_TEMPLATES;
    getQuestionTemplates(category?: string): QuestionTemplate[];
    getQuestionCategories(): string[];
    getTemplateById(id: string): QuestionTemplate | null;
    createQuestionFromTemplate(templateId: string, overrides?: Partial<JobQuestion>): JobQuestion | null;
    validateQuestion(question: JobQuestion): QuestionValidationResult;
    validateQuestionList(questions: JobQuestion[]): QuestionValidationResult;
    mergeQuestionsWithDefaults(customQuestions: JobQuestion[]): JobQuestion[];
    generateQuestionPreview(question: JobQuestion): string;
    exportQuestionsAsJSON(questions: JobQuestion[]): string;
    importQuestionsFromJSON(jsonString: string): {
        success: boolean;
        questions?: JobQuestion[];
        error?: string;
    };
}
//# sourceMappingURL=job-question-service.d.ts.map