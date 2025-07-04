"use strict";
/**
 * Anarchy & Associates Discord server setup configuration.
 * Edit as needed for your organization.
 * @module config/anarchy-server-config
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CATEGORY_PERMISSIONS = exports.DEFAULT_CHANNEL_MAPPINGS = exports.DEFAULT_ROLE_PERMISSIONS = exports.ANARCHY_SERVER_CONFIG = void 0;
const discord_js_1 = require("discord.js");
// Category and channel definitions
const INFORMATION_CATEGORY = {
    name: 'Information',
    channels: [
        { name: 'welcome', type: discord_js_1.ChannelType.GuildText },
        { name: 'rules', type: discord_js_1.ChannelType.GuildText },
        { name: 'faq', type: discord_js_1.ChannelType.GuildText },
        { name: 'announcements', type: discord_js_1.ChannelType.GuildText },
    ],
};
const LOBBY_CATEGORY = {
    name: 'Lobby',
    channels: [
        { name: 'general-chat', type: discord_js_1.ChannelType.GuildText },
        { name: 'bot-commands', type: discord_js_1.ChannelType.GuildText },
        { name: 'feedback', type: discord_js_1.ChannelType.GuildText },
        { name: 'voice-lobby', type: discord_js_1.ChannelType.GuildVoice },
    ],
};
const CASE_REVIEWS_CATEGORY = {
    name: 'Case Reviews',
    channels: [],
};
const CASE_ARCHIVES_CATEGORY = {
    name: 'Case Archives',
    channels: [],
};
const LEGAL_TEAM_CATEGORY = {
    name: 'Legal Team',
    channels: [
        { name: 'lawyer-lounge', type: discord_js_1.ChannelType.GuildText },
        { name: 'paralegal-hub', type: discord_js_1.ChannelType.GuildText },
        { name: 'team-voice', type: discord_js_1.ChannelType.GuildVoice },
    ],
};
const STAFF_CATEGORY = {
    name: 'Staff',
    channels: [
        { name: 'staff-announcements', type: discord_js_1.ChannelType.GuildText },
        { name: 'staff-chat', type: discord_js_1.ChannelType.GuildText },
        { name: 'applications', type: discord_js_1.ChannelType.GuildText },
        { name: 'signed-retainers', type: discord_js_1.ChannelType.GuildText },
        { name: 'staff-voice', type: discord_js_1.ChannelType.GuildVoice },
    ],
};
const ADMINISTRATION_CATEGORY = {
    name: 'Administration',
    channels: [
        { name: 'modlog', type: discord_js_1.ChannelType.GuildText },
        { name: 'admin-chat', type: discord_js_1.ChannelType.GuildText },
        { name: 'admin-voice', type: discord_js_1.ChannelType.GuildVoice },
    ],
};
// Role definitions
const ROLES = [
    {
        name: 'Managing Partner',
        color: 'DarkRed',
        permissions: [discord_js_1.PermissionFlagsBits.Administrator],
        hoist: true,
        mentionable: true,
        maxCount: 1,
    },
    {
        name: 'Senior Partner',
        color: 'Red',
        permissions: [
            discord_js_1.PermissionFlagsBits.ManageChannels,
            discord_js_1.PermissionFlagsBits.ManageMessages,
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
        ],
        hoist: true,
        mentionable: true,
        maxCount: 3,
    },
    {
        name: 'Partner',
        color: 'Red',
        permissions: [
            discord_js_1.PermissionFlagsBits.ManageChannels,
            discord_js_1.PermissionFlagsBits.ManageMessages,
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
        ],
        hoist: true,
        mentionable: true,
        maxCount: 5,
    },
    {
        name: 'Senior Associate',
        color: 'Blue',
        permissions: [
            discord_js_1.PermissionFlagsBits.ManageMessages,
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
        ],
        hoist: true,
        mentionable: true,
        maxCount: 10,
    },
    {
        name: 'Associate',
        color: 'Aqua',
        permissions: [
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
        ],
        hoist: true,
        mentionable: true,
        maxCount: 10,
    },
    {
        name: 'Paralegal',
        color: 'Purple',
        permissions: [
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
        ],
        hoist: true,
        mentionable: true,
        maxCount: 10,
    },
    {
        name: 'Client',
        color: 'Green',
        permissions: [
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
        ],
        hoist: true,
        mentionable: true,
    },
    {
        name: 'Hiring Staff',
        color: 'Orange',
        permissions: [
            discord_js_1.PermissionFlagsBits.ViewChannel,
            discord_js_1.PermissionFlagsBits.SendMessages,
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
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
            {
                id: 'growth',
                question: 'How will you grow the firm?',
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
        ],
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
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
            {
                id: 'mentorship',
                question: 'How do you mentor partners?',
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
        ],
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
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
            {
                id: 'vision',
                question: 'What is your vision for the firm?',
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
        ],
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
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
            {
                id: 'coach',
                question: 'How do you coach associates?',
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
        ],
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
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
        ],
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
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
            {
                id: 'tools',
                question: 'How well do you work in a team?',
                type: 'paragraph',
                required: true,
                maxLength: 1000,
            },
        ],
    },
];
// Compose SERVER_SETUP from extracted constants for maintainability.
exports.ANARCHY_SERVER_CONFIG = {
    categories: [
        INFORMATION_CATEGORY,
        LOBBY_CATEGORY,
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
exports.DEFAULT_ROLE_PERMISSIONS = {
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
exports.DEFAULT_CHANNEL_MAPPINGS = {
    feedbackChannelId: { name: 'feedback', type: 'GUILD_TEXT' },
    caseReviewCategoryId: { name: 'Case Reviews', type: 'GUILD_CATEGORY' },
    modlogChannelId: { name: 'modlog', type: 'GUILD_TEXT' },
    applicationChannelId: { name: 'applications', type: 'GUILD_TEXT' },
    retainerChannelId: { name: 'signed-retainers', type: 'GUILD_TEXT' },
    caseArchiveCategoryId: { name: 'Case Archives', type: 'GUILD_CATEGORY' },
    defaultInformationChannelId: { name: 'welcome', type: 'GUILD_TEXT' },
    defaultRulesChannelId: { name: 'rules', type: 'GUILD_TEXT' },
};
/**
 * Category permission configurations for server setup
 * Defines how each category should be configured for different user groups
 */
