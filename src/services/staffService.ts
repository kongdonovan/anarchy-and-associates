import { GuildMember, Role } from "discord.js";
import { JobRepository } from "../mongo/repository/jobs.js";
import { StaffRepository } from "../mongo/repository/staff.js";

// L7-perf: In-memory cache for jobs list (5s TTL)
let _jobsCache: { jobs: any[]; expires: number } | null = null;

export class StaffService {
  jobsDb = new JobRepository();
  staffDb = new StaffRepository();

  async getCachedJobs(): Promise<any[]> {
    const now = Date.now();
    if (_jobsCache && _jobsCache.expires > now) {
      return _jobsCache.jobs;
    }
    const jobs = await this.jobsDb.listJobs();
    _jobsCache = { jobs, expires: now + 5000 };
    return jobs;
  }

  /**
   * Returns true if the member has any job role (staff).
   */
  async isStaff(member: GuildMember): Promise<boolean> {
    const jobs = await this.getCachedJobs();
    const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
    return member.roles.cache.some(r => jobRoleIds.includes(r.id));
  }

  /**
   * Returns true if the member has the given job (by job title).
   */
  async hasJob(member: GuildMember, jobTitle: string): Promise<boolean> {
    const jobs = await this.jobsDb.listJobs({ title: jobTitle });
    const job = jobs[0];
    if (!job || !job.roleId) return false;
    return member.roles.cache.has(job.roleId);
  }

  /**
   * Returns the number of staff currently assigned to a job (by job title).
   */
  async getStaffCountForJob(jobTitle: string): Promise<number> {
    return (await this.staffDb.findByFilters({ role: jobTitle })).length;
  }

  /**
   * Returns the job object for a given role.
   */
  async getJobByRole(role: Role): Promise<any | null> {
    const jobs = await this.jobsDb.listJobs({ roleId: role.id });
    return jobs[0] || null;
  }

  /**
   * Returns true if a member can be assigned to a job (limit not exceeded).
   */
  async canAssignJob(jobTitle: string): Promise<{ allowed: boolean; limit: number; count: number }> {
    const jobs = await this.jobsDb.listJobs({ title: jobTitle });
    const job = jobs[0];
    if (!job || typeof job.limit !== "number") return { allowed: true, limit: Infinity, count: 0 };
    const count = await this.getStaffCountForJob(jobTitle);
    return { allowed: count < job.limit, limit: job.limit, count };
  }

  /**
   * Add or update a staff member in the DB (upsert) and return the upserted document.
   */
  async addStaffMember({ userId, username, role }: { userId: string; username: string; role: string }) {
    await this.staffDb.addStaff({ userId, username, role, updatedAt: new Date() });
    // Always fetch and return the upserted staff document
    const staff = await this.staffDb.getStaffByUserId(userId);
    return staff && staff.length > 0 ? staff[0] : null;
  }

  /**
   * Remove a staff member from the DB.
   */
  async removeStaffMember(userId: string) {
    return this.staffDb.removeStaff(userId);
  }

  /**
   * Remove a staff member from DB and all job roles in the guild.
   */
  async fireStaffMember(userId: string, guild: import("discord.js").Guild) {
    await this.removeStaffMember(userId);
    const member = await guild.members.fetch(userId).catch(() => null);
    if (member) {
      const jobs = await this.jobsDb.listJobs();
      const jobRoleIds = jobs.map(j => j.roleId).filter(Boolean);
      const rolesToRemove = member.roles.cache.filter(r => jobRoleIds.includes(r.id));
      if (rolesToRemove.size > 0) {
        await member.roles.remove(rolesToRemove);
      }
    }
  }

  /**
   * Get all staff records.
   */
  async getAllStaff() {
    return this.staffDb.getAllStaff();
  }

  /**
   * Get staff record(s) by userId (no cache).
   */
  async getStaffByUserId(userId: string) {
    return this.staffDb.getStaffByUserId(userId);
  }
}
