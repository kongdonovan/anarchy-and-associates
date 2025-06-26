/**
 * Anarchy & Associates Discord server setup configuration.
 * Edit as needed for your organization.
 * @module config/anarchy-server-config
 */

import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { JobQuestion } from '../domain/entities/job';

// Category and channel definitions
const INFORMATION_CATEGORY = {
  name: 'Information',
  channels: [
    { name: 'welcome', type: ChannelType.GuildText },
    { name: 'rules', type: ChannelType.GuildText },
    { name: 'faq', type: ChannelType.GuildText },
    { name: 'announcements', type: ChannelType.GuildText },
  ],
};

const CLIENT_SERVICES_CATEGORY = {
  name: 'Client Services',
  channels: [
    { name: 'client-lobby', type: ChannelType.GuildText },
    { name: 'bot-commands', type: ChannelType.GuildText },
    { name: 'feedback', type: ChannelType.GuildText },
    { name: 'client-voice', type: ChannelType.GuildVoice },
  ],
};

const CASE_REVIEWS_CATEGORY = {
  name: 'Case Reviews',
  channels: [] as Array<{ name: string; type: ChannelType }>,
};

const CASE_ARCHIVES_CATEGORY = {
  name: 'Case Archives',
  channels: [] as Array<{ name: string; type: ChannelType }>,
};

const LEGAL_TEAM_CATEGORY = {
  name: 'Legal Team',
  channels: [
    { name: 'lawyer-lounge', type: ChannelType.GuildText },
    { name: 'paralegal-hub', type: ChannelType.GuildText },
    { name: 'team-voice', type: ChannelType.GuildVoice },
  ],
};

const STAFF_CATEGORY = {
  name: 'Staff',
  channels: [
    { name: 'staff-announcements', type: ChannelType.GuildText },
    { name: 'staff-chat', type: ChannelType.GuildText },
    { name: 'applications', type: ChannelType.GuildText },
    { name: 'signed-retainers', type: ChannelType.GuildText },
    { name: 'staff-voice', type: ChannelType.GuildVoice },
  ],
};

const ADMINISTRATION_CATEGORY = {
  name: 'Administration',
  channels: [
    { name: 'modlog', type: ChannelType.GuildText },
    { name: 'admin-chat', type: ChannelType.GuildText },
    { name: 'admin-voice', type: ChannelType.GuildVoice },
  ],
};

// Role definitions
const ROLES = [
  {
    name: 'Managing Partner',
    color: 'DarkRed',
    permissions: [PermissionFlagsBits.Administrator],
    hoist: true,
    mentionable: true,
    maxCount: 1,
  },
  {
    name: 'Senior Partner',
    color: 'Red',
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
    maxCount: 3,
  },
  {
    name: 'Partner',
    color: 'Red',
    permissions: [
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
    maxCount: 5,
  },
  {
    name: 'Senior Associate',
    color: 'Blue',
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
    maxCount: 10,
  },
  {
    name: 'Associate',
    color: 'Aqua',
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
    maxCount: 10,
  },
  {
    name: 'Paralegal',
    color: 'Purple',
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
    maxCount: 10,
  },
  {
    name: 'Client',
    color: 'Green',
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
  },
  {
    name: 'Hiring Staff',
    color: 'Orange',
    permissions: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
    ],
    hoist: true,
    mentionable: true,
    maxCount: 5,
  },
];

