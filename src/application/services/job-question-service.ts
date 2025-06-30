import { JobQuestion } from '../../validation';
import { logger } from '../../infrastructure/logger';

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

export class JobQuestionService {
  private static readonly QUESTION_TEMPLATES: QuestionTemplate[] = [
    {
      id: 'portfolio_link',
      category: 'Experience',
      question: 'Please provide a link to your portfolio or relevant work samples',
      type: 'short',
      description: 'URL to portfolio or work samples',
      defaultRequired: false,
      suggestions: {
        placeholder: 'https://example.com/portfolio',
      },
    },
    {
      id: 'legal_experience',
      category: 'Experience',
      question: 'Describe your specific legal experience relevant to this position',
      type: 'paragraph',
      description: 'Detailed legal experience description',
      defaultRequired: true,
      suggestions: {
        maxLength: 1500,
        placeholder: 'Include specific areas of law, cases handled, years of experience...',
      },
    },
    {
      id: 'education_level',
      category: 'Education',
      question: 'What is your highest level of education?',
      type: 'choice',
      description: 'Educational background',
      defaultRequired: true,
      suggestions: {
        choices: ['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'Juris Doctor (JD)', 'PhD', 'Other'],
      },
    },
    {
      id: 'years_experience',
      category: 'Experience',
      question: 'How many years of legal experience do you have?',
      type: 'number',
      description: 'Years of professional legal experience',
      defaultRequired: true,
      suggestions: {
        minValue: 0,
        maxValue: 50,
      },
    },
    {
      id: 'bar_admission',
      category: 'Qualifications',
      question: 'In which jurisdictions are you admitted to practice law?',
      type: 'paragraph',
      description: 'Bar admissions and jurisdictions',
      defaultRequired: false,
      suggestions: {
        maxLength: 500,
        placeholder: 'List all jurisdictions where you are licensed to practice...',
      },
    },
    {
      id: 'specialization',
      category: 'Experience',
      question: 'What is your primary area of legal specialization?',
      type: 'choice',
      description: 'Legal practice area specialization',
      defaultRequired: false,
      suggestions: {
        choices: [
          'Corporate Law',
          'Criminal Law',
          'Family Law',
          'Personal Injury',
          'Real Estate',
          'Immigration',
          'Intellectual Property',
          'Employment Law',
          'Tax Law',
          'Environmental Law',
          'Other',
        ],
      },
    },
    {
      id: 'salary_expectation',
      category: 'Compensation',
      question: 'What is your salary expectation (annual, in USD)?',
      type: 'number',
      description: 'Expected annual salary',
      defaultRequired: false,
      suggestions: {
        minValue: 30000,
        maxValue: 500000,
      },
    },
    {
      id: 'start_date',
      category: 'Availability',
      question: 'When would you be available to start?',
      type: 'short',
      description: 'Available start date',
      defaultRequired: true,
      suggestions: {
        placeholder: 'e.g., Immediately, 2 weeks notice, specific date...',
      },
    },
    {
      id: 'reference_contact',
      category: 'References',
      question: 'Please provide contact information for a professional reference',
      type: 'paragraph',
      description: 'Professional reference details',
      defaultRequired: false,
      suggestions: {
        maxLength: 300,
        placeholder: 'Name, title, company, phone number, email...',
      },
    },
    {
      id: 'additional_certifications',
      category: 'Qualifications',
      question: 'List any additional certifications or professional qualifications',
      type: 'paragraph',
      description: 'Additional certifications and qualifications',
      defaultRequired: false,
      suggestions: {
        maxLength: 500,
        placeholder: 'Professional certifications, continuing education, specialized training...',
      },
    },
  ];

  public getQuestionTemplates(category?: string): QuestionTemplate[] {
    if (category) {
      return JobQuestionService.QUESTION_TEMPLATES.filter(
        template => template.category.toLowerCase() === category.toLowerCase()
      );
    }
    return JobQuestionService.QUESTION_TEMPLATES;
  }

  public getQuestionCategories(): string[] {
    const categories = new Set(
      JobQuestionService.QUESTION_TEMPLATES.map(template => template.category)
    );
    return Array.from(categories).sort();
  }

  public getTemplateById(id: string): QuestionTemplate | null {
    return JobQuestionService.QUESTION_TEMPLATES.find(template => template.id === id) || null;
  }

  public createQuestionFromTemplate(templateId: string, overrides?: Partial<JobQuestion>): JobQuestion | null {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return null;
    }

    const baseQuestion: JobQuestion = {
      id: template.id,
      question: template.question,
      type: template.type,
      required: template.defaultRequired,
      ...template.suggestions,
    };

    // Apply any overrides
    if (overrides) {
      Object.assign(baseQuestion, overrides);
    }

    return baseQuestion;
  }

  public validateQuestion(question: JobQuestion): QuestionValidationResult {
    try {
      // Check required fields
      if (!question.id || !question.question || !question.type) {
        return {
          valid: false,
          error: 'Questions must have id, question, and type fields',
        };
      }

      // Validate question ID format
      if (!/^[a-z0-9_]+$/.test(question.id)) {
        return {
          valid: false,
          error: 'Question ID must contain only lowercase letters, numbers, and underscores',
        };
      }

      // Validate question types
      if (!['short', 'paragraph', 'number', 'choice'].includes(question.type)) {
        return {
          valid: false,
          error: `Invalid question type: ${question.type}`,
        };
      }

      // Validate choice questions have choices
      if (question.type === 'choice' && (!question.choices || question.choices.length === 0)) {
        return {
          valid: false,
          error: 'Choice questions must have at least one choice option',
        };
      }

      // Validate choice options
      if (question.type === 'choice' && question.choices) {
        for (const choice of question.choices) {
          if (!choice || choice.trim().length === 0) {
            return {
              valid: false,
              error: 'Choice options cannot be empty',
            };
          }
          if (choice.length > 100) {
            return {
              valid: false,
              error: 'Choice options must be 100 characters or less',
            };
          }
        }

        // Check for duplicate choices
        const uniqueChoices = new Set(question.choices.map(c => c.toLowerCase()));
        if (uniqueChoices.size !== question.choices.length) {
          return {
            valid: false,
            error: 'Choice options must be unique',
          };
        }
      }

      // Validate number constraints
      if (question.type === 'number') {
        if (question.minValue !== undefined && question.maxValue !== undefined) {
          if (question.minValue >= question.maxValue) {
            return {
              valid: false,
              error: 'minValue must be less than maxValue for number questions',
            };
          }
        }
        if (question.minValue !== undefined && question.minValue < 0) {
          return {
            valid: false,
            error: 'minValue cannot be negative',
          };
        }
      }

      // Validate text length constraints
      if ((question.type === 'short' || question.type === 'paragraph') && question.maxLength) {
        if (question.maxLength <= 0) {
          return {
            valid: false,
            error: 'maxLength must be greater than 0 for text questions',
          };
        }
        if (question.type === 'short' && question.maxLength > 500) {
          return {
            valid: false,
            error: 'Short text questions cannot have maxLength greater than 500 characters',
          };
        }
        if (question.type === 'paragraph' && question.maxLength > 5000) {
          return {
            valid: false,
            error: 'Paragraph questions cannot have maxLength greater than 5000 characters',
          };
        }
      }

      // Validate question text length
      if (question.question.length < 10) {
        return {
          valid: false,
          error: 'Question text must be at least 10 characters long',
        };
      }
      if (question.question.length > 500) {
        return {
          valid: false,
          error: 'Question text cannot exceed 500 characters',
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validating job question:', error);
      return {
        valid: false,
        error: 'Failed to validate question',
      };
    }
  }

  public validateQuestionList(questions: JobQuestion[]): QuestionValidationResult {
    try {
      if (questions.length === 0) {
        return {
          valid: false,
          error: 'At least one question is required',
        };
      }

      if (questions.length > 50) {
        return {
          valid: false,
          error: 'Cannot have more than 50 questions per job',
        };
      }

      // Validate each question individually
      for (const question of questions) {
        const questionValidation = this.validateQuestion(question);
        if (!questionValidation.valid) {
          return questionValidation;
        }
      }

      // Check for duplicate question IDs
      const questionIds = questions.map(q => q.id);
      const uniqueIds = new Set(questionIds);
      if (questionIds.length !== uniqueIds.size) {
        return {
          valid: false,
          error: 'Question IDs must be unique',
        };
      }

      // Validate required question count
      const requiredQuestions = questions.filter(q => q.required);
      if (requiredQuestions.length > 20) {
        return {
          valid: false,
          error: 'Cannot have more than 20 required questions',
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Error validating question list:', error);
      return {
        valid: false,
        error: 'Failed to validate question list',
      };
    }
  }

  public mergeQuestionsWithDefaults(customQuestions: JobQuestion[]): JobQuestion[] {
    // Get default questions
    const defaultQuestions = [
      {
        id: 'roblox_username',
        question: 'What is your Roblox username?',
        type: 'short' as const,
        required: true,
        placeholder: 'Enter your Roblox username',
        maxLength: 20,
      },
      {
        id: 'experience',
        question: 'Tell us about your relevant experience for this role.',
        type: 'paragraph' as const,
        required: true,
        placeholder: 'Describe your experience, skills, and qualifications...',
        maxLength: 1000,
      },
      {
        id: 'availability',
        question: 'How many hours per week can you commit to this role?',
        type: 'choice' as const,
        required: true,
        choices: ['Less than 5 hours', '5-10 hours', '10-20 hours', '20+ hours'],
      },
    ];

    // Filter out custom questions that have the same ID as default questions
    const filteredCustomQuestions = customQuestions.filter(
      custom => !defaultQuestions.some(def => def.id === custom.id)
    );

    // Return merged list with defaults first
    return [...defaultQuestions, ...filteredCustomQuestions];
  }

  public generateQuestionPreview(question: JobQuestion): string {
    let preview = `**${question.question}**`;
    
    if (question.required) {
      preview += ' *(Required)*';
    } else {
      preview += ' *(Optional)*';
    }

    preview += `\nType: ${question.type}`;

    if (question.type === 'choice' && question.choices) {
      preview += `\nOptions: ${question.choices.join(', ')}`;
    }

    if (question.type === 'number') {
      if (question.minValue !== undefined && question.maxValue !== undefined) {
        preview += `\nRange: ${question.minValue} - ${question.maxValue}`;
      } else if (question.minValue !== undefined) {
        preview += `\nMinimum: ${question.minValue}`;
      } else if (question.maxValue !== undefined) {
        preview += `\nMaximum: ${question.maxValue}`;
      }
    }

    if ((question.type === 'short' || question.type === 'paragraph') && question.maxLength) {
      preview += `\nMax Length: ${question.maxLength} characters`;
    }

    if (question.placeholder) {
      preview += `\nPlaceholder: "${question.placeholder}"`;
    }

    return preview;
  }

  public exportQuestionsAsJSON(questions: JobQuestion[]): string {
    return JSON.stringify(questions, null, 2);
  }

  public importQuestionsFromJSON(jsonString: string): { success: boolean; questions?: JobQuestion[]; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      
      if (!Array.isArray(parsed)) {
        return {
          success: false,
          error: 'JSON must contain an array of questions',
        };
      }

      const questions = parsed as JobQuestion[];
      const validation = this.validateQuestionList(questions);
      
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }

      return {
        success: true,
        questions,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid JSON format',
      };
    }
  }
}