exports.CATEGORY_PERMISSIONS = {
    'Information': {
        // Information channels are read-only for everyone
        everyone: {
            allow: [discord_js_1.PermissionFlagsBits.ViewChannel, discord_js_1.PermissionFlagsBits.ReadMessageHistory],
            deny: [discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.CreatePublicThreads, discord_js_1.PermissionFlagsBits.CreatePrivateThreads]
        },
        // Staff can manage messages in information channels
        staff: {
            allow: [discord_js_1.PermissionFlagsBits.SendMessages, discord_js_1.PermissionFlagsBits.ManageMessages, discord_js_1.PermissionFlagsBits.EmbedLinks, discord_js_1.PermissionFlagsBits.AttachFiles]
        }
    },
    'Lobby': {
        // Lobby is fully accessible to everyone
        everyone: {
            allow: [
                discord_js_1.PermissionFlagsBits.ViewChannel,
                discord_js_1.PermissionFlagsBits.SendMessages,
                discord_js_1.PermissionFlagsBits.ReadMessageHistory,
                discord_js_1.PermissionFlagsBits.AddReactions,
                discord_js_1.PermissionFlagsBits.UseExternalEmojis,
                discord_js_1.PermissionFlagsBits.AttachFiles,
                discord_js_1.PermissionFlagsBits.EmbedLinks,
                discord_js_1.PermissionFlagsBits.Connect, // For voice channels
                discord_js_1.PermissionFlagsBits.Speak // For voice channels
            ],
            deny: []
        }
    },
    'Legal Team': {
        // Legal team channels are restricted to legal staff only
        everyone: {
            deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
        },
        legalRoles: ['Managing Partner', 'Senior Partner', 'Partner', 'Senior Associate', 'Associate', 'Paralegal']
    },
    'Staff': {
        // Staff channels are restricted to all staff members
        everyone: {
            deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
        },
        staffRoles: ['Managing Partner', 'Senior Partner', 'Partner', 'Senior Associate', 'Associate', 'Paralegal', 'Hiring Staff']
    },
    'Administration': {
        // Admin channels are restricted to senior staff only
        everyone: {
            deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
        },
        adminRoles: ['Managing Partner', 'Senior Partner', 'Partner']
    },
    'Case Reviews': {
        // Case channels have special permissions set per channel
        everyone: {
            deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
        }
    },
    'Case Archives': {
        // Archived cases are view-only for authorized staff
        everyone: {
            deny: [discord_js_1.PermissionFlagsBits.ViewChannel]
        },
        archiveViewRoles: ['Managing Partner', 'Senior Partner', 'Partner']
    }
};
//# sourceMappingURL=server-setup.config.js.map