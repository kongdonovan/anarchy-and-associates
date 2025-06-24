"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_service_1 = require("../../application/services/staff-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
// Mock the repositories
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');
describe('StaffService', () => {
    let staffService;
    let mockStaffRepository;
    let mockAuditLogRepository;
    beforeEach(() => {
        mockStaffRepository = new staff_repository_1.StaffRepository();
        mockAuditLogRepository = new audit_log_repository_1.AuditLogRepository();
        staffService = new staff_service_1.StaffService(mockStaffRepository, mockAuditLogRepository);
    });
    describe('validateRobloxUsername', () => {
        it('should validate correct Roblox usernames', async () => {
            const validUsernames = ['TestUser123', 'User_Name', 'ValidName'];
            for (const username of validUsernames) {
                const result = await staffService.validateRobloxUsername(username);
                expect(result.isValid).toBe(true);
                expect(result.username).toBe(username);
                expect(result.error).toBeUndefined();
            }
        });
        it('should reject usernames that are too short', async () => {
            const result = await staffService.validateRobloxUsername('ab');
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('3-20 characters');
        });
        it('should reject usernames that are too long', async () => {
            const result = await staffService.validateRobloxUsername('a'.repeat(21));
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('3-20 characters');
        });
        it('should reject usernames with invalid characters', async () => {
            const invalidUsernames = ['user-name', 'user@name', 'user name', 'user!'];
            for (const username of invalidUsernames) {
                const result = await staffService.validateRobloxUsername(username);
                expect(result.isValid).toBe(false);
            }
        });
        it('should reject usernames starting or ending with underscore', async () => {
            const result1 = await staffService.validateRobloxUsername('_username');
            expect(result1.isValid).toBe(false);
            expect(result1.error).toContain('cannot start or end with an underscore');
            const result2 = await staffService.validateRobloxUsername('username_');
            expect(result2.isValid).toBe(false);
            expect(result2.error).toContain('cannot start or end with an underscore');
        });
    });
    describe('hireStaff', () => {
        const hireRequest = {
            guildId: 'guild123',
            userId: 'user123',
            robloxUsername: 'TestUser',
            role: staff_role_1.StaffRole.PARALEGAL,
            hiredBy: 'admin123',
            reason: 'Test hire',
        };
        beforeEach(() => {
            mockStaffRepository.findByUserId.mockResolvedValue(null);
            mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue(null);
            mockStaffRepository.canHireRole.mockResolvedValue(true);
            mockAuditLogRepository.logAction.mockResolvedValue({});
        });
        it('should successfully hire a new staff member', async () => {
            const mockStaff = {
                _id: {},
                ...hireRequest,
                hiredAt: new Date(),
                promotionHistory: [],
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            mockStaffRepository.add.mockResolvedValue(mockStaff);
            const result = await staffService.hireStaff(hireRequest);
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            expect(mockStaffRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                userId: hireRequest.userId,
                role: hireRequest.role,
                robloxUsername: hireRequest.robloxUsername,
                status: 'active',
            }));
            expect(mockAuditLogRepository.logAction).toHaveBeenCalled();
        });
        it('should reject invalid Roblox username', async () => {
            const invalidRequest = { ...hireRequest, robloxUsername: 'ab' };
            const result = await staffService.hireStaff(invalidRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('3-20 characters');
            expect(mockStaffRepository.add).not.toHaveBeenCalled();
        });
        it('should reject if user is already staff', async () => {
            mockStaffRepository.findByUserId.mockResolvedValue({
                status: 'active',
            });
            const result = await staffService.hireStaff(hireRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('already an active staff member');
            expect(mockStaffRepository.add).not.toHaveBeenCalled();
        });
        it('should reject if Roblox username is already used', async () => {
            mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue({});
            const result = await staffService.hireStaff(hireRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('already associated with another staff member');
            expect(mockStaffRepository.add).not.toHaveBeenCalled();
        });
        it('should reject if role limit reached', async () => {
            mockStaffRepository.canHireRole.mockResolvedValue(false);
            const result = await staffService.hireStaff(hireRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Maximum limit');
            expect(mockStaffRepository.add).not.toHaveBeenCalled();
        });
    });
    describe('promoteStaff', () => {
        const promotionRequest = {
            guildId: 'guild123',
            userId: 'user123',
            newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
            promotedBy: 'admin123',
            reason: 'Good performance',
        };
        const mockStaff = {
            _id: {},
            userId: 'user123',
            guildId: 'guild123',
            role: staff_role_1.StaffRole.PARALEGAL,
            status: 'active',
            robloxUsername: 'TestUser',
            hiredAt: new Date(),
            hiredBy: 'admin123',
            promotionHistory: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        beforeEach(() => {
            mockStaffRepository.findByUserId.mockResolvedValue(mockStaff);
            mockStaffRepository.canHireRole.mockResolvedValue(true);
            mockAuditLogRepository.logAction.mockResolvedValue({});
        });
        it('should successfully promote a staff member', async () => {
            const updatedStaff = { ...mockStaff, role: promotionRequest.newRole };
            mockStaffRepository.updateStaffRole.mockResolvedValue(updatedStaff);
            const result = await staffService.promoteStaff(promotionRequest);
            expect(result.success).toBe(true);
            expect(result.staff?.role).toBe(promotionRequest.newRole);
            expect(mockStaffRepository.updateStaffRole).toHaveBeenCalledWith(promotionRequest.guildId, promotionRequest.userId, promotionRequest.newRole, promotionRequest.promotedBy, promotionRequest.reason);
            expect(mockAuditLogRepository.logAction).toHaveBeenCalled();
        });
        it('should reject if staff member not found', async () => {
            mockStaffRepository.findByUserId.mockResolvedValue(null);
            const result = await staffService.promoteStaff(promotionRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found or inactive');
            expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
        });
        it('should reject if new role is not higher', async () => {
            const invalidRequest = { ...promotionRequest, newRole: staff_role_1.StaffRole.PARALEGAL };
            const result = await staffService.promoteStaff(invalidRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('must be higher than current role');
            expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
        });
        it('should reject if role limit reached for new role', async () => {
            mockStaffRepository.canHireRole.mockResolvedValue(false);
            const result = await staffService.promoteStaff(promotionRequest);
            expect(result.success).toBe(false);
            expect(result.error).toContain('Maximum limit');
            expect(mockStaffRepository.updateStaffRole).not.toHaveBeenCalled();
        });
    });
});
//# sourceMappingURL=staff-service.test.js.map