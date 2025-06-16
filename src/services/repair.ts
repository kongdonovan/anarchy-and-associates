/**
 * Self-repair and health check service routines for Discord bot and MongoDB.
 * @module services/repair
 */
import { Guild, EmbedBuilder, GuildChannel, ChannelType } from "discord.js";
import { SERVER_SETUP } from "../utils/serverSetupConfig.js";
import { GuildConfigRepository } from "../mongo/repository/guildConfig.js";
import { getConfig, setConfig } from "../utils/botConfig.js";
import { CaseRepository } from "../mongo/repository/cases.js";
import { ApplicationRepository } from "../mongo/repository/applications.js";
import { FeedbackRepository } from "../mongo/repository/feedback.js";
import { RetainerRepository } from "../mongo/repository/retainers.js";
import clientPromise from "../mongo/mongo.js";
import { StaffService } from "./staffService.js";

/**
 * Sync staff roles between DB and Discord. Adds missing roles, removes extra roles, and reports actions.
 * @param guild - Discord guild
 * @param opts - Optional dryRun flag
 * @returns EmbedBuilder with repair summary
 */
export async function repairStaffRoles(guild: Guild, opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  const staffService = new StaffService();
  const staffRecords = await staffService.staffDb.getAllStaff();
  const staffRoleNames = ["staff", "associate", "manager", "partner"];
  const staffRoles = guild.roles.cache.filter(r => staffRoleNames.some(n => r.name.toLowerCase().includes(n)));
  let added = 0, removed = 0, errors = 0;
  // Add missing roles to staff in DB
  for (const staff of staffRecords) {
    const member = await guild.members.fetch(staff.userId).catch(() => null);
    if (!member) continue;
    const targetRole = staffRoles.find(r => r.name === staff.role);
    if (targetRole && !member.roles.cache.has(targetRole.id)) {
      if (!opts?.dryRun) await member.roles.add(targetRole).catch(() => errors++);
      added++;
    }
    // Remove other staff roles
    for (const role of staffRoles.values()) {
      if (role.id !== targetRole?.id && member.roles.cache.has(role.id)) {
        if (!opts?.dryRun) await member.roles.remove(role).catch(() => errors++);
        removed++;
      }
    }
  }
  // Remove staff roles from users not in DB
  for (const role of staffRoles.values()) {
    for (const member of role.members.values()) {
      if (!staffRecords.some(s => s.userId === member.id)) {
        if (!opts?.dryRun) await member.roles.remove(role).catch(() => errors++);
        removed++;
      }
    }
  }
  return new EmbedBuilder()
    .setTitle("Staff Role Repair")
    .setDescription(
      `Staff in DB: **${staffRecords.length}**\nStaff roles in Discord: **${staffRoles.size}**\nRoles added: **${added}**\nRoles removed: **${removed}**\nErrors: **${errors}**${opts?.dryRun ? "\n(Dry run: no changes made)" : ""}`
    );
}

/**
 * Sync job roles between DB and Discord. Adds missing roles, removes extra roles, and reports actions.
 * @param guild - Discord guild
 * @param opts - Optional dryRun flag
 * @returns EmbedBuilder with repair summary
 */
export async function repairJobRoles(guild: Guild, opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  const staffService = new StaffService();
  const jobs = await staffService.jobsDb.findByFilters({});
  let added = 0, removed = 0, errors = 0;
  // Ensure each job in DB has a corresponding Discord role
  for (const job of jobs) {
    if (!job.roleId) continue;
    let role = guild.roles.cache.get(job.roleId);
    if (!role) {
      if (!opts?.dryRun) {
        role = await guild.roles.create({ name: job.title, reason: "Repair: missing job role" }).catch(() => undefined);
        if (role) {
          await staffService.jobsDb.updateJob(job._id.toString(), { roleId: role.id });
          added++;
        } else {
          errors++;
        }
      } else {
        added++;
      }
    }
  }
  // Remove roles in Discord that are not in DB
  const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
  for (const role of guild.roles.cache.values()) {
    if (role.managed) continue;
    if (jobRoleIds.includes(role.id)) continue;
    // Heuristic: only remove roles that look like job roles (by name or other criteria)
    if (role.name.match(/job|associate|paralegal|attorney|legal|staff/i)) {
      if (!opts?.dryRun) await role.delete("Repair: job role not in DB").catch(() => errors++);
      removed++;
    }
  }
  return new EmbedBuilder()
    .setTitle("Job Role Repair")
    .setDescription(
      `Jobs in DB: **${jobs.length}**\nJob roles in Discord: **${jobRoleIds.length}**\nRoles added: **${added}**\nRoles removed: **${removed}**\nErrors: **${errors}**${opts?.dryRun ? "\n(Dry run: no changes made)" : ""}`
    );
}

