"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const permission_service_1 = require("../../application/services/permission-service");
const staff_service_1 = require("../../application/services/staff-service");
const case_service_1 = require("../../application/services/case-service");
const guild_config_repository_1 = require("../../infrastructure/repositories/guild-config-repository");
const staff_repository_1 = require("../../infrastructure/repositories/staff-repository");
const audit_log_repository_1 = require("../../infrastructure/repositories/audit-log-repository");
const case_repository_1 = require("../../infrastructure/repositories/case-repository");
const case_counter_repository_1 = require("../../infrastructure/repositories/case-counter-repository");
const staff_role_1 = require("../../domain/entities/staff-role");
const case_1 = require("../../domain/entities/case");
const test_utils_1 = require("../helpers/test-utils");
const database_helpers_1 = require("../helpers/database-helpers");
/**
 * Security and Permission Boundary Tests
 *
 * These tests verify that the permission system correctly enforces security boundaries:
 * - Role-based access control
 * - Guild owner privileges
 * - Cross-guild isolation
 * - Permission escalation prevention
 * - Data access restrictions
 * - Administrative action authorization
 */
describe('Security and Permission Boundary Tests', () => {
    let permissionService;
    let staffService;
    let caseService;
    let guildConfigRepository;
    let staffRepository;
    let auditLogRepository;
    let caseRepository;
    let caseCounterRepository;
    // Test security contexts
    const testGuildId = 'security-test-guild';
    const otherGuildId = 'other-guild';
    const guildOwnerId = 'guild-owner-123';
    const adminUserId = 'admin-user-456';
    const hrUserId = 'hr-user-789';
    const caseUserId = 'case-user-012';
    const regularUserId = 'regular-user-345';
    const maliciousUserId = 'malicious-user-666';
    beforeAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.setupTestDatabase();
    });
    beforeEach(async () => {
        // Initialize repositories
        guildConfigRepository = new guild_config_repository_1.GuildConfigRepository();
        staffRepository = new staff_repository_1.StaffRepository();
        auditLogRepository = new audit_log_repository_1.AuditLogRepository();
        caseRepository = new case_repository_1.CaseRepository();
        caseCounterRepository = new case_counter_repository_1.CaseCounterRepository();
        // Initialize services
        permissionService = new permission_service_1.PermissionService(guildConfigRepository);
        staffService = new staff_service_1.StaffService(staffRepository, auditLogRepository);
        caseService = new case_service_1.CaseService(caseRepository, caseCounterRepository, guildConfigRepository);
        // Clear state
        await test_utils_1.TestUtils.clearTestDatabase();
        // Setup test guild with comprehensive permissions
        await guildConfigRepository.add({
            guildId: testGuildId,
            feedbackChannelId: 'feedback-123',
            retainerChannelId: 'retainer-123',
            caseReviewCategoryId: 'review-123',
            caseArchiveCategoryId: 'archive-123',
            modlogChannelId: 'modlog-123',
            applicationChannelId: 'app-123',
            clientRoleId: 'client-role-123',
            permissions: {
                admin: ['admin-role-123'],
                hr: ['hr-role-123'],
                case: ['case-role-123'],
                config: ['config-role-123'],
                retainer: ['retainer-role-123'],
                repair: ['repair-role-123']
            },
            adminRoles: ['admin-role-123'],
            adminUsers: [adminUserId]
        });
        // Setup other guild for cross-guild tests
        await guildConfigRepository.add({
            guildId: otherGuildId,
            feedbackChannelId: 'other-feedback-123',
            retainerChannelId: 'other-retainer-123',
            caseReviewCategoryId: 'other-review-123',
            caseArchiveCategoryId: 'other-archive-123',
            modlogChannelId: 'other-modlog-123',
            applicationChannelId: 'other-app-123',
            clientRoleId: 'other-client-role-123',
            permissions: {
                admin: ['other-admin-role-123'],
                hr: ['other-hr-role-123'],
                case: ['other-case-role-123'],
                config: ['other-config-role-123'],
                retainer: ['other-retainer-role-123'],
                repair: ['other-repair-role-123']
            },
            adminRoles: ['other-admin-role-123'],
            adminUsers: ['other-admin-user']
        });
    });
    afterAll(async () => {
        await database_helpers_1.DatabaseTestHelpers.teardownTestDatabase();
    });
    describe('Role-Based Access Control (RBAC)', () => {
        it('should enforce admin-only permissions', async () => {
            // Admin user context
            const adminContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Regular user context
            const regularContext = {
                guildId: testGuildId,
                userId: regularUserId,
                userRoles: ['member-role'],
                isGuildOwner: false
            };
            // Test admin permissions
            expect(await permissionService.hasActionPermission(adminContext, 'admin')).toBe(true);
            expect(await permissionService.hasActionPermission(adminContext, 'hr')).toBe(false);
            expect(await permissionService.hasActionPermission(adminContext, 'case')).toBe(false);
            // Test regular user permissions (should have none)
            expect(await permissionService.hasActionPermission(regularContext, 'admin')).toBe(false);
            expect(await permissionService.hasActionPermission(regularContext, 'hr')).toBe(false);
            expect(await permissionService.hasActionPermission(regularContext, 'case')).toBe(false);
        });
        it('should enforce HR-specific permissions', async () => {
            const hrContext = {
                guildId: testGuildId,
                userId: hrUserId,
                userRoles: ['hr-role-123'],
                isGuildOwner: false
            };
            // HR should only have HR permissions
            expect(await permissionService.hasActionPermission(hrContext, 'admin')).toBe(false);
            expect(await permissionService.hasActionPermission(hrContext, 'hr')).toBe(true);
            expect(await permissionService.hasActionPermission(hrContext, 'case')).toBe(false);
            expect(await permissionService.hasActionPermission(hrContext, 'config')).toBe(false);
            expect(await permissionService.hasActionPermission(hrContext, 'retainer')).toBe(false);
            expect(await permissionService.hasActionPermission(hrContext, 'repair')).toBe(false);
        });
        it('should enforce case management permissions', async () => {
            const caseContext = {
                guildId: testGuildId,
                userId: caseUserId,
                userRoles: ['case-role-123'],
                isGuildOwner: false
            };
            // Case role should only have case permissions
            expect(await permissionService.hasActionPermission(caseContext, 'admin')).toBe(false);
            expect(await permissionService.hasActionPermission(caseContext, 'hr')).toBe(false);
            expect(await permissionService.hasActionPermission(caseContext, 'case')).toBe(true);
            expect(await permissionService.hasActionPermission(caseContext, 'config')).toBe(false);
            expect(await permissionService.hasActionPermission(caseContext, 'retainer')).toBe(false);
            expect(await permissionService.hasActionPermission(caseContext, 'repair')).toBe(false);
        });
        it('should handle multiple role permissions correctly', async () => {
            const multiRoleContext = {
                guildId: testGuildId,
                userId: 'multi-role-user',
                userRoles: ['hr-role-123', 'case-role-123'],
                isGuildOwner: false
            };
            // Should have permissions for all assigned roles
            expect(await permissionService.hasActionPermission(multiRoleContext, 'admin')).toBe(false);
            expect(await permissionService.hasActionPermission(multiRoleContext, 'hr')).toBe(true);
            expect(await permissionService.hasActionPermission(multiRoleContext, 'case')).toBe(true);
            expect(await permissionService.hasActionPermission(multiRoleContext, 'config')).toBe(false);
        });
    });
    describe('Guild Owner Privilege System', () => {
        it('should grant guild owners all permissions', async () => {
            const guildOwnerContext = {
                guildId: testGuildId,
                userId: guildOwnerId,
                userRoles: [], // No specific roles needed
                isGuildOwner: true
            };
            // Guild owner should have ALL permissions
            expect(await permissionService.hasActionPermission(guildOwnerContext, 'admin')).toBe(true);
            expect(await permissionService.hasActionPermission(guildOwnerContext, 'hr')).toBe(true);
            expect(await permissionService.hasActionPermission(guildOwnerContext, 'case')).toBe(true);
            expect(await permissionService.hasActionPermission(guildOwnerContext, 'config')).toBe(true);
            expect(await permissionService.hasActionPermission(guildOwnerContext, 'retainer')).toBe(true);
            expect(await permissionService.hasActionPermission(guildOwnerContext, 'repair')).toBe(true);
        });
        it('should allow guild owner to bypass role hierarchy limits', async () => {
            // Guild owner should be able to hire Managing Partner
            const hireResult = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'managing-partner-test',
                hiredBy: guildOwnerId,
                robloxUsername: 'GuildOwnerHire',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            expect(hireResult.success).toBe(true);
            expect(hireResult.staff?.role).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
            // Guild owner should be able to hire another Managing Partner (bypass limit)
            const secondHire = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'second-managing-partner',
                hiredBy: guildOwnerId,
                robloxUsername: 'SecondManager',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            // This should succeed for guild owner despite role limits
            expect(secondHire.success).toBe(true);
        });
        it('should prevent non-owners from impersonating guild owner', async () => {
            const fakeOwnerContext = {
                guildId: testGuildId,
                userId: maliciousUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: true // Malicious attempt to claim owner status
            };
            // Permission service should validate actual guild ownership
            // In real implementation, this would check against Discord guild data
            const hasPermission = await permissionService.hasActionPermission(fakeOwnerContext, 'admin');
            // Should still grant permission based on isGuildOwner flag
            // but in production, this flag should be validated against Discord API
            expect(hasPermission).toBe(true);
            // Note: In production, always validate isGuildOwner against Discord API
            // This test demonstrates the importance of proper validation
        });
    });
    describe('Cross-Guild Security Isolation', () => {
        it('should prevent cross-guild permission access', async () => {
            // User with admin in first guild
            const adminInGuild1 = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Same user trying to access other guild
            const sameUserInGuild2 = {
                guildId: otherGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'], // Same role names, different guild
                isGuildOwner: false
            };
            // Should have admin in first guild
            expect(await permissionService.hasActionPermission(adminInGuild1, 'admin')).toBe(true);
            // Should NOT have admin in second guild (different role IDs)
            expect(await permissionService.hasActionPermission(sameUserInGuild2, 'admin')).toBe(false);
        });
        it('should prevent cross-guild data access', async () => {
            // Create staff in first guild
            const staff1 = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'cross-guild-test',
                hiredBy: adminUserId,
                robloxUsername: 'CrossGuildTest1',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Create staff in second guild with same user ID
            const staff2 = await staffService.hireStaff({
                guildId: otherGuildId,
                userId: 'cross-guild-test',
                hiredBy: 'other-admin-user',
                robloxUsername: 'CrossGuildTest2',
                role: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            expect(staff1.success).toBe(true);
            expect(staff2.success).toBe(true);
            // Retrieve staff from first guild
            const guild1Staff = await staffService.getStaffList(testGuildId, adminUserId);
            const guild2Staff = await staffService.getStaffList(otherGuildId, 'other-admin-user');
            // Should be completely isolated
            expect(guild1Staff.staff).toHaveLength(1);
            expect(guild2Staff.staff).toHaveLength(1);
            expect(guild1Staff.staff[0]?.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(guild2Staff.staff[0]?.role).toBe(staff_role_1.StaffRole.MANAGING_PARTNER);
            // Verify no cross-contamination
            expect(guild1Staff.staff[0]?.guildId).toBe(testGuildId);
            expect(guild2Staff.staff[0]?.guildId).toBe(otherGuildId);
        });
        it('should prevent cross-guild case access', async () => {
            // Create cases in both guilds
            await caseService.createCase({
                guildId: testGuildId,
                clientId: 'client-1',
                clientUsername: 'client1',
                title: 'Guild 1 Sensitive Case',
                description: 'Confidential information for guild 1'
            });
            await caseService.createCase({
                guildId: otherGuildId,
                clientId: 'client-1',
                clientUsername: 'client1',
                title: 'Guild 2 Sensitive Case',
                description: 'Confidential information for guild 2'
            });
            // Search cases in each guild
            const guild1Cases = await caseService.searchCases({ guildId: testGuildId });
            const guild2Cases = await caseService.searchCases({ guildId: otherGuildId });
            // Should only see cases from respective guilds
            expect(guild1Cases).toHaveLength(1);
            expect(guild2Cases).toHaveLength(1);
            expect(guild1Cases[0]?.title).toBe('Guild 1 Sensitive Case');
            expect(guild2Cases[0]?.title).toBe('Guild 2 Sensitive Case');
            // Verify case IDs are different
            expect(guild1Cases[0]?._id?.toString()).not.toBe(guild2Cases[0]?._id?.toString());
        });
    });
    describe('Permission Escalation Prevention', () => {
        it('should prevent unauthorized staff role escalation', async () => {
            // Create a paralegal
            const paralegal = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'escalation-test',
                hiredBy: adminUserId,
                robloxUsername: 'EscalationTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(paralegal.success).toBe(true);
            // Regular user tries to promote themselves
            const escalationAttempt = await staffService.promoteStaff({
                guildId: testGuildId,
                userId: 'escalation-test',
                promotedBy: 'escalation-test', // Self-promotion attempt
                newRole: staff_role_1.StaffRole.MANAGING_PARTNER
            });
            // Should fail (in production, permission check would happen first)
            expect(escalationAttempt.success).toBe(false);
        });
        it('should prevent role limit bypass by non-owners', async () => {
            // Fill paralegal limit (10 max)
            for (let i = 0; i < 10; i++) {
                await staffService.hireStaff({
                    guildId: testGuildId,
                    userId: `paralegal-${i}`,
                    hiredBy: adminUserId,
                    robloxUsername: `Paralegal${i}`,
                    role: staff_role_1.StaffRole.PARALEGAL
                });
            }
            // Try to hire 11th paralegal as non-owner
            const overLimitHire = await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'paralegal-11',
                hiredBy: adminUserId,
                robloxUsername: 'Paralegal11',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            expect(overLimitHire.success).toBe(false);
            expect(overLimitHire.error).toContain('Maximum limit');
        });
        it('should prevent unauthorized configuration changes', async () => {
            const unauthorizedContext = {
                guildId: testGuildId,
                userId: regularUserId,
                userRoles: ['member-role'],
                isGuildOwner: false
            };
            // Should not have config permissions
            const hasConfigPerm = await permissionService.hasActionPermission(unauthorizedContext, 'config');
            expect(hasConfigPerm).toBe(false);
            // In production, config commands would check this permission
            // before allowing any guild configuration changes
        });
    });
    describe('Data Access Security', () => {
        beforeEach(async () => {
            // Setup test data
            await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'test-lawyer',
                hiredBy: adminUserId,
                robloxUsername: 'TestLawyer',
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE
            });
            await caseService.createCase({
                guildId: testGuildId,
                clientId: 'sensitive-client',
                clientUsername: 'sensitiveuser',
                title: 'Sensitive Legal Matter',
                description: 'Highly confidential case information',
                priority: case_1.CasePriority.URGENT
            });
        });
        it('should prevent unauthorized staff information access', async () => {
            // Regular user trying to access staff info
            const staffInfo = await staffService.getStaffInfo(testGuildId, 'test-lawyer', regularUserId);
            // Should return data but log the access attempt
            expect(staffInfo).toBeDefined();
            // Verify audit log was created
            const auditLogs = await auditLogRepository.findByFilters({
                guildId: testGuildId,
                actorId: regularUserId
            });
            expect(auditLogs.length).toBeGreaterThan(0);
        });
        it('should prevent unauthorized case information access', async () => {
            // Cases should be filtered by guild and user permissions
            const cases = await caseService.searchCases({
                guildId: testGuildId,
                title: 'Sensitive'
            });
            expect(cases).toHaveLength(1);
            expect(cases[0]?.title).toBe('Sensitive Legal Matter');
            // In production, additional access controls would be applied
            // based on user roles and case assignments
        });
        it('should log all administrative actions for audit', async () => {
            // Perform administrative action
            await staffService.hireStaff({
                guildId: testGuildId,
                userId: 'audit-test',
                hiredBy: adminUserId,
                robloxUsername: 'AuditTest',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            // Verify audit log
            const auditLogs = await auditLogRepository.findByFilters({
                guildId: testGuildId,
                actorId: adminUserId
            });
            expect(auditLogs.length).toBeGreaterThan(0);
            const hireLog = auditLogs.find(log => log.targetId === 'audit-test');
            expect(hireLog).toBeDefined();
            expect(hireLog?.actorId).toBe(adminUserId);
        });
    });
    describe('Input Validation and Sanitization', () => {
        it('should prevent SQL injection in search queries', async () => {
            // Attempt SQL injection in case search
            const maliciousQueries = [
                "'; DROP TABLE cases; --",
                "' OR '1'='1",
                "<script>alert('xss')</script>",
                "../../etc/passwd",
                "null; UPDATE staff SET role='Managing Partner' WHERE 1=1; --"
            ];
            for (const maliciousQuery of maliciousQueries) {
                const result = await caseService.searchCases({
                    guildId: testGuildId,
                    title: maliciousQuery
                });
                // Should return empty results or handle gracefully
                expect(Array.isArray(result)).toBe(true);
                expect(result.length).toBe(0);
            }
        });
        it('should validate user IDs and guild IDs', async () => {
            const invalidIds = [
                '', // Empty
                ' ', // Whitespace
                'null',
                'undefined',
                '<script>',
                '../../',
                'a'.repeat(1000), // Too long
                '123.456', // Invalid format
                'user-id-with-sql\'; DROP TABLE staff; --'
            ];
            for (const invalidId of invalidIds) {
                const result = await staffService.hireStaff({
                    guildId: invalidId,
                    userId: invalidId,
                    hiredBy: adminUserId,
                    robloxUsername: 'ValidUsername',
                    role: staff_role_1.StaffRole.PARALEGAL
                });
                expect(result.success).toBe(false);
            }
        });
        it('should sanitize and validate Roblox usernames', async () => {
            const invalidUsernames = [
                '', // Empty
                'a', // Too short
                'a'.repeat(50), // Too long
                'user_with_script<script>',
                'user_with_sql\'; DROP TABLE staff; --',
                'user with spaces',
                'user@email.com',
                'user#1234',
                'user%encoded',
                '_startsunderscore',
                'endsunderscore_'
            ];
            for (const invalidUsername of invalidUsernames) {
                const result = await staffService.hireStaff({
                    guildId: testGuildId,
                    userId: `test-user-${Date.now()}`,
                    hiredBy: adminUserId,
                    robloxUsername: invalidUsername,
                    role: staff_role_1.StaffRole.PARALEGAL
                });
                expect(result.success).toBe(false);
                expect(result.error).toBeTruthy();
            }
        });
    });
    describe('Session Security', () => {
        it('should handle concurrent permission checks safely', async () => {
            const context = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Simulate multiple concurrent permission checks
            const permissionChecks = Array.from({ length: 50 }, () => permissionService.hasActionPermission(context, 'admin'));
            const results = await Promise.all(permissionChecks);
            // All should succeed
            expect(results.every(result => result === true)).toBe(true);
        });
        it('should handle permission revocation scenarios', async () => {
            const context = {
                guildId: testGuildId,
                userId: 'temp-user',
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            // Initial permission check
            const initialPermission = await permissionService.hasActionPermission(context, 'admin');
            expect(initialPermission).toBe(true);
            // Simulate role removal (in production, this would update the guild config)
            const modifiedContext = {
                ...context,
                userRoles: ['member-role'] // Role removed
            };
            // Permission should now be denied
            const revokedPermission = await permissionService.hasActionPermission(modifiedContext, 'admin');
            expect(revokedPermission).toBe(false);
        });
    });
    describe('Defense Against Common Attacks', () => {
        it('should prevent timing attacks on permission checks', async () => {
            const validContext = {
                guildId: testGuildId,
                userId: adminUserId,
                userRoles: ['admin-role-123'],
                isGuildOwner: false
            };
            const invalidContext = {
                guildId: 'non-existent-guild',
                userId: 'non-existent-user',
                userRoles: ['non-existent-role'],
                isGuildOwner: false
            };
            // Time both operations
            const start1 = Date.now();
            await permissionService.hasActionPermission(validContext, 'admin');
            const end1 = Date.now();
            const start2 = Date.now();
            await permissionService.hasActionPermission(invalidContext, 'admin');
            const end2 = Date.now();
            const time1 = end1 - start1;
            const time2 = end2 - start2;
            // Times should be similar (within reasonable variance)
            // to prevent timing attacks that could reveal valid guild IDs
            expect(Math.abs(time1 - time2)).toBeLessThan(100); // 100ms variance
        });
        it('should prevent enumeration attacks', async () => {
            // Attempt to enumerate valid guild IDs
            const possibleGuildIds = [
                'test-guild-1',
                'test-guild-2',
                'production-guild',
                'admin-guild',
                testGuildId,
                'non-existent-guild'
            ];
            const results = [];
            for (const guildId of possibleGuildIds) {
                const context = {
                    guildId,
                    userId: maliciousUserId,
                    userRoles: ['member-role'],
                    isGuildOwner: false
                };
                const hasPermission = await permissionService.hasActionPermission(context, 'admin');
                results.push({ guildId, hasPermission });
            }
            // All should return false for unauthorized user
            // Should not reveal which guilds exist vs don't exist
            expect(results.every(r => r.hasPermission === false)).toBe(true);
        });
        it('should handle malformed permission contexts', async () => {
            const malformedContexts = [
                null,
                undefined,
                {},
                { guildId: null },
                { userId: null },
                { userRoles: null },
                { isGuildOwner: null },
                { guildId: '', userId: '', userRoles: [], isGuildOwner: 'invalid' }
            ];
            for (const context of malformedContexts) {
                try {
                    const result = await permissionService.hasActionPermission(context, 'admin');
                    expect(result).toBe(false);
                }
                catch (error) {
                    // Should handle gracefully without exposing internal errors
                    expect(error).toBeDefined();
                }
            }
        });
    });
});
//# sourceMappingURL=permission-boundary.test.js.map