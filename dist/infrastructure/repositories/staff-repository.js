"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffRepository = void 0;
const base_mongo_repository_1 = require("./base-mongo-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const logger_1 = require("../logger");
class StaffRepository extends base_mongo_repository_1.BaseMongoRepository {
    constructor() {
        super('staff');
    }
    async findByGuildId(guildId) {
        try {
            return await this.findByFilters({ guildId, status: 'active' });
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByUserId(guildId, userId) {
        try {
            return await this.findOne({ guildId, userId });
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff member ${userId} in guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByRole(guildId, role) {
        try {
            return await this.findByFilters({ guildId, role, status: 'active' });
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff by role ${role} in guild ${guildId}:`, error);
            throw error;
        }
    }
    async findByRoles(guildId, roles) {
        try {
            const collection = this.collection;
            const staff = await collection.find({
                guildId,
                role: { $in: roles },
                status: 'active'
            }).toArray();
            return staff;
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff by roles in guild ${guildId}:`, error);
            throw error;
        }
    }
    async getStaffCountByRole(guildId, role) {
        try {
            return await this.count({ guildId, role, status: 'active' });
        }
        catch (error) {
            logger_1.logger.error(`Error counting staff for role ${role} in guild ${guildId}:`, error);
            throw error;
        }
    }
    async getAllStaffCountsByRole(guildId) {
        try {
            const counts = {};
            for (const role of staff_role_1.RoleUtils.getAllRoles()) {
                counts[role] = await this.getStaffCountByRole(guildId, role);
            }
            return counts;
        }
        catch (error) {
            logger_1.logger.error(`Error getting all staff counts for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findStaffHierarchy(guildId) {
        try {
            const allStaff = await this.findByGuildId(guildId);
            // Sort by role level (highest to lowest)
            return allStaff.sort((a, b) => staff_role_1.RoleUtils.getRoleLevel(b.role) - staff_role_1.RoleUtils.getRoleLevel(a.role));
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff hierarchy for guild ${guildId}:`, error);
            throw error;
        }
    }
    async findStaffWithPagination(guildId, page = 1, limit = 10, roleFilter) {
        try {
            const skip = (page - 1) * limit;
            const filters = { guildId, status: 'active' };
            if (roleFilter) {
                filters.role = roleFilter;
            }
            const staff = await this.findMany(filters, limit, skip);
            const total = await this.count(filters);
            const totalPages = Math.ceil(total / limit);
            return { staff, total, totalPages };
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff with pagination for guild ${guildId}:`, error);
            throw error;
        }
    }
    async updateStaffRole(guildId, userId, newRole, promotedBy, reason) {
        try {
            const staff = await this.findByUserId(guildId, userId);
            if (!staff) {
                return null;
            }
            const oldRole = staff.role;
            const actionType = staff_role_1.RoleUtils.getRoleLevel(newRole) > staff_role_1.RoleUtils.getRoleLevel(oldRole)
                ? 'promotion'
                : 'demotion';
            const promotionRecord = {
                fromRole: oldRole,
                toRole: newRole,
                promotedBy,
                promotedAt: new Date(),
                reason,
                actionType,
            };
            const updatedPromotionHistory = [...staff.promotionHistory, promotionRecord];
            return await this.update(staff._id.toHexString(), {
                role: newRole,
                promotionHistory: updatedPromotionHistory,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error updating staff role for ${userId} in guild ${guildId}:`, error);
            throw error;
        }
    }
    async terminateStaff(guildId, userId, terminatedBy, reason) {
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
                actionType: 'fire',
            };
            const updatedPromotionHistory = [...staff.promotionHistory, terminationRecord];
            return await this.update(staff._id.toHexString(), {
                status: 'terminated',
                promotionHistory: updatedPromotionHistory,
            });
        }
        catch (error) {
            logger_1.logger.error(`Error terminating staff ${userId} in guild ${guildId}:`, error);
            throw error;
        }
    }
    async findSeniorStaff(guildId) {
        try {
            // Senior staff are Senior Partners and above (level 5+)
            const seniorRoles = staff_role_1.RoleUtils.getAllRoles().filter(role => staff_role_1.RoleUtils.getRoleLevel(role) >= 5);
            return await this.findByRoles(guildId, seniorRoles);
        }
        catch (error) {
            logger_1.logger.error(`Error finding senior staff for guild ${guildId}:`, error);
            throw error;
        }
    }
    async canHireRole(guildId, role) {
        try {
            const currentCount = await this.getStaffCountByRole(guildId, role);
            const maxCount = staff_role_1.RoleUtils.getRoleMaxCount(role);
            return currentCount < maxCount;
        }
        catch (error) {
            logger_1.logger.error(`Error checking if can hire ${role} in guild ${guildId}:`, error);
            return false;
        }
    }
    async findStaffByRobloxUsername(guildId, robloxUsername) {
        try {
            const collection = this.collection;
            const staff = await collection.findOne({
                guildId,
                robloxUsername: { $regex: new RegExp(`^${robloxUsername}$`, 'i') },
                status: 'active'
            });
            return staff || null;
        }
        catch (error) {
            logger_1.logger.error(`Error finding staff by Roblox username ${robloxUsername} in guild ${guildId}:`, error);
            throw error;
        }
    }
}
exports.StaffRepository = StaffRepository;
//# sourceMappingURL=staff-repository.js.map