export async function repairChannels(guild: Guild, opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  // Ensures all required categories/channels exist per SERVER_SETUP, updates config if needed, supports dry-run
  let added = 0, errors = 0;
  const missing: string[] = [];
  const createdIds: Record<string, string> = {};
  for (const cat of SERVER_SETUP.categories) {
    let category = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === cat.name.toLowerCase()
    );
    if (!category) {
      if (!opts?.dryRun) {
        category = await guild.channels.create({
          name: cat.name,
          type: ChannelType.GuildCategory,
          reason: "Repair: missing category"
        }).catch(() => undefined);
      }
      added++;
      missing.push("Category: " + cat.name);
      if (category) createdIds[cat.name] = category.id;
    }
    // For each channel in the category
    for (const ch of cat.channels) {
      let channel = guild.channels.cache.find(
        c => c.parent && c.parent.name.toLowerCase() === cat.name.toLowerCase() && c.name.toLowerCase() === ch.name.toLowerCase()
      );
      if (!channel) {
        if (!opts?.dryRun && category) {
          channel = await guild.channels.create({
            name: ch.name,
            type: ch.type === "GUILD_TEXT" ? ChannelType.GuildText : ChannelType.GuildVoice,
            parent: category.id,
            reason: "Repair: missing channel"
          }).catch(() => undefined);
        }
        added++;
        missing.push("Channel: " + cat.name + "/" + ch.name);
        if (channel) createdIds[`${cat.name}/${ch.name}`] = channel.id;
      }
    }
  }
  return new EmbedBuilder()
    .setTitle("Channel Repair")
    .setDescription(
      `Categories/channels added: **${added}**\nMissing: ${missing.length ? missing.join(", ") : "None"}\nErrors: **${errors}**${opts?.dryRun ? "\n(Dry run: no changes made)" : ""}`
    );
}

export async function repairConfig(guild: Guild, opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  // Validate and repair GuildConfig (MongoDB) and config.json (disk), with dry-run support
  const guildConfigRepo = new GuildConfigRepository();
  const dbConfig = await guildConfigRepo.getConfig(guild.id);
  const diskConfig = getConfig();
  let fixed = 0, errors = 0;
  const missing: string[] = [];
  // Required GuildConfig fields
  const requiredDbFields = ["guildId", "privilegedRoles", "admins", "adminRoles"];
  if (!dbConfig) {
    if (!opts?.dryRun) await guildConfigRepo.setConfig(guild.id, { privilegedRoles: [], admins: [], adminRoles: [] });
    fixed++;
    missing.push("GuildConfig: all");
  } else {
    for (const field of requiredDbFields) {
      if (!(field in dbConfig)) {
        if (!opts?.dryRun) await guildConfigRepo.setConfig(guild.id, { [field]: [] });
        fixed++;
        missing.push(`GuildConfig: ${field}`);
      }
    }
  }
  // Required disk config keys (from config.json)
  const requiredDiskKeys = [
    "FEEDBACK_CHANNEL_ID",
    "RETAINER_CHANNEL_ID",
    "CASE_REVIEW_CATEGORY_ID",
    "MODLOG_CHANNEL_ID"
  ];
  for (const key of requiredDiskKeys) {
    if (!(key in diskConfig)) {
      if (!opts?.dryRun) setConfig(key, "");
      fixed++;
      missing.push(`config.json: ${key}`);
    }
  }
  return new EmbedBuilder()
    .setTitle("Config Repair")
    .setDescription(
      `Config fields fixed: **${fixed}**\nMissing: ${missing.length ? missing.join(", ") : "None"}\nErrors: **${errors}**${opts?.dryRun ? "\n(Dry run: no changes made)" : ""}`
    );
}

