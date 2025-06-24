"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_service_1 = require("../../application/services/staff-service");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const audit_log_1 = require("../../domain/entities/audit-log");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
describe('StaffService Integration Tests', () => {
    let staffService;
    let staffRepository;
    let auditLogRepository;
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
        await database_helpers_1.DatabaseTestHelpers.createIndexes();
    });
    beforeEach(async () => {
        staffRepository = new staff_repository_1.StaffRepository();
        auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        staffService = new staff_service_1.StaffService(staffRepository, auditLogRepository);
        await test_utils_1.TestUtils.clearTestDatabase();
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Staff Hiring Integration', () => {
        it('should hire staff member with complete workflow', async () => {
            const guildId = 'test-guild-123';
            const userId = 'user-123';
            const hiredBy = 'admin-123';
            const robloxUsername = 'TestRobloxUser';
            const result = await staffService.hireStaff({
                guildId,
                userId,
                hiredBy,
                robloxUsername,
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Verify staff record creation
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            expect(result.staff?.userId).toBe(userId);
            expect(result.staff?.guildId).toBe(guildId);
            expect(result.staff?.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(result.staff?.status).toBe('active');
            expect(result.staff?.robloxUsername).toBe(robloxUsername);
            expect(result.staff?.hiredBy).toBe(hiredBy);
            // Verify database persistence
            const savedStaff = await staffRepository.findByUserId(guildId, userId);
            expect(savedStaff).toBeDefined();
            expect(savedStaff?.userId).toBe(userId);
            // Verify audit log creation
            const auditLogs = await auditLogRepository.findByFilters({
                guildId,
                targetId: userId
            });
            expect(auditLogs).toHaveLength(1);
            expect(auditLogs[0].action).toBe(audit_log_1.AuditAction.STAFF_HIRED);
            expect(auditLogs[0].actorId).toBe(hiredBy);
        });
        it('should enforce role limits during hiring', async () => {
            const guildId = 'test-guild-123';
            const hiredBy = 'admin-123';
            // First hire should succeed
            const firstHire = await staffService.hireStaff({
                guildId,
                userId: 'user-1',
                hiredBy,
                robloxUsername: 'User1',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            expect(firstHire.success).toBe(true);
            // Try to hire second Managing Partner (limit is 1)
            const secondHire = await staffService.hireStaff({
                guildId,
                userId: 'user-2',
                hiredBy,
                robloxUsername: 'User2',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            expect(secondHire.success).toBe(false);
            expect(secondHire.error).toContain('Maximum limit');
            // Verify only one Managing Partner exists
            const managingPartners = await staffRepository.findByRole(guildId, staff_role_1.StaffRole.MANAGING_PARTNER);
            expect(managingPartners).toHaveLength(1);
        });
        it('should prevent duplicate staff hiring', async () => {
            const guildId = 'test-guild-123';
            const userId = 'user-123';
            const hiredBy = 'admin-123';
            // First hire should succeed
            const firstHire = await staffService.hireStaff({
                guildId,
                userId,
                hiredBy,
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(firstHire.success).toBe(true);
            // Second hire of same user should fail
            const secondHire = await staffService.hireStaff({
                guildId,
                userId,
                hiredBy,
                robloxUsername: 'TestUser2',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            expect(secondHire.success).toBe(false);
            expect(secondHire.error).toContain('already an active staff member');
        });
        it('should handle Roblox username conflicts', async () => {
            const guildId = 'test-guild-123';
            const hiredBy = 'admin-123';
            const robloxUsername = 'ConflictUser';
            // First hire with Roblox username
            const firstHire = await staffService.hireStaff({
                guildId,
                userId: 'user-1',
                hiredBy,
                robloxUsername,
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(firstHire.success).toBe(true);
            // Second hire with same Roblox username should fail
            const secondHire = await staffService.hireStaff({
                guildId,
                userId: 'user-2',
                hiredBy,
                robloxUsername,
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            expect(secondHire.success).toBe(false);
            expect(secondHire.error).toContain('already associated');
        });
    });
    describe('Staff Promotion Integration', () => {
        beforeEach(async () => {
            // Create initial staff member for promotion tests
            await staffService.hireStaff({
                guildId: 'test-guild-123',
                userId: 'user-123',
                hiredBy: 'admin-123',
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
        });
        it('should promote staff member with complete workflow', async () => {
            const guildId = 'test-guild-123';
            const userId = 'user-123';
            const promotedBy = 'manager-123';
            const result = await staffService.promoteStaff({
                guildId,
                userId,
                promotedBy,
                newRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                reason: 'Excellent performance'
            });
            // Verify promotion
            expect(result.success).toBe(true);
            expect(result.staff?.role).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            expect(result.staff?.promotionHistory.length).toBeGreaterThan(1);
            const promotion = result.staff?.promotionHistory.find(p => p.actionType === 'promotion');
            expect(promotion?.fromRole).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(promotion?.toRole).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            expect(promotion?.promotedBy).toBe(promotedBy);
            expect(promotion?.reason).toBe('Excellent performance');
            expect(promotion?.actionType).toBe('promotion');
            // Verify audit log
            const auditLogs = await auditLogRepository.findByFilters({
                guildId,
                targetId: userId,
                action: audit_log_1.AuditAction.STAFF_PROMOTED
            });
            expect(auditLogs).toHaveLength(1);
        });
        it('should prevent invalid promotions', async () => {
            const guildId = 'test-guild-123';
            const userId = 'user-123';
            const promotedBy = 'manager-123';
            // Try to promote to same role
            const sameRoleResult = await staffService.promoteStaff({
                guildId,
                userId,
                promotedBy,
                newRole: staff_role_1.StaffRole.PARALEGAL
            });
            expect(sameRoleResult.success).toBe(false);
            expect(sameRoleResult.error).toContain('higher than current role');
        });
    });
    describe('Staff Firing Integration', () => {
        beforeEach(async () => {
            // Create staff member for firing tests
            await staffService.hireStaff({
                guildId: 'test-guild-123',
                userId: 'user-123',
                hiredBy: 'admin-123',
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
        });
        it('should fire staff member with complete workflow', async () => {
            const guildId = 'test-guild-123';
            const userId = 'user-123';
            const terminatedBy = 'admin-123';
            const reason = 'Policy violation';
            const result = await staffService.fireStaff({
                guildId,
                userId,
                terminatedBy,
                reason
            });
            // Verify firing (only logs action, doesn't change status immediately)
            expect(result.success).toBe(true);
            expect(result.staff).toBeDefined();
            // Verify audit log
            const auditLogs = await auditLogRepository.findByFilters({
                guildId,
                targetId: userId,
                action: audit_log_1.AuditAction.STAFF_FIRED
            });
            expect(auditLogs).toHaveLength(1);
        });
        it('should prevent firing non-existent staff', async () => {
            const guildId = 'test-guild-123';
            const userId = 'non-existent-user';
            const terminatedBy = 'admin-123';
            const result = await staffService.fireStaff({
                guildId,
                userId,
                terminatedBy,
                reason: 'Test'
            });
            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });
    });
    describe('Staff Querying and Statistics', () => {
        beforeEach(async () => {
            // Create diverse staff for testing
            const staffMembers = [
                { userId: 'user-1', role: staff_role_1.StaffRole.MANAGING_PARTNER, robloxUsername: 'MP1' },
                { userId: 'user-2', role: staff_role_1.StaffRole.SENIOR_PARTNER, robloxUsername: 'SP1' },
                { userId: 'user-3', role: staff_role_1.StaffRole.JUNIOR_PARTNER, robloxUsername: 'JP1' },
                { userId: 'user-4', role: staff_role_1.StaffRole.SENIOR_ASSOCIATE, robloxUsername: 'SA1' },
                { userId: 'user-5', role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE, robloxUsername: 'JA1' },
                { userId: 'user-6', role: staff_role_1.StaffRole.PARALEGAL, robloxUsername: 'P1' }
            ];
            for (const member of staffMembers) {
                await staffService.hireStaff({
                    guildId: 'test-guild-123',
                    userId: member.userId,
                    hiredBy: 'admin-123',
                    robloxUsername: member.robloxUsername,
                    role: member.role
                });
            }
        });
        it('should retrieve staff members with pagination', async () => {
            const guildId = 'test-guild-123';
            const staffList = await staffService.getStaffList(guildId, 'admin-123');
            expect(staffList.staff).toHaveLength(6);
            expect(staffList.total).toBe(6);
            // Verify role distribution
            const roleCounts = await staffService.getRoleCounts(guildId);
            expect(roleCounts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(1);
            expect(roleCounts[staff_role_1.StaffRole.SENIOR_PARTNER]).toBe(1);
            expect(roleCounts[staff_role_1.StaffRole.PARALEGAL]).toBe(1);
        });
        it('should retrieve staff hierarchy overview', async () => {
            const guildId = 'test-guild-123';
            const hierarchy = await staffService.getStaffHierarchy(guildId);
            expect(hierarchy).toBeDefined();
            expect(hierarchy.length).toBe(6);
            const roleCounts = await staffService.getRoleCounts(guildId);
            expect(roleCounts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(1);
        });
    });
    describe('Error Handling and Edge Cases', () => {
        it('should handle database connection failures gracefully', async () => {
            // Simulate database error
            await database_helpers_1.DatabaseTestHelpers.simulateDatabaseError();
            await expect(staffService.getStaffList('test-guild-123', 'admin-123'))
                .rejects.toThrow();
            // Restore database
            await database_helpers_1.DatabaseTestHelpers.restoreDatabase();
        });
        it('should handle malformed staff data', async () => {
            const result1 = await staffService.hireStaff({
                guildId: 'test-guild-123',
                userId: '',
                hiredBy: 'admin-123',
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(result1.success).toBe(false);
            const result2 = await staffService.hireStaff({
                guildId: 'test-guild-123',
                userId: 'user-123',
                hiredBy: '',
                robloxUsername: 'TestUser',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(result2.success).toBe(false);
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain strict guild isolation', async () => {
            const guild1 = 'guild-1';
            const guild2 = 'guild-2';
            const userId = 'user-123';
            // Hire same user in different guilds
            await staffService.hireStaff({
                guildId: guild1,
                userId,
                hiredBy: 'admin-1',
                robloxUsername: 'User1',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            await staffService.hireStaff({
                guildId: guild2,
                userId,
                hiredBy: 'admin-2',
                robloxUsername: 'User2',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Verify isolation
            const guild1StaffList = await staffService.getStaffList(guild1, 'admin-1');
            const guild2StaffList = await staffService.getStaffList(guild2, 'admin-2');
            expect(guild1StaffList.staff).toHaveLength(1);
            expect(guild2StaffList.staff).toHaveLength(1);
            expect(guild1StaffList.staff[0].role).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
            expect(guild2StaffList.staff[0].role).toBe(staff_role_1.StaffRole.PARALEGAL);
            // Verify separate role limits through role counts
            const guild1Counts = await staffService.getRoleCounts(guild1);
            const guild2Counts = await staffService.getRoleCounts(guild2);
            expect(guild1Counts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(1); // Guild 1 has MP
            expect(guild2Counts[staff_role_1.StaffRole.MANAGING_PARTNER]).toBe(0); // Guild 2 doesn't have MP
        });
    });
});
//# sourceMappingURL=staff-service-integration.test.js.map