import { BaseRepository } from "./base.js";
import { Staff } from "../../types/types.d.js";

/**
 * Repository for Staff documents.
 * Use dependency injection for testability.
 */
export class StaffRepository extends BaseRepository<Staff> {
  constructor() {
    super("staff");
  }

  /**
   * Add or update a staff member by userId (true MongoDB upsert, no createdAt in $set)
   */
  async addStaff(member: Omit<Staff, "_id" | "createdAt"> & Partial<Pick<Staff, "createdAt">>) {
    const { createdAt, ...rest } = member;
    return (await this['col']()).updateOne(
      { userId: member.userId },
      {
        $set: { ...rest, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  }

  /**
   * Find staff by userId
   */
  async getStaffByUserId(userId: string) {
    return this.findByFilters({ userId });
  }

  /**
   * Get all staff
   */
  async getAllStaff() {
    return this.findByFilters({});
  }

  /**
   * Update staff by userId
   */
  async updateStaff(userId: string, updates: Partial<Staff>) {
    const staff = await this.findByFilters({ userId });
    if (!staff.length) return null;
    const id = staff[0]._id?.toString();
    if (!id) return null;
    return this.update(id, updates);
  }

  /**
   * Remove staff by userId
   */
  async removeStaff(userId: string) {
    const staff = await this.findByFilters({ userId });
    if (!staff.length) return null;
    const id = staff[0]._id?.toString();
    if (!id) return null;
    return this.delete(id);
  }
}