export async function repairOrphaned(guild: Guild, opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  // Find and remove DB records referencing missing Discord users, channels, or roles, with dry-run support
  let removed = 0, errors = 0;
  const orphaned: string[] = [];
  // Staff
  const staffService = new StaffService();
  const staffRecords = await staffService.staffDb.getAllStaff();
  for (const staff of staffRecords) {
    if (!guild.members.cache.has(staff.userId)) {
      orphaned.push(`Staff: ${staff.userId}`);
      if (!opts?.dryRun) await staffService.staffDb.removeStaff(staff.userId).catch(() => errors++);
      removed++;
    }
  }
  // Jobs
  const jobsDb = staffService.jobsDb;
  const jobs = await jobsDb.findByFilters({});
  for (const job of jobs) {
    if (job.roleId && !guild.roles.cache.has(job.roleId)) {
      orphaned.push(`Job: ${job.title} (roleId: ${job.roleId})`);
      if (!opts?.dryRun) await jobsDb.updateJob(job._id.toString(), { roleId: undefined }).catch(() => errors++);
      removed++;
    }
  }
  // Cases
  const casesDb = new CaseRepository();
  const cases = await casesDb.findByFilters({});
  for (const c of cases) {
    if (Array.isArray(c.assignedTo)) {
      for (const userId of c.assignedTo) {
        if (!guild.members.cache.has(userId)) {
          orphaned.push(`Case: ${c._id} (assignedTo: ${userId})`);
          if (!opts?.dryRun) await casesDb.update(c._id.toString(), { assignedTo: c.assignedTo.filter(id => id !== userId) }).catch(() => errors++);
          removed++;
        }
      }
    }
    if (c.clientId && !guild.members.cache.has(c.clientId)) {
      orphaned.push(`Case: ${c._id} (clientId: ${c.clientId})`);
      if (!opts?.dryRun) await casesDb.update(c._id.toString(), { clientId: undefined }).catch(() => errors++);
      removed++;
    }
  }
  // Applications
  const appDb = new ApplicationRepository();
  const apps = await appDb.findByFilters({});
  for (const app of apps) {
    if (!guild.members.cache.has(app.discordId)) {
      orphaned.push(`Application: ${app._id} (discordId: ${app.discordId})`);
      if (!opts?.dryRun) await appDb.deleteApplicationById(app._id.toString()).catch(() => errors++);
      removed++;
    }
  }
  // Feedback
  const feedbackDb = new FeedbackRepository();
  const feedbacks = await feedbackDb.findByFilters({});
  for (const fb of feedbacks) {
    if (!guild.members.cache.has(fb.userId)) {
      orphaned.push(`Feedback: ${fb._id} (userId: ${fb.userId})`);
      if (!opts?.dryRun) await feedbackDb.delete(fb._id.toString()).catch(() => errors++);
      removed++;
    }
  }
  // Retainers
  const retainerDb = new RetainerRepository();
  const retainers = await retainerDb.findByFilters({});
  for (const r of retainers) {
    if (!guild.members.cache.has(r.clientId) || !guild.members.cache.has(r.lawyerId)) {
      orphaned.push(`Retainer: ${r._id} (clientId: ${r.clientId}, lawyerId: ${r.lawyerId})`);
      if (!opts?.dryRun) await retainerDb.delete(r._id.toString()).catch(() => errors++);
      removed++;
    }
  }
  return new EmbedBuilder()
    .setTitle("Orphaned Data Repair")
    .setDescription(
      `Orphaned records removed: **${removed}**\nOrphaned: ${orphaned.length ? orphaned.join(", ") : "None"}\nErrors: **${errors}**${opts?.dryRun ? "\n(Dry run: no changes made)" : ""}`
    );
}

export async function repairDbIndexes(opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  // Ensure all necessary MongoDB indexes exist for each collection
  let created = 0, errors = 0;
  const createdIndexes: string[] = [];
  const client = await clientPromise;
  const db = client.db();
  // Define required indexes for each collection
  const indexSpecs = [
    { collection: "staff", indexes: [{ key: { userId: 1 }, options: { unique: true } }] },
    { collection: "jobs", indexes: [{ key: { title: 1 }, options: { unique: true } }] },
    { collection: "cases", indexes: [
      { key: { clientId: 1 }, options: {} },
      { key: { assignedTo: 1 }, options: {} }
    ] },
    { collection: "applications", indexes: [{ key: { discordId: 1 }, options: {} }] },
    { collection: "feedback", indexes: [{ key: { userId: 1 }, options: {} }] },
    { collection: "retainers", indexes: [
      { key: { clientId: 1 }, options: {} },
      { key: { lawyerId: 1 }, options: {} }
    ] },
    { collection: "guildConfig", indexes: [{ key: { guildId: 1 }, options: { unique: true } }] }
  ];
  for (const spec of indexSpecs) {
    const col = db.collection(spec.collection);
    for (const idx of spec.indexes) {
      try {
        // Remove any undefined properties from key
        const key = Object.fromEntries(Object.entries(idx.key).filter(([_, v]) => v !== undefined));
        if (!opts?.dryRun) {
          await col.createIndex(key, idx.options);
        }
        created++;
        createdIndexes.push(`${spec.collection}: ${JSON.stringify(key)}`);
      } catch (e) {
        errors++;
      }
    }
  }
  return new EmbedBuilder()
    .setTitle("DB Index Repair")
    .setDescription(
      `Indexes created/ensured: **${created}**\nCollections: ${createdIndexes.length ? createdIndexes.join(", ") : "None"}\nErrors: **${errors}**${opts?.dryRun ? "\n(Dry run: no changes made)" : ""}`
    );
}

export async function repairAll(guild: Guild, opts?: { dryRun?: boolean }): Promise<EmbedBuilder> {
  // Run all repair routines in sequence, aggregate results, support dry-run
  const results: EmbedBuilder[] = [];
  results.push(await repairStaffRoles(guild, opts));
  results.push(await repairJobRoles(guild, opts));
  results.push(await repairChannels(guild, opts));
  results.push(await repairConfig(guild, opts));
  results.push(await repairOrphaned(guild, opts));
  results.push(await repairDbIndexes(opts));
  // Aggregate summary
  const summary = results.map(r => r.data.description).join("\n\n");
  return new EmbedBuilder()
    .setTitle("Full Repair Summary")
    .setDescription(summary);
}

export async function healthCheck(guild: Guild): Promise<EmbedBuilder> {
  // Check DB, Discord, config, and provide a summary
  const guildConfigRepo = new GuildConfigRepository();
  const dbConfig = await guildConfigRepo.getConfig(guild.id);
  const diskConfig = getConfig();
  let issues = 0;
  const problems: string[] = [];
  // Check Discord connection
  if (!guild.available) {
    issues++;
    problems.push("Discord guild unavailable");
  }
  // Check required config.json keys
  const requiredDiskKeys = [
    "FEEDBACK_CHANNEL_ID",
    "RETAINER_CHANNEL_ID",
    "CASE_REVIEW_CATEGORY_ID",
    "MODLOG_CHANNEL_ID"
  ];
  for (const key of requiredDiskKeys) {
    if (!(key in diskConfig) || !diskConfig[key]) {
      issues++;
      problems.push(`config.json missing or empty: ${key}`);
    }
  }
  // Check GuildConfig
  if (!dbConfig) {
    issues++;
    problems.push("GuildConfig missing in DB");
  } else {
    const requiredDbFields = ["guildId", "privilegedRoles", "admins", "adminRoles"];
    for (const field of requiredDbFields) {
      if (!(field in dbConfig)) {
        issues++;
        problems.push(`GuildConfig missing: ${field}`);
      }
    }
  }
  // Check MongoDB connection
  try {
    const client = await clientPromise;
    await client.db().command({ ping: 1 });
  } catch {
    issues++;
    problems.push("MongoDB connection failed");
  }
  return new EmbedBuilder()
    .setTitle("Health Check")
    .setDescription(
      `Issues found: **${issues}**\n${problems.length ? problems.join("\n") : "All systems healthy."}`
    );
}

export async function setupDefaultJobs(guild: Guild) {
  const staffService = new StaffService();
  const jobsDb = staffService.jobsDb;
  const existingJobs = await jobsDb.listJobs();
  if (existingJobs.length === 0) {
    for (const job of SERVER_SETUP.defaultJobs) {
      // Try to find a role in the guild that matches the job title (case-insensitive)
      const role = guild.roles.cache.find(r => r.name.toLowerCase() === job.title.toLowerCase());
      const inserted = await jobsDb.addJob({
        ...job,
        questions: job.questions.map(q => ({ ...q, type: q.type as "short" | "paragraph" | "number" | "choice" })),
        createdAt: new Date(),
        updatedAt: new Date(),
        roleId: role?.id
      });
    }
  }
}