// Job definitions
const DEFAULT_JOBS = [
  {
    title: 'Managing Partner',
    description: 'Firm leader setting strategy & culture.',
    roleName: 'Managing Partner',
    isOpenByDefault: false,
    autoCreateOnSetup: true,
    customQuestions: [
      {
        id: 'leadership',
        question: 'Outline your leadership vision.',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
      {
        id: 'growth',
        question: 'How will you grow the firm?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
    ] as JobQuestion[],
  },
  {
    title: 'Senior Partner',
    description: 'Heads practice groups and mentors partners.',
    roleName: 'Senior Partner',
    isOpenByDefault: true,
    autoCreateOnSetup: true,
    customQuestions: [
      {
        id: 'wins',
        question: 'Share a major litigation win.',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
      {
        id: 'mentorship',
        question: 'How do you mentor partners?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
    ] as JobQuestion[],
  },
  {
    title: 'Partner',
    description: 'Leads cases, manages clients and teams.',
    roleName: 'Partner',
    isOpenByDefault: true,
    autoCreateOnSetup: true,
    customQuestions: [
      {
        id: 'exp',
        question: 'Describe your leadership experience.',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
      {
        id: 'vision',
        question: 'What is your vision for the firm?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
    ] as JobQuestion[],
  },
  {
    title: 'Senior Associate',
    description: 'Handles complex research and key briefs.',
    roleName: 'Senior Associate',
    isOpenByDefault: true,
    autoCreateOnSetup: true,
    customQuestions: [
      {
        id: 'research',
        question: 'How good are you at legal research?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
      {
        id: 'coach',
        question: 'How do you coach associates?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
    ] as JobQuestion[],
  },
  {
    title: 'Associate',
    description: 'Entry‑level lawyer assisting on matters.',
    roleName: 'Associate',
    isOpenByDefault: true,
    autoCreateOnSetup: true,
    customQuestions: [
      {
        id: 'exp',
        question: 'How well do you work in a team?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
    ] as JobQuestion[],
  },
  {
    title: 'Paralegal',
    description: 'Supports attorneys with documents & filings.',
    roleName: 'Paralegal',
    isOpenByDefault: true,
    autoCreateOnSetup: true,
    customQuestions: [
      {
        id: 'skills',
        question: 'How much attention to detail do you have?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
      {
        id: 'tools',
        question: 'How well do you work in a team?',
        type: 'paragraph' as const,
        required: true,
        maxLength: 1000,
      },
    ] as JobQuestion[],
  },
];

export interface AnarchyServerConfig {
  categories: Array<{
    name: string;
    channels: Array<{ name: string; type: ChannelType }>;
  }>;
  roles: Array<{
    name: string;
    color: string;
    permissions: bigint[];
    hoist: boolean;
    mentionable: boolean;
    maxCount?: number;
  }>;
  defaultJobs: Array<{
    title: string;
    description: string;
    roleName: string;
    isOpenByDefault: boolean;
    autoCreateOnSetup: boolean;
    customQuestions: JobQuestion[];
  }>;
}

// Compose SERVER_SETUP from extracted constants for maintainability.
export const ANARCHY_SERVER_CONFIG: AnarchyServerConfig = {
  categories: [
    INFORMATION_CATEGORY,
    CLIENT_SERVICES_CATEGORY,
    CASE_REVIEWS_CATEGORY,
    CASE_ARCHIVES_CATEGORY,
    LEGAL_TEAM_CATEGORY,
    STAFF_CATEGORY,
    ADMINISTRATION_CATEGORY,
  ],
  roles: ROLES,
  defaultJobs: DEFAULT_JOBS,
};

/**
 * Default permission actions to assign to each role during server setup.
 * Key: role name, Value: array of permission actions
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  'Managing Partner': ['admin', 'config', 'case', 'senior-staff', 'retainer', 'repair'],
  'Senior Partner': ['case', 'senior-staff', 'retainer'],
  Partner: ['case', 'senior-staff', 'retainer'],
  'Senior Associate': ['case', 'retainer'],
  Associate: ['case', 'retainer'],
  Paralegal: ['case', 'retainer'],
  'Hiring Staff': ['senior-staff'],
  // "Client": [] // Clients get no elevated permissions
};

/**
 * Maps GuildConfig keys to logical channel/category names for auto-setup.
 * Change this mapping to update which channels/categories are used for each config key.
 */
export const DEFAULT_CHANNEL_MAPPINGS: Record<
  string,
  { name: string; type: 'GUILD_TEXT' | 'GUILD_CATEGORY' }
> = {
  feedbackChannelId: { name: 'feedback', type: 'GUILD_TEXT' },
  caseReviewCategoryId: { name: 'Case Reviews', type: 'GUILD_CATEGORY' },
  modlogChannelId: { name: 'modlog', type: 'GUILD_TEXT' },
  applicationChannelId: { name: 'applications', type: 'GUILD_TEXT' },
  retainerChannelId: { name: 'signed-retainers', type: 'GUILD_TEXT' },
  caseArchiveCategoryId: { name: 'Case Archives', type: 'GUILD_CATEGORY' },
};
