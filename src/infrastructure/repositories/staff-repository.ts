import { BaseMongoRepository } from './base-mongo-repository';
import { StaffRole as StaffRoleEnum, RoleUtils } from '../../domain/entities/staff-role'; // Keep RoleUtils as it contains business logic
import { DatabaseError, DatabaseOperation } from '../../domain/errors/database-error';
import { 
  Staff,
  StaffRole,
  StaffRoleChangeRequestSchema,
  StaffTerminationRequestSchema,
  ValidationHelpers,
  DiscordSnowflakeSchema,
  StaffRoleSchema,
  z
} from '../../validation';

export class StaffRepository extends BaseMongoRepository<Staff> {
  constructor() {
    super('staff');
  }

  public async findByGuildId(guildId: unknown): Promise<Staff[]> {
    try {
      // Validate input
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );

      const result = await this.findByFilters({ guildId: validatedGuildId, status: 'active' });
      
      // Validate output - the result will have the correct types from MongoDB
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findByGuildId', filters: { guildId: String(guildId), status: 'active' } }
      });
    }
  }

  public async findByUserId(guildId: unknown, userId: unknown): Promise<Staff | null> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedUserId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        userId,
        'User ID'
      );

      const result = await this.findOne({ guildId: validatedGuildId, userId: validatedUserId });
      
      // Return the result directly - data from DB is already typed correctly
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        userId: String(userId),
        metadata: { method: 'findByUserId', filters: { guildId: String(guildId), userId: String(userId) } }
      });
    }
  }

  public async findByRole(guildId: unknown, role: unknown): Promise<Staff[]> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRole = ValidationHelpers.validateOrThrow(
        StaffRoleSchema,
        role,
        'Staff role'
      );

      const result = await this.findByFilters({ 
        guildId: validatedGuildId, 
        role: validatedRole as StaffRole, 
        status: 'active' 
      });
      
      // Return the result directly - data from DB is already typed correctly
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findByRole', filters: { guildId: String(guildId), role: String(role), status: 'active' } }
      });
    }
  }

  public async findByRoles(guildId: unknown, roles: unknown): Promise<Staff[]> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRoles = ValidationHelpers.validateOrThrow(
        z.array(StaffRoleSchema),
        roles,
        'Staff roles array'
      );

      const collection = this.collection;
      const staffDocs = await collection.find({
        guildId: validatedGuildId,
        role: { $in: validatedRoles as StaffRole[] },
        status: 'active'
      }).toArray();
      
      // Convert MongoDB documents to Staff entities with string IDs
      const staff = staffDocs.map(doc => this.fromMongoDoc(doc)).filter(s => s !== null) as Staff[];
      return staff;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findByRoles', filters: { guildId: String(guildId), roles, status: 'active' } }
      });
    }
  }

  public async getStaffCountByRole(guildId: unknown, role: unknown): Promise<number> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRole = ValidationHelpers.validateOrThrow(
        StaffRoleSchema,
        role,
        'Staff role'
      );

      const count = await this.count({ 
        guildId: validatedGuildId, 
        role: validatedRole as StaffRole, 
        status: 'active' 
      });
      
      // Return the count directly - it's already a number
      return count;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.AGGREGATE, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'getStaffCountByRole', filters: { guildId: String(guildId), role: String(role), status: 'active' } }
      });
    }
  }

  public async getAllStaffCountsByRole(guildId: unknown): Promise<Record<StaffRole, number>> {
    try {
      // Validate input
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );

      const counts: Record<StaffRole, number> = {} as Record<StaffRole, number>;
      
      for (const role of RoleUtils.getAllRoles()) {
        counts[role] = await this.getStaffCountByRole(validatedGuildId, role);
      }
      
      // Return the counts directly
      return counts;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.AGGREGATE, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'getAllStaffCountsByRole' }
      });
    }
  }

  public async findStaffHierarchy(guildId: unknown): Promise<Staff[]> {
    try {
      // Validate input
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );

      const allStaff = await this.findByGuildId(validatedGuildId);
      
      // Sort by role level (highest to lowest)
      const sortedStaff = allStaff.sort((a, b) => 
        RoleUtils.getRoleLevel(b.role as StaffRoleEnum) - RoleUtils.getRoleLevel(a.role as StaffRoleEnum)
      );

      // Output is already validated by findByGuildId
      return sortedStaff;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findStaffHierarchy' }
      });
    }
  }

  public async findStaffWithPagination(
    guildId: unknown,
    page: unknown = 1,
    limit: unknown = 10,
    roleFilter?: unknown
  ): Promise<{ staff: Staff[]; total: number; totalPages: number }> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedPage = ValidationHelpers.validateOrThrow(
        z.number().int().positive(),
        page,
        'Page number'
      );
      const validatedLimit = ValidationHelpers.validateOrThrow(
        z.number().int().positive().max(100),
        limit,
        'Page limit'
      );
      const validatedRoleFilter = roleFilter ? ValidationHelpers.validateOrThrow(
        StaffRoleSchema,
        roleFilter,
        'Role filter'
      ) : undefined;

      const skip = (validatedPage - 1) * validatedLimit;
      const filters: any = { guildId: validatedGuildId, status: 'active' };
      
      if (validatedRoleFilter) {
        filters.role = validatedRoleFilter;
      }

      const staff = await this.findMany(filters, validatedLimit, skip);
      const total = await this.count(filters);
      const totalPages = Math.ceil(total / validatedLimit);

      // Return the result directly
      return { staff, total, totalPages };
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      const errorFilters: any = { guildId: String(guildId), status: 'active' };
      if (roleFilter) {
        errorFilters.role = String(roleFilter);
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findStaffWithPagination', filters: errorFilters, page: Number(page), limit: Number(limit) }
      });
    }
  }

  public async updateStaffRole(
    guildId: unknown,
    userId: unknown,
    newRole: unknown,
    promotedBy: unknown,
    reason?: unknown
  ): Promise<Staff | null> {
    try {
      // Validate inputs using StaffRoleChangeRequestSchema
      const validatedRequest = ValidationHelpers.validateOrThrow(
        StaffRoleChangeRequestSchema,
        { guildId, userId, newRole, promotedBy, reason },
        'Staff role change request'
      );

      const staff = await this.findByUserId(validatedRequest.guildId, validatedRequest.userId);
      if (!staff) {
        return null;
      }

      const oldRole = staff.role;
      const actionType = RoleUtils.getRoleLevel(validatedRequest.newRole as StaffRoleEnum) > RoleUtils.getRoleLevel(oldRole as StaffRoleEnum) 
        ? 'promotion' as const
        : 'demotion' as const;

      const promotionRecord = {
        fromRole: oldRole,
        toRole: validatedRequest.newRole as StaffRole,
        promotedBy: validatedRequest.promotedBy,
        promotedAt: new Date(),
        reason: validatedRequest.reason,
        actionType,
      };

      const updatedPromotionHistory = [...staff.promotionHistory, promotionRecord];

      const result = await this.update(staff._id!.toString(), {
        role: validatedRequest.newRole as StaffRole,
        promotionHistory: updatedPromotionHistory,
      });

      // Return the result directly
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.UPDATE, 'staff', {
        guildId: String(guildId),
        userId: String(userId),
        metadata: { method: 'updateStaffRole', newRole: String(newRole), promotedBy: String(promotedBy) }
      });
    }
  }

  public async terminateStaff(
    guildId: unknown,
    userId: unknown,
    terminatedBy: unknown,
    reason?: unknown
  ): Promise<Staff | null> {
    try {
      // Validate inputs using StaffTerminationRequestSchema
      const validatedRequest = ValidationHelpers.validateOrThrow(
        StaffTerminationRequestSchema,
        { guildId, userId, terminatedBy, reason },
        'Staff termination request'
      );

      const staff = await this.findByUserId(validatedRequest.guildId, validatedRequest.userId);
      if (!staff) {
        return null;
      }

      const terminationRecord = {
        fromRole: staff.role,
        toRole: staff.role, // Role doesn't change on termination
        promotedBy: validatedRequest.terminatedBy,
        promotedAt: new Date(),
        reason: validatedRequest.reason,
        actionType: 'fire' as const,
      };

      const updatedPromotionHistory = [...staff.promotionHistory, terminationRecord];

      const result = await this.update(staff._id!.toString(), {
        status: 'terminated',
        promotionHistory: updatedPromotionHistory,
      });

      // Return the result directly
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.UPDATE, 'staff', {
        guildId: String(guildId),
        userId: String(userId),
        metadata: { method: 'terminateStaff', terminatedBy: String(terminatedBy) }
      });
    }
  }

  public async findSeniorStaff(guildId: unknown): Promise<Staff[]> {
    try {
      // Validate input
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );

      // Senior staff are Senior Partners and above (level 5+)
      const seniorRoles = RoleUtils.getAllRoles().filter(
        role => RoleUtils.getRoleLevel(role) >= 5
      );
      
      // Output is already validated by findByRoles
      return await this.findByRoles(validatedGuildId, seniorRoles);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findSeniorStaff', seniorRoleLevel: 5 }
      });
    }
  }

  public async canHireRole(guildId: unknown, role: unknown): Promise<boolean> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRole = ValidationHelpers.validateOrThrow(
        StaffRoleSchema,
        role,
        'Staff role'
      );

      const currentCount = await this.getStaffCountByRole(validatedGuildId, validatedRole);
      const maxCount = RoleUtils.getRoleMaxCount(validatedRole as StaffRoleEnum);
      
      return currentCount < maxCount;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.AGGREGATE, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'canHireRole', role: String(role) }
      });
    }
  }

  public async findStaffByRobloxUsername(guildId: unknown, robloxUsername: unknown): Promise<Staff | null> {
    try {
      // Validate inputs
      const validatedGuildId = ValidationHelpers.validateOrThrow(
        DiscordSnowflakeSchema,
        guildId,
        'Guild ID'
      );
      const validatedRobloxUsername = ValidationHelpers.validateOrThrow(
        z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
        robloxUsername,
        'Roblox username'
      );

      const collection = this.collection;
      const staff = await collection.findOne({ 
        guildId: validatedGuildId, 
        robloxUsername: { $regex: new RegExp(`^${validatedRobloxUsername}$`, 'i') },
        status: 'active'
      });
      
      // Return the result directly - data from DB is already typed correctly
      return staff as Staff | null;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Validation failed')) {
        throw error;
      }
      throw DatabaseError.fromMongoError(error, DatabaseOperation.FIND, 'staff', {
        guildId: String(guildId),
        metadata: { method: 'findStaffByRobloxUsername', robloxUsername: String(robloxUsername) }
      });
    }
  }
}