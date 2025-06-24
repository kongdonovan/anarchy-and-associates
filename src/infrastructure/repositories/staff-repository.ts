import { BaseMongoRepository } from './base-mongo-repository';
import { Staff } from '../../domain/entities/staff';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { logger } from '../logger';

export class StaffRepository extends BaseMongoRepository<Staff> {
  constructor() {
    super('staff');
  }

  public async findByGuildId(guildId: string): Promise<Staff[]> {
    try {
      return await this.findByFilters({ guildId, status: 'active' });
    } catch (error) {
      logger.error(`Error finding staff for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByUserId(guildId: string, userId: string): Promise<Staff | null> {
    try {
      return await this.findOne({ guildId, userId });
    } catch (error) {
      logger.error(`Error finding staff member ${userId} in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByRole(guildId: string, role: StaffRole): Promise<Staff[]> {
    try {
      return await this.findByFilters({ guildId, role, status: 'active' });
    } catch (error) {
      logger.error(`Error finding staff by role ${role} in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findByRoles(guildId: string, roles: StaffRole[]): Promise<Staff[]> {
    try {
      const collection = this.collection;
      const staff = await collection.find({
        guildId,
        role: { $in: roles },
        status: 'active'
      }).toArray();
      return staff as Staff[];
    } catch (error) {
      logger.error(`Error finding staff by roles in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async getStaffCountByRole(guildId: string, role: StaffRole): Promise<number> {
    try {
      return await this.count({ guildId, role, status: 'active' });
    } catch (error) {
      logger.error(`Error counting staff for role ${role} in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async getAllStaffCountsByRole(guildId: string): Promise<Record<StaffRole, number>> {
    try {
      const counts: Record<StaffRole, number> = {} as Record<StaffRole, number>;
      
      for (const role of RoleUtils.getAllRoles()) {
        counts[role] = await this.getStaffCountByRole(guildId, role);
      }
      
      return counts;
    } catch (error) {
      logger.error(`Error getting all staff counts for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findStaffHierarchy(guildId: string): Promise<Staff[]> {
    try {
      const allStaff = await this.findByGuildId(guildId);
      
      // Sort by role level (highest to lowest)
      return allStaff.sort((a, b) => 
        RoleUtils.getRoleLevel(b.role) - RoleUtils.getRoleLevel(a.role)
      );
    } catch (error) {
      logger.error(`Error finding staff hierarchy for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findStaffWithPagination(
    guildId: string,
    page: number = 1,
    limit: number = 10,
    roleFilter?: StaffRole
  ): Promise<{ staff: Staff[]; total: number; totalPages: number }> {
    try {
      const skip = (page - 1) * limit;
      const filters: any = { guildId, status: 'active' };
      
      if (roleFilter) {
        filters.role = roleFilter;
      }

      const staff = await this.findMany(filters, limit, skip);
      const total = await this.count(filters);
      const totalPages = Math.ceil(total / limit);

      return { staff, total, totalPages };
    } catch (error) {
      logger.error(`Error finding staff with pagination for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async updateStaffRole(
    guildId: string,
    userId: string,
    newRole: StaffRole,
    promotedBy: string,
    reason?: string
  ): Promise<Staff | null> {
    try {
      const staff = await this.findByUserId(guildId, userId);
      if (!staff) {
        return null;
      }

      const oldRole = staff.role;
      const actionType = RoleUtils.getRoleLevel(newRole) > RoleUtils.getRoleLevel(oldRole) 
        ? 'promotion' as const
        : 'demotion' as const;

      const promotionRecord = {
        fromRole: oldRole,
        toRole: newRole,
        promotedBy,
        promotedAt: new Date(),
        reason,
        actionType,
      };

      const updatedPromotionHistory = [...staff.promotionHistory, promotionRecord];

      return await this.update(staff._id!.toHexString(), {
        role: newRole,
        promotionHistory: updatedPromotionHistory,
      });
    } catch (error) {
      logger.error(`Error updating staff role for ${userId} in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async terminateStaff(
    guildId: string,
    userId: string,
    terminatedBy: string,
    reason?: string
  ): Promise<Staff | null> {
    try {
      const staff = await this.findByUserId(guildId, userId);
      if (!staff) {
        return null;
      }

      const terminationRecord = {
        fromRole: staff.role,
        toRole: staff.role, // Role doesn't change on termination
        promotedBy: terminatedBy,
        promotedAt: new Date(),
        reason,
        actionType: 'fire' as const,
      };

      const updatedPromotionHistory = [...staff.promotionHistory, terminationRecord];

      return await this.update(staff._id!.toHexString(), {
        status: 'terminated',
        promotionHistory: updatedPromotionHistory,
      });
    } catch (error) {
      logger.error(`Error terminating staff ${userId} in guild ${guildId}:`, error);
      throw error;
    }
  }

  public async findSeniorStaff(guildId: string): Promise<Staff[]> {
    try {
      // Senior staff are Senior Partners and above (level 5+)
      const seniorRoles = RoleUtils.getAllRoles().filter(
        role => RoleUtils.getRoleLevel(role) >= 5
      );
      
      return await this.findByRoles(guildId, seniorRoles);
    } catch (error) {
      logger.error(`Error finding senior staff for guild ${guildId}:`, error);
      throw error;
    }
  }

  public async canHireRole(guildId: string, role: StaffRole): Promise<boolean> {
    try {
      const currentCount = await this.getStaffCountByRole(guildId, role);
      const maxCount = RoleUtils.getRoleMaxCount(role);
      
      return currentCount < maxCount;
    } catch (error) {
      logger.error(`Error checking if can hire ${role} in guild ${guildId}:`, error);
      return false;
    }
  }

  public async findStaffByRobloxUsername(guildId: string, robloxUsername: string): Promise<Staff | null> {
    try {
      const collection = this.collection;
      const staff = await collection.findOne({ 
        guildId, 
        robloxUsername: { $regex: new RegExp(`^${robloxUsername}$`, 'i') },
        status: 'active'
      });
      return staff as Staff || null;
    } catch (error) {
      logger.error(`Error finding staff by Roblox username ${robloxUsername} in guild ${guildId}:`, error);
      throw error;
    }
  }
}