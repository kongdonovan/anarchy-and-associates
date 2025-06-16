/**
 * Job service helpers for role lookup and question parsing.
 * @module services/jobs
 */
import { Role, Guild } from "discord.js";
import { v4 as uuidv4 } from "uuid";
import type { Job, JobQuestion } from "../types/types.d.js";

/**
 * Parse and validate job questions from a JSON string.
 * @param questions - JSON string representing an array of job questions
 * @returns Array of JobQuestion objects
 * @throws Error if the input is not a valid array or questions are malformed
 */
export function parseJobQuestions(questions: string): JobQuestion[] {
  const arr = JSON.parse(questions);
  if (!Array.isArray(arr)) throw new Error("Questions must be a JSON array.");
  return arr.map((q, i) => {
    if (!q.label || typeof q.label !== "string") throw new Error(`Question ${i + 1} missing label.`);
    if (!q.type || typeof q.type !== "string") throw new Error(`Question ${i + 1} missing type.`);
    return {
      id: q.id || uuidv4(),
      label: q.label,
      type: q.type,
      required: q.required ?? true,
      options: q.options,
    };
  });
}

/**
 * Find a role by ID in a guild.
 * @param guild - The Discord guild
 * @param roleId - The role ID to look up
 * @returns The Role object if found, otherwise null
 */
export function findRoleById(guild: Guild, roleId: string): Role | null {
  return guild.roles.cache.get(roleId) || null;
}
