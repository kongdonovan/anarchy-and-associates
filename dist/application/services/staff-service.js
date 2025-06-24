"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffService = void 0;
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const logger_1 = require("../../infrastructure/logger");
class StaffService {
    constructor(staffRepository, auditLogRepository) {
        this.staffRepository = staffRepository;
        this.auditLogRepository = auditLogRepository;
    }
    async validateRobloxUsername(username) {
        try {
            // Basic regex validation for Roblox usernames
            // Roblox usernames are 3-20 characters, alphanumeric and underscores only
            const robloxUsernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
            if (!robloxUsernameRegex.test(username)) {
                return {
                    isValid: false,
                    username,
                    error: 'Username must be 3-20 characters and contain only letters, numbers, and underscores',
                };
            }
            // Check if username doesn't start or end with underscore
            if (username.startsWith('_') || username.endsWith('_')) {
                return {
                    isValid: false,
                    username,
                    error: 'Username cannot start or end with an underscore',
                };
            }
            return {
                isValid: true,
                username,
            };
        }
        catch (error) {
            logger_1.logger.error('Error validating Roblox username:', error);
            return {
                isValid: false,
                username,
                error: 'Failed to validate username',
            };
        }
    }
    async hireStaff(request) {
        try {
            const { guildId, userId, robloxUsername, role, hiredBy, reason } = request;
            // Validate Roblox username
            const robloxValidation = await this.validateRobloxUsername(robloxUsername);
            if (!robloxValidation.isValid) {
                return {
                    success: false,
                    error: robloxValidation.error,
                };
            }
            // Check if user is already staff
            const existingStaff = await this.staffRepository.findByUserId(guildId, userId);
            if (existingStaff && existingStaff.status === 'active') {
                return {
                    success: false,
                    error: 'User is already an active staff member',
                };
            }
            // Check if Roblox username is already used
            const existingRobloxStaff = await this.staffRepository.findStaffByRobloxUsername(guildId, robloxUsername);
            if (existingRobloxStaff) {
                return {
                    success: false,
                    error: 'Roblox username is already associated with another staff member',
                };
            }
            // Check role limits
            const canHire = await this.staffRepository.canHireRole(guildId, role);
            if (!canHire) {
                const maxCount = staff_role_1.RoleUtils.getRoleMaxCount(role);
                return {
                    success: false,
                    error: `Cannot hire ${role}. Maximum limit of ${maxCount} reached`,
                };
            }
            // Create staff record
            const staffData = {
                userId,
                guildId,
                robloxUsername: robloxValidation.username,
                role,
                hiredAt: new Date(),
                hiredBy,
                promotionHistory: [
                    {
                        fromRole: role, // First hire, from and to are the same
                        toRole: role,
                        promotedBy: hiredBy,
                        promotedAt: new Date(),
                        reason,
                        actionType: 'hire',
                    },
                ],
                status: 'active',
            };
            const staff = await this.staffRepository.add(staffData);
            // Log the action
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_HIRED,
                actorId: hiredBy,
                targetId: userId,
                details: {
                    after: {
                        role,
                        status: 'active',
                    },
                    reason,
                    metadata: {
                        robloxUsername: robloxValidation.username,
                    },
                },
                timestamp: new Date(),
            });
            logger_1.logger.info(`Staff hired: ${userId} as ${role} in guild ${guildId}`);
            return {
                success: true,
                staff,
            };
        }
        catch (error) {
            logger_1.logger.error('Error hiring staff:', error);
            return {
                success: false,
                error: 'Failed to hire staff member',
            };
        }
    }
    async promoteStaff(request) {
        try {
            const { guildId, userId, newRole, promotedBy, reason } = request;
            // Find the staff member
            const staff = await this.staffRepository.findByUserId(guildId, userId);
            if (!staff || staff.status !== 'active') {
                return {
                    success: false,
                    error: 'Staff member not found or inactive',
                };
            }
            const currentRole = staff.role;
            // Check if it's actually a promotion
            if (staff_role_1.RoleUtils.getRoleLevel(newRole) <= staff_role_1.RoleUtils.getRoleLevel(currentRole)) {
                return {
                    success: false,
                    error: 'New role must be higher than current role for promotion',
                };
            }
            // Check role limits for new role
            const canHire = await this.staffRepository.canHireRole(guildId, newRole);
            if (!canHire) {
                const maxCount = staff_role_1.RoleUtils.getRoleMaxCount(newRole);
                return {
                    success: false,
                    error: `Cannot promote to ${newRole}. Maximum limit of ${maxCount} reached`,
                };
            }
            // Update staff role
            const updatedStaff = await this.staffRepository.updateStaffRole(guildId, userId, newRole, promotedBy, reason);
            if (!updatedStaff) {
                return {
                    success: false,
                    error: 'Failed to update staff role',
                };
            }
            // Log the action
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_PROMOTED,
                actorId: promotedBy,
                targetId: userId,
                details: {
                    before: { role: currentRole },
                    after: { role: newRole },
                    reason,
                },
                timestamp: new Date(),
            });
            logger_1.logger.info(`Staff promoted: ${userId} from ${currentRole} to ${newRole} in guild ${guildId}`);
            return {
                success: true,
                staff: updatedStaff,
            };
        }
        catch (error) {
            logger_1.logger.error('Error promoting staff:', error);
            return {
                success: false,
                error: 'Failed to promote staff member',
            };
        }
    }
    async demoteStaff(request) {
        try {
            const { guildId, userId, newRole, promotedBy, reason } = request;
            // Find the staff member
            const staff = await this.staffRepository.findByUserId(guildId, userId);
            if (!staff || staff.status !== 'active') {
                return {
                    success: false,
                    error: 'Staff member not found or inactive',
                };
            }
            const currentRole = staff.role;
            // Check if it's actually a demotion
            if (staff_role_1.RoleUtils.getRoleLevel(newRole) >= staff_role_1.RoleUtils.getRoleLevel(currentRole)) {
                return {
                    success: false,
                    error: 'New role must be lower than current role for demotion',
                };
            }
            // Update staff role
            const updatedStaff = await this.staffRepository.updateStaffRole(guildId, userId, newRole, promotedBy, reason);
            if (!updatedStaff) {
                return {
                    success: false,
                    error: 'Failed to update staff role',
                };
            }
            // Log the action
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_DEMOTED,
                actorId: promotedBy,
                targetId: userId,
                details: {
                    before: { role: currentRole },
                    after: { role: newRole },
                    reason,
                },
                timestamp: new Date(),
            });
            logger_1.logger.info(`Staff demoted: ${userId} from ${currentRole} to ${newRole} in guild ${guildId}`);
            return {
                success: true,
                staff: updatedStaff,
            };
        }
        catch (error) {
            logger_1.logger.error('Error demoting staff:', error);
            return {
                success: false,
                error: 'Failed to demote staff member',
            };
        }
    }
    async fireStaff(request) {
        try {
            const { guildId, userId, terminatedBy, reason } = request;
            // Find the staff member
            const staff = await this.staffRepository.findByUserId(guildId, userId);
            if (!staff || staff.status !== 'active') {
                return {
                    success: false,
                    error: 'Staff member not found or inactive',
                };
            }
            // Note: We don't modify the database here - the role tracking service
            // will handle database changes when Discord roles are removed
            // Log the action
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_FIRED,
                actorId: terminatedBy,
                targetId: userId,
                details: {
                    before: {
                        role: staff.role,
                        status: 'active',
                    },
                    reason,
                    metadata: {
                        robloxUsername: staff.robloxUsername,
                        firedBy: terminatedBy,
                    },
                },
                timestamp: new Date(),
            });
            logger_1.logger.info(`Staff firing initiated: ${userId} (${staff.role}) by ${terminatedBy} in guild ${guildId}`);
            return {
                success: true,
                staff,
            };
        }
        catch (error) {
            logger_1.logger.error('Error firing staff:', error);
            return {
                success: false,
                error: 'Failed to fire staff member',
            };
        }
    }
    async getStaffInfo(guildId, userId, requestedBy) {
        try {
            const staff = await this.staffRepository.findByUserId(guildId, userId);
            // Log the info access
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_INFO_VIEWED,
                actorId: requestedBy,
                targetId: userId,
                details: {
                    metadata: {
                        found: !!staff,
                    },
                },
                timestamp: new Date(),
            });
            return staff;
        }
        catch (error) {
            logger_1.logger.error('Error getting staff info:', error);
            throw error;
        }
    }
    async getStaffList(guildId, requestedBy, roleFilter, page = 1, limit = 10) {
        try {
            const result = await this.staffRepository.findStaffWithPagination(guildId, page, limit, roleFilter);
            // Log the list access
            await this.auditLogRepository.logAction({
                guildId,
                action: audit_log_1.AuditAction.STAFF_LIST_VIEWED,
                actorId: requestedBy,
                details: {
                    metadata: {
                        roleFilter,
                        page,
                        limit,
                        resultCount: result.staff.length,
                    },
                },
                timestamp: new Date(),
            });
            return result;
        }
        catch (error) {
            logger_1.logger.error('Error getting staff list:', error);
            throw error;
        }
    }
    async getStaffHierarchy(guildId) {
        try {
            return await this.staffRepository.findStaffHierarchy(guildId);
        }
        catch (error) {
            logger_1.logger.error('Error getting staff hierarchy:', error);
            throw error;
        }
    }
    async getRoleCounts(guildId) {
        try {
            return await this.staffRepository.getAllStaffCountsByRole(guildId);
        }
        catch (error) {
            logger_1.logger.error('Error getting role counts:', error);
            throw error;
        }
    }
}
exports.StaffService = StaffService;
//# sourceMappingURL=staff-service.js.map