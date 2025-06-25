import { BaseEntity } from './base';

export interface Case extends BaseEntity {
  guildId: string;
  caseNumber: string; // Format: YYYY-NNNN-username
  clientId: string; // Discord user ID of the client
  clientUsername: string; // Discord username (for case number generation)
  title: string;
  description: string;
  status: CaseStatus;
  priority: CasePriority;
  leadAttorneyId?: string; // Discord user ID of lead attorney
  assignedLawyerIds: string[]; // Array of Discord user IDs of assigned lawyers
  channelId?: string; // Discord channel ID for this case
  result?: CaseResult; // Set when case is closed
  resultNotes?: string; // Additional notes about the result
  closedAt?: Date;
  closedBy?: string; // Discord user ID of who closed the case
  documents: CaseDocument[];
  notes: CaseNote[];
}

export enum CaseStatus {
  PENDING = 'pending', // Initial state when case review is requested
  IN_PROGRESS = 'in-progress', // Case has been accepted and is actively being worked on
  CLOSED = 'closed' // Case has been completed
}

export enum CasePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum CaseResult {
  WIN = 'win',
  LOSS = 'loss',
  SETTLEMENT = 'settlement',
  DISMISSED = 'dismissed',
  WITHDRAWN = 'withdrawn'
}

export interface CaseDocument {
  id: string;
  title: string;
  content: string; // Can contain URLs or text
  createdBy: string; // Discord user ID
  createdAt: Date;
}

export interface CaseNote {
  id: string;
  content: string;
  createdBy: string; // Discord user ID
  createdAt: Date;
  isInternal: boolean; // Whether note is visible to client
}

export interface CaseCreationRequest {
  guildId: string;
  clientId: string;
  clientUsername: string;
  title: string;
  description: string;
  priority?: CasePriority;
}

export interface CaseAssignmentRequest {
  caseId: string;
  lawyerId: string;
  assignedBy: string;
}

export interface CaseClosureRequest {
  caseId: string;
  result: CaseResult;
  resultNotes?: string;
  closedBy: string;
}

export interface CaseUpdateRequest {
  caseId: string;
  title?: string;
  description?: string;
  priority?: CasePriority;
  status?: CaseStatus;
  channelId?: string;
}

// Counter for sequential case number generation
export interface CaseCounter extends BaseEntity {
  guildId: string;
  year: number;
  count: number; // Current count for this year
}

// Helper function to generate case number
export function generateCaseNumber(year: number, count: number, username: string): string {
  const paddedCount = count.toString().padStart(4, '0');
  return `${year}-${paddedCount}-${username}`;
}

// Helper function to parse case number
export function parseCaseNumber(caseNumber: string): { year: number; count: number; username: string } | null {
  const match = caseNumber.match(/^(\d{4})-(\d{4})-(.+)$/);
  if (!match) return null;
  
  return {
    year: parseInt(match[1] || '0'),
    count: parseInt(match[2] || '0'),
    username: match[3] || ''
  };
}

// Helper function to generate channel name from case number
export function generateChannelName(caseNumber: string): string {
  const channelName = `case-${caseNumber}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  // Discord channel names have a 100 character limit
  return channelName.length > 100 ? channelName.substring(0, 100) : channelName;
}