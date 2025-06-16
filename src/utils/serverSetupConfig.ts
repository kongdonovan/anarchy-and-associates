/**
 * Example server setup config for Anarchy & Associates Discord server structure.
 * Edit as needed for your organization.
 * @module utils/serverSetupConfig
 */

// L7: Extracted category/channel definitions for clarity and testability.
const INFORMATION_CATEGORY = {
  name: "Information",
  channels: [
    { name: "welcome", type: "GUILD_TEXT" },
    { name: "rules", type: "GUILD_TEXT" },
    { name: "faq", type: "GUILD_TEXT" },
    { name: "announcements", type: "GUILD_TEXT" }
  ]
};

const CLIENT_SERVICES_CATEGORY = {
  name: "Client Services",
  channels: [
    { name: "client-lobby", type: "GUILD_TEXT" },
    { name: "bot-commands", type: "GUILD_TEXT" },
    { name: "feedback", type: "GUILD_TEXT" },
    { name: "client-voice", type: "GUILD_VOICE" }
  ]
};

const CASE_REVIEWS_CATEGORY = { name: "Case Reviews", channels: [] };
const CASE_ARCHIVES_CATEGORY = { name: "Case Archives", channels: [] };

const LEGAL_TEAM_CATEGORY = {
  name: "Legal Team",
  channels: [
    { name: "lawyer-lounge", type: "GUILD_TEXT" },
    { name: "paralegal-hub", type: "GUILD_TEXT" },
    { name: "team-voice", type: "GUILD_VOICE" }
  ]
};

const STAFF_CATEGORY = {
  name: "Staff",
  channels: [
    { name: "staff-announcements", type: "GUILD_TEXT" },
    { name: "staff-chat", type: "GUILD_TEXT" },
    { name: "applications", type: "GUILD_TEXT" },
    { name: "signed-retainers", type: "GUILD_TEXT" },
    { name: "staff-voice", type: "GUILD_VOICE" }
  ]
};

const ADMINISTRATION_CATEGORY = {
  name: "Administration",
  channels: [
    { name: "modlog", type: "GUILD_TEXT" },
    { name: "admin-chat", type: "GUILD_TEXT" },
    { name: "admin-voice", type: "GUILD_VOICE" }
  ]
};

// L7: Extracted role definitions for clarity and testability.
const ROLES = [
  { name: "Managing Partner", color: "DarkRed", permissions: ["Administrator"], hoist: true },
  { name: "Senior Partner", color: "Red", permissions: ["ManageChannels", "ManageMessages", "ViewChannel", "SendMessages"], hoist: true },
  { name: "Partner", color: "Red", permissions: ["ManageChannels", "ManageMessages", "ViewChannel", "SendMessages"], hoist: true },
  { name: "Senior Associate", color: "Blue", permissions: ["ManageMessages", "ViewChannel", "SendMessages"], hoist: true },
  { name: "Associate", color: "Aqua", permissions: ["ViewChannel", "SendMessages"], hoist: true },
  { name: "Paralegal", color: "Purple", permissions: ["ViewChannel", "SendMessages"], hoist: true },
  { name: "Client", color: "Green", permissions: ["ViewChannel", "SendMessages"], hoist: true },
  { name: "Hiring Staff", color: "Orange", permissions: ["ViewChannel", "SendMessages"], hoist: true }
];

// L7: Extracted job definitions for clarity and testability.
const DEFAULT_JOBS = [
  {
    title: "Managing Partner",
    description: "Firm leader setting strategy & culture.",
    open: false,
    limit: 1,
    questions: [
      { id: "leadership", label: "Outline your leadership vision.", type: "paragraph", required: true },
      { id: "growth", label: "How will you grow the firm?", type: "paragraph", required: true }
    ]
  },
  {
    title: "Senior Partner",
    description: "Heads practice groups and mentors partners.",
    open: true,
    limit: 3,
    questions: [
      { id: "wins", label: "Share a major litigation win.", type: "paragraph", required: true },
      { id: "mentorship", label: "How do you mentor partners?", type: "paragraph", required: true }
    ]
  },
  {
    title: "Partner",
    description: "Leads cases, manages clients and teams.",
    open: true,
    limit: 5,
    questions: [
      { id: "exp", label: "Describe your leadership experience.", type: "paragraph", required: true },
      { id: "vision", label: "What is your vision for the firm?", type: "paragraph", required: true }
    ]
  },
  {
    title: "Senior Associate",
    description: "Handles complex research and key briefs.",
    open: true,
    limit: 10,
    questions: [
      { id: "research", label: "How good are you at legal research?", type: "paragraph", required: true },
      { id: "coach", label: "How do you coach associates?", type: "paragraph", required: true }
    ]
  },
  {
    title: "Associate",
    description: "Entry‑level lawyer assisting on matters.",
    open: true,
    limit: 10,
    questions: [
      { id: "exp", label: "How well do you work in a team?", type: "paragraph", required: true }
    ]
  },
  {
    title: "Paralegal",
    description: "Supports attorneys with documents & filings.",
    open: true,
    limit: 10,
    questions: [
      { id: "skills", label: "How much attention to detail do you have?", type: "paragraph", required: true },
      { id: "tools", label: "How well do you work in a team?", type: "paragraph", required: true }
    ]
  }
];

// L7: Compose SERVER_SETUP from extracted constants for maintainability.
export const SERVER_SETUP = {
  categories: [
    INFORMATION_CATEGORY,
    CLIENT_SERVICES_CATEGORY,
    CASE_REVIEWS_CATEGORY,
    CASE_ARCHIVES_CATEGORY,
    LEGAL_TEAM_CATEGORY,
    STAFF_CATEGORY,
    ADMINISTRATION_CATEGORY
  ],
  roles: ROLES,
  defaultJobs: DEFAULT_JOBS
};

/**
 * Default permission actions to assign to each role during server setup.
 * Key: role name, Value: array of permission actions
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  "Managing Partner": ["admin", "config", "case", "hr", "retainer", "casereview"],
  "Senior Partner": ["case", "hr", "retainer", "casereview"],
  "Partner": ["case", "hr", "retainer", "casereview"],
  "Senior Associate": ["case", "retainer", "casereview"],
  "Associate": ["case", "retainer"],
  "Paralegal": ["case", "retainer"],
  "Hiring Staff": ["hr"],
  // "Client": [] // Clients get no elevated permissions
}

/**
 * Maps GuildConfig keys to logical channel/category names for auto-setup.
 * Change this mapping to update which channels/categories are used for each config key.
 */
export const DEFAULT_CHANNEL_MAPPINGS: Record<string, { name: string; type: "GUILD_TEXT" | "GUILD_CATEGORY" }> = {
  feedbackChannelId: { name: "feedback", type: "GUILD_TEXT" },
  caseReviewCategoryId: { name: "Case Reviews", type: "GUILD_CATEGORY" },
  modlogChannelId: { name: "modlog", type: "GUILD_TEXT" },
  applicationChannelId: { name: "applications", type: "GUILD_TEXT" },
  retainerChannelId: { name: "signed-retainers", type: "GUILD_TEXT" }, // Add a channel named 'retainer' if needed
  caseArchiveCategoryId: { name: "Case Archives", type: "GUILD_CATEGORY" },
  // Add more mappings as needed
};
