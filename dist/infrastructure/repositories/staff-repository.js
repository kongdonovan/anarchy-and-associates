"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const staff_role_1 = require("../../domain/entities/staff-role"); // Keep RoleUtils as it contains business logic
const database_error_1 = require("../../domain/errors/database-error");
const validation_1 = require("../../validation");
class StaffRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('staff');
    }
    async findByGuildId(guildId) {
        try {
            // Validate input
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const result = await this.findByFilters({ guildId: validatedGuildId, status: 'active' });
            // Validate output - the result will have the correct types from MongoDB
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findByGuildId', filters: { guildId: String(guildId), status: 'active' } }
            });
        }
    }
    async findByUserId(guildId, userId) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedUserId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, userId, 'User ID');
            const result = await this.findOne({ guildId: validatedGuildId, userId: validatedUserId });
            // Return the result directly - data from DB is already typed correctly
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                userId: String(userId),
                metadata: { method: 'findByUserId', filters: { guildId: String(guildId), userId: String(userId) } }
            });
        }
    }
    async findByRole(guildId, role) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRole = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleSchema, role, 'Staff role');
            const result = await this.findByFilters({
                guildId: validatedGuildId,
                role: validatedRole,
                status: 'active'
            });
            // Return the result directly - data from DB is already typed correctly
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findByRole', filters: { guildId: String(guildId), role: String(role), status: 'active' } }
            });
        }
    }
    async findByRoles(guildId, roles) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRoles = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.array(validation_1.StaffRoleSchema), roles, 'Staff roles array');
            const collection = this.collection;
            const staffDocs = await collection.find({
                guildId: validatedGuildId,
                role: { $in: validatedRoles },
                status: 'active'
            }).toArray();
            // Convert MongoDB documents to Staff entities with string IDs
            const staff = staffDocs.map(doc => this.fromMongoDoc(doc)).filter(s => s !== null);
            return staff;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findByRoles', filters: { guildId: String(guildId), roles, status: 'active' } }
            });
        }
    }
    async getStaffCountByRole(guildId, role) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRole = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleSchema, role, 'Staff role');
            const count = await this.count({
                guildId: validatedGuildId,
                role: validatedRole,
                status: 'active'
            });
            // Return the count directly - it's already a number
            return count;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.AGGREGATE, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'getStaffCountByRole', filters: { guildId: String(guildId), role: String(role), status: 'active' } }
            });
        }
    }
    async getAllStaffCountsByRole(guildId) {
        try {
            // Validate input
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const counts = {};
            for (const role of staff_role_1.RoleUtils.getAllRoles()) {
                counts[role] = await this.getStaffCountByRole(validatedGuildId, role);
            }
            // Return the counts directly
            return counts;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.AGGREGATE, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'getAllStaffCountsByRole' }
            });
        }
    }
    async findStaffHierarchy(guildId) {
        try {
            // Validate input
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const allStaff = await this.findByGuildId(validatedGuildId);
            // Sort by role level (highest to lowest)
            const sortedStaff = allStaff.sort((a, b) => staff_role_1.RoleUtils.getRoleLevel(b.role) - staff_role_1.RoleUtils.getRoleLevel(a.role));
            // Output is already validated by findByGuildId
            return sortedStaff;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findStaffHierarchy' }
            });
        }
    }
    async findStaffWithPagination(guildId, page = 1, limit = 10, roleFilter) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedPage = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.number().int().positive(), page, 'Page number');
            const validatedLimit = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.number().int().positive().max(100), limit, 'Page limit');
            const validatedRoleFilter = roleFilter ? validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleSchema, roleFilter, 'Role filter') : undefined;
            const skip = (validatedPage - 1) * validatedLimit;
            const filters = { guildId: validatedGuildId, status: 'active' };
            if (validatedRoleFilter) {
                filters.role = validatedRoleFilter;
            }
            const staff = await this.findMany(filters, validatedLimit, skip);
            const total = await this.count(filters);
            const totalPages = Math.ceil(total / validatedLimit);
            // Return the result directly
            return { staff, total, totalPages };
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            const errorFilters = { guildId: String(guildId), status: 'active' };
            if (roleFilter) {
                errorFilters.role = String(roleFilter);
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findStaffWithPagination', filters: errorFilters, page: Number(page), limit: Number(limit) }
            });
        }
    }
    async updateStaffRole(guildId, userId, newRole, promotedBy, reason) {
        try {
            // Validate inputs using StaffRoleChangeRequestSchema
            const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleChangeRequestSchema, { guildId, userId, newRole, promotedBy, reason }, 'Staff role change request');
            const staff = await this.findByUserId(validatedRequest.guildId, validatedRequest.userId);
            if (!staff) {
                return null;
            }
            const oldRole = staff.role;
            const actionType = staff_role_1.RoleUtils.getRoleLevel(validatedRequest.newRole) > staff_role_1.RoleUtils.getRoleLevel(oldRole)
                ? 'promotion'
                : 'demotion';
            const promotionRecord = {
                fromRole: oldRole,
                toRole: validatedRequest.newRole,
                promotedBy: validatedRequest.promotedBy,
                promotedAt: new Date(),
                reason: validatedRequest.reason,
                actionType,
            };
            const updatedPromotionHistory = [...staff.promotionHistory, promotionRecord];
            const result = await this.update(staff._id.toString(), {
                role: validatedRequest.newRole,
                promotionHistory: updatedPromotionHistory,
            });
            // Return the result directly
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.UPDATE, 'staff', {
                guildId: String(guildId),
                userId: String(userId),
                metadata: { method: 'updateStaffRole', newRole: String(newRole), promotedBy: String(promotedBy) }
            });
        }
    }
    async terminateStaff(guildId, userId, terminatedBy, reason) {
        try {
            // Validate inputs using StaffTerminationRequestSchema
            const validatedRequest = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffTerminationRequestSchema, { guildId, userId, terminatedBy, reason }, 'Staff termination request');
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
                actionType: 'fire',
            };
            const updatedPromotionHistory = [...staff.promotionHistory, terminationRecord];
            const result = await this.update(staff._id.toString(), {
                status: 'terminated',
                promotionHistory: updatedPromotionHistory,
            });
            // Return the result directly
            return result;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.UPDATE, 'staff', {
                guildId: String(guildId),
                userId: String(userId),
                metadata: { method: 'terminateStaff', terminatedBy: String(terminatedBy) }
            });
        }
    }
    async findSeniorStaff(guildId) {
        try {
            // Validate input
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            // Senior staff are Senior Partners and above (level 5+)
            const seniorRoles = staff_role_1.RoleUtils.getAllRoles().filter(role => staff_role_1.RoleUtils.getRoleLevel(role) >= 5);
            // Output is already validated by findByRoles
            return await this.findByRoles(validatedGuildId, seniorRoles);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findSeniorStaff', seniorRoleLevel: 5 }
            });
        }
    }
    async canHireRole(guildId, role) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRole = validation_1.ValidationHelpers.validateOrThrow(validation_1.StaffRoleSchema, role, 'Staff role');
            const currentCount = await this.getStaffCountByRole(validatedGuildId, validatedRole);
            const maxCount = staff_role_1.RoleUtils.getRoleMaxCount(validatedRole);
            return currentCount < maxCount;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.AGGREGATE, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'canHireRole', role: String(role) }
            });
        }
    }
    async findStaffByRobloxUsername(guildId, robloxUsername) {
        try {
            // Validate inputs
            const validatedGuildId = validation_1.ValidationHelpers.validateOrThrow(validation_1.DiscordSnowflakeSchema, guildId, 'Guild ID');
            const validatedRobloxUsername = validation_1.ValidationHelpers.validateOrThrow(validation_1.z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/), robloxUsername, 'Roblox username');
            const collection = this.collection;
            const staff = await collection.findOne({
                guildId: validatedGuildId,
                robloxUsername: { $regex: new RegExp(`^${validatedRobloxUsername}$`, 'i') },
                status: 'active'
            });
            // Return the result directly - data from DB is already typed correctly
            return staff;
        }
        catch (error) {
            if (error instanceof Error && error.message.includes('Validation failed')) {
                throw error;
            }
            throw database_error_1.DatabaseError.fromMongoError(error, database_error_1.DatabaseOperation.FIND, 'staff', {
                guildId: String(guildId),
                metadata: { method: 'findStaffByRobloxUsername', robloxUsername: String(robloxUsername) }
            });
        }
    }
}
exports.StaffRepository = StaffRepository;
//# sourceMappingURL=staff-repository.js.map