import { BaseEntity } from './base';
import { StaffRole } from './staff-role';

export interface Job extends BaseEntity {
  guildId: string;
  title: string;
  description: string;
  staffRole: StaffRole | string; // Associated staff role - can be enum or custom string
  roleId: string; // Discord role ID for the job
  limit?: number; // Position limit (from role hierarchy)
  isOpen: boolean;
  questions: JobQuestion[];
  postedBy: string;
  closedAt?: Date;
  closedBy?: string;
  applicationCount: number; // Track number of applications
  hiredCount: number; // Track number of hired from this job
}

export interface JobQuestion {
  id: string;
  question: string;
  type: 'short' | 'paragraph' | 'number' | 'choice';
  required: boolean;
  choices?: string[];
  placeholder?: string;
  maxLength?: number; // For text inputs
  minValue?: number; // For number inputs
  maxValue?: number; // For number inputs
}

export enum JobStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  REMOVED = 'removed', // For automatic cleanup
}

// Default questions for all job applications
export const DEFAULT_JOB_QUESTIONS: JobQuestion[] = [
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