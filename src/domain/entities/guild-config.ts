import { BaseEntity } from './base';

export interface GuildConfig extends BaseEntity {
  guildId: string;
  feedbackChannelId?: string;
  retainerChannelId?: string;
  caseReviewCategoryId?: string;
  caseArchiveCategoryId?: string;
  modlogChannelId?: string;
  applicationChannelId?: string;
  clientRoleId?: string;
  permissions: {
    admin: string[];
    'senior-staff': string[]; // Renamed from hr, broader scope
    case: string[];
    config: string[];
    lawyer: string[]; // New: replaces retainer, for legal practice
    'lead-attorney': string[]; // New: for lead attorney assignments
    repair: string[];
  };
  adminRoles: string[];
  adminUsers: string[];
  channelCleanupConfig?: {
    scanInterval: number;
    inactivityThreshold: number;
    archiveThreshold: number;
    deleteThreshold: number;
    batchSize: number;
    enableAutoCleanup: boolean;
    notificationChannelId?: string;
    excludedCategories: string[];
    excludedChannels: string[];
  };
}