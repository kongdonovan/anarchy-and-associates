"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const staff_role_1 = require("../../domain/entities/staff-role");
const test_utils_1 = require("../helpers/test-utils");
describe('Staff Entity', () => {
    describe('Staff Creation and Validation', () => {
        it('should create a valid staff member with required fields', () => {
            const staff = test_utils_1.TestUtils.generateMockStaff();
            expect(staff.userId).toBeTruthy();
            expect(staff.guildId).toBeTruthy();
            expect(staff.robloxUsername).toBeTruthy();
            expect(staff.role).toBe(staff_role_1.StaffRole.PARALEGAL);
            expect(staff.status).toBe('active');
            expect(staff.hiredAt).toBeInstanceOf(Date);
            expect(staff.hiredBy).toBeTruthy();
            expect(Array.isArray(staff.promotionHistory)).toBe(true);
            expect(staff.createdAt).toBeInstanceOf(Date);
            expect(staff.updatedAt).toBeInstanceOf(Date);
        });
        it('should handle all valid staff statuses', () => {
            const validStatuses = ['active', 'inactive', 'terminated'];
            validStatuses.forEach(status => {
                const staff = test_utils_1.TestUtils.generateMockStaff({ status });
                expect(staff.status).toBe(status);
            });
        });
        it('should handle all valid staff roles', () => {
            const validRoles = [
                staff_role_1.StaffRole.PARALEGAL,
                staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                staff_role_1.StaffRole.JUNIOR_PARTNER,
                staff_role_1.StaffRole.SENIOR_PARTNER,
                staff_role_1.StaffRole.MANAGING_PARTNER
            ];
            validRoles.forEach(role => {
                const staff = test_utils_1.TestUtils.generateMockStaff({ role });
                expect(staff.role).toBe(role);
            });
        });
        it('should track promotion history correctly', () => {
            const now = new Date();
            const promotionRecord = {
                fromRole: staff_role_1.StaffRole.PARALEGAL,
                toRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                promotedBy: 'manager123',
                promotedAt: now,
                reason: 'Excellent performance',
                actionType: 'promotion'
            };
            const staff = test_utils_1.TestUtils.generateMockStaff({
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                promotionHistory: [promotionRecord]
            });
            expect(staff.promotionHistory).toHaveLength(1);
            expect(staff.promotionHistory[0]).toEqual(promotionRecord);
        });
    });
    describe('Staff Role Hierarchy', () => {
        it('should correctly identify role levels', () => {
            expect((0, staff_role_1.getStaffRoleLevel)(staff_role_1.StaffRole.PARALEGAL)).toBe(1);
            expect((0, staff_role_1.getStaffRoleLevel)(staff_role_1.StaffRole.JUNIOR_ASSOCIATE)).toBe(2);
            expect((0, staff_role_1.getStaffRoleLevel)(staff_role_1.StaffRole.SENIOR_ASSOCIATE)).toBe(3);
            expect((0, staff_role_1.getStaffRoleLevel)(staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(4);
            expect((0, staff_role_1.getStaffRoleLevel)(staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(5);
            expect((0, staff_role_1.getStaffRoleLevel)(staff_role_1.StaffRole.MANAGING_PARTNER)).toBe(6);
        });
        it('should return correct max counts for each role', () => {
            expect((0, staff_role_1.getRoleMaxCount)(staff_role_1.StaffRole.PARALEGAL)).toBe(10);
            expect((0, staff_role_1.getRoleMaxCount)(staff_role_1.StaffRole.JUNIOR_ASSOCIATE)).toBe(10);
            expect((0, staff_role_1.getRoleMaxCount)(staff_role_1.StaffRole.SENIOR_ASSOCIATE)).toBe(10);
            expect((0, staff_role_1.getRoleMaxCount)(staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(5);
            expect((0, staff_role_1.getRoleMaxCount)(staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(3);
            expect((0, staff_role_1.getRoleMaxCount)(staff_role_1.StaffRole.MANAGING_PARTNER)).toBe(1);
        });
        it('should validate promotion eligibility correctly', () => {
            // Valid promotions (one level up)
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.JUNIOR_ASSOCIATE)).toBe(true);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.JUNIOR_ASSOCIATE, staff_role_1.StaffRole.SENIOR_ASSOCIATE)).toBe(true);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.SENIOR_ASSOCIATE, staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(true);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.JUNIOR_PARTNER, staff_role_1.StaffRole.SENIOR_PARTNER)).toBe(true);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.MANAGING_PARTNER)).toBe(true);
            // Invalid promotions (same level or downgrade)
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.PARALEGAL)).toBe(false);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.JUNIOR_ASSOCIATE, staff_role_1.StaffRole.PARALEGAL)).toBe(false);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.SENIOR_PARTNER, staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(false);
            // Invalid promotions (skipping levels)
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.SENIOR_ASSOCIATE)).toBe(false);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.JUNIOR_ASSOCIATE, staff_role_1.StaffRole.JUNIOR_PARTNER)).toBe(false);
            expect((0, staff_role_1.canPromoteToRole)(staff_role_1.StaffRole.PARALEGAL, staff_role_1.StaffRole.MANAGING_PARTNER)).toBe(false);
        });
        it('should handle promotion eligibility with context', () => {
            const currentStaff = test_utils_1.TestUtils.generateMockStaff({
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                hiredAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // 90 days ago
            });
            const eligibility = (0, staff_role_1.getPromotionEligibility)(currentStaff, staff_role_1.StaffRole.SENIOR_ASSOCIATE);
            expect(eligibility.eligible).toBe(true);
            expect(eligibility.reason).toContain('meets requirements');
        });
    });
    describe('Promotion History Management', () => {
        it('should track multiple promotions in chronological order', () => {
            const baseDate = new Date('2024-01-01');
            const promotions = [
                {
                    fromRole: staff_role_1.StaffRole.PARALEGAL,
                    toRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    promotedBy: 'manager1',
                    promotedAt: new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
                    actionType: 'promotion'
                },
                {
                    fromRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                    toRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                    promotedBy: 'manager2',
                    promotedAt: new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days later
                    actionType: 'promotion'
                }
            ];
            const staff = test_utils_1.TestUtils.generateMockStaff({
                role: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                hiredAt: baseDate,
                promotionHistory: promotions
            });
            expect(staff.promotionHistory).toHaveLength(2);
            expect(staff.promotionHistory[0].toRole).toBe(staff_role_1.StaffRole.JUNIOR_ASSOCIATE);
            expect(staff.promotionHistory[1].toRole).toBe(staff_role_1.StaffRole.SENIOR_ASSOCIATE);
            // Verify chronological order
            expect(staff.promotionHistory[0].promotedAt.getTime())
                .toBeLessThan(staff.promotionHistory[1].promotedAt.getTime());
        });
        it('should track demotion events', () => {
            const demotionRecord = {
                fromRole: staff_role_1.StaffRole.SENIOR_ASSOCIATE,
                toRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                promotedBy: 'manager123',
                promotedAt: new Date(),
                reason: 'Performance issues',
                actionType: 'demotion'
            };
            const staff = test_utils_1.TestUtils.generateMockStaff({
                role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                promotionHistory: [demotionRecord]
            });
            expect(staff.promotionHistory[0].actionType).toBe('demotion');
            expect(staff.promotionHistory[0].reason).toBe('Performance issues');
            expect((0, staff_role_1.getStaffRoleLevel)(staff.promotionHistory[0].fromRole))
                .toBeGreaterThan((0, staff_role_1.getStaffRoleLevel)(staff.promotionHistory[0].toRole));
        });
        it('should track hiring and firing events', () => {
            const hireRecord = {
                fromRole: staff_role_1.StaffRole.PARALEGAL, // Initial hire
                toRole: staff_role_1.StaffRole.PARALEGAL,
                promotedBy: 'hr123',
                promotedAt: new Date(),
                actionType: 'hire'
            };
            const fireRecord = {
                fromRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                toRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE, // Role doesn't change on fire
                promotedBy: 'manager123',
                promotedAt: new Date(),
                reason: 'Violation of policy',
                actionType: 'fire'
            };
            const hiredStaff = test_utils_1.TestUtils.generateMockStaff({
                promotionHistory: [hireRecord]
            });
            const firedStaff = test_utils_1.TestUtils.generateMockStaff({
                status: 'terminated',
                promotionHistory: [hireRecord, fireRecord]
            });
            expect(hiredStaff.promotionHistory[0].actionType).toBe('hire');
            expect(firedStaff.promotionHistory[1].actionType).toBe('fire');
            expect(firedStaff.status).toBe('terminated');
        });
    });
    describe('Staff Status Management', () => {
        it('should handle status transitions correctly', () => {
            // Active staff
            const activeStaff = test_utils_1.TestUtils.generateMockStaff({ status: 'active' });
            expect(activeStaff.status).toBe('active');
            // Inactive staff (temporary leave)
            const inactiveStaff = test_utils_1.TestUtils.generateMockStaff({ status: 'inactive' });
            expect(inactiveStaff.status).toBe('inactive');
            // Terminated staff
            const terminatedStaff = test_utils_1.TestUtils.generateMockStaff({ status: 'terminated' });
            expect(terminatedStaff.status).toBe('terminated');
        });
        it('should maintain referential integrity with Discord roles', () => {
            const staffWithDiscordRole = test_utils_1.TestUtils.generateMockStaff({
                discordRoleId: 'discord-role-123'
            });
            expect(staffWithDiscordRole.discordRoleId).toBe('discord-role-123');
        });
    });
    describe('Edge Cases and Validation', () => {
        it('should handle empty promotion history', () => {
            const staff = test_utils_1.TestUtils.generateMockStaff({
                promotionHistory: []
            });
            expect(staff.promotionHistory).toHaveLength(0);
            expect(Array.isArray(staff.promotionHistory)).toBe(true);
        });
        it('should handle staff with very long service history', () => {
            const longHistory = [];
            const baseDate = new Date('2020-01-01');
            // Create a promotion every 6 months for 4 years
            for (let i = 0; i < 8; i++) {
                longHistory.push({
                    fromRole: i === 0 ? staff_role_1.StaffRole.PARALEGAL : (longHistory[i - 1].toRole),
                    toRole: i < 5 ? Object.values(staff_role_1.StaffRole)[Math.min(i + 1, 5)] : staff_role_1.StaffRole.SENIOR_PARTNER,
                    promotedBy: `manager${i}`,
                    promotedAt: new Date(baseDate.getTime() + i * 6 * 30 * 24 * 60 * 60 * 1000),
                    actionType: 'promotion'
                });
            }
            const veteranStaff = test_utils_1.TestUtils.generateMockStaff({
                role: staff_role_1.StaffRole.SENIOR_PARTNER,
                hiredAt: baseDate,
                promotionHistory: longHistory
            });
            expect(veteranStaff.promotionHistory.length).toBeGreaterThan(5);
            expect(veteranStaff.role).toBe(staff_role_1.StaffRole.SENIOR_PARTNER);
        });
        it('should handle staff with special characters in usernames', () => {
            const specialCharStaff = test_utils_1.TestUtils.generateMockStaff({
                robloxUsername: 'User_With-Special.Chars123'
            });
            expect(specialCharStaff.robloxUsername).toBe('User_With-Special.Chars123');
        });
        it('should handle concurrent date updates', () => {
            const now = new Date();
            const staff = test_utils_1.TestUtils.generateMockStaff({
                createdAt: now,
                updatedAt: now
            });
            expect(staff.createdAt.getTime()).toBe(now.getTime());
            expect(staff.updatedAt.getTime()).toBe(now.getTime());
        });
        it('should validate promotion record completeness', () => {
            const incompletePromotion = {
                fromRole: staff_role_1.StaffRole.PARALEGAL,
                toRole: staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
                promotedBy: 'manager123',
                promotedAt: new Date(),
                actionType: 'promotion'
                // Missing optional reason
            };
            const staff = test_utils_1.TestUtils.generateMockStaff({
                promotionHistory: [incompletePromotion]
            });
            expect(staff.promotionHistory[0].reason).toBeUndefined();
            expect(staff.promotionHistory[0].actionType).toBe('promotion');
        });
    });
    describe('Cross-Guild Isolation', () => {
        it('should maintain separate staff records per guild', () => {
            const guild1Staff = test_utils_1.TestUtils.generateMockStaff({
                userId: 'user123',
                guildId: 'guild1',
                role: staff_role_1.StaffRole.PARALEGAL
            });
            const guild2Staff = test_utils_1.TestUtils.generateMockStaff({
                userId: 'user123', // Same user ID
                guildId: 'guild2', // Different guild
                role: staff_role_1.StaffRole.MANAGING_PARTNER // Different role
            });
            expect(guild1Staff.userId).toBe(guild2Staff.userId);
            expect(guild1Staff.guildId).not.toBe(guild2Staff.guildId);
            expect(guild1Staff.role).not.toBe(guild2Staff.role);
        });
        it('should handle guild-specific role hierarchies', () => {
            const multiGuildStaff = [
                test_utils_1.TestUtils.generateMockStaff({ guildId: 'guild1', role: staff_role_1.StaffRole.JUNIOR_ASSOCIATE }),
                test_utils_1.TestUtils.generateMockStaff({ guildId: 'guild2', role: staff_role_1.StaffRole.SENIOR_PARTNER }),
                test_utils_1.TestUtils.generateMockStaff({ guildId: 'guild3', role: staff_role_1.StaffRole.PARALEGAL })
            ];
            multiGuildStaff.forEach(staff => {
                expect(staff.guildId).toBeTruthy();
                expect(Object.values(staff_role_1.StaffRole)).toContain(staff.role);
            });
            // Verify different roles in different guilds
            const guildIds = multiGuildStaff.map(s => s.guildId);
            const roles = multiGuildStaff.map(s => s.role);
            expect(new Set(guildIds).size).toBe(3); // All different guilds
            expect(new Set(roles).size).toBe(3); // All different roles
        });
    });
});
//# sourceMappingURL=staff.test.js.map