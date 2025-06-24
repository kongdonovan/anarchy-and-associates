import { Staff, PromotionRecord } from '../../domain/entities/staff';
import { StaffRole, RoleUtils } from '../../domain/entities/staff-role';
import { TestUtils } from '../helpers/test-utils';

describe('Staff Entity', () => {
  describe('Staff Creation and Validation', () => {
    it('should create a valid staff member with required fields', () => {
      const staff = TestUtils.generateMockStaff();
      
      expect(staff.userId).toBeTruthy();
      expect(staff.guildId).toBeTruthy();
      expect(staff.robloxUsername).toBeTruthy();
      expect(staff.role).toBe(StaffRole.PARALEGAL);
      expect(staff.status).toBe('active');
      expect(staff.hiredAt).toBeInstanceOf(Date);
      expect(staff.hiredBy).toBeTruthy();
      expect(Array.isArray(staff.promotionHistory)).toBe(true);
      expect(staff.createdAt).toBeInstanceOf(Date);
      expect(staff.updatedAt).toBeInstanceOf(Date);
    });

    it('should handle all valid staff statuses', () => {
      const validStatuses = ['active', 'inactive', 'terminated'] as const;
      
      validStatuses.forEach(status => {
        const staff = TestUtils.generateMockStaff({ status });
        expect(staff.status).toBe(status);
      });
    });

    it('should handle all valid staff roles', () => {
      const validRoles = [
        StaffRole.PARALEGAL,
        StaffRole.JUNIOR_ASSOCIATE,
        StaffRole.SENIOR_ASSOCIATE,
        StaffRole.JUNIOR_PARTNER,
        StaffRole.SENIOR_PARTNER,
        StaffRole.MANAGING_PARTNER
      ];
      
      validRoles.forEach(role => {
        const staff = TestUtils.generateMockStaff({ role });
        expect(staff.role).toBe(role);
      });
    });

    it('should track promotion history correctly', () => {
      const now = new Date();
      const promotionRecord: PromotionRecord = {
        fromRole: StaffRole.PARALEGAL,
        toRole: StaffRole.JUNIOR_ASSOCIATE,
        promotedBy: 'manager123',
        promotedAt: now,
        reason: 'Excellent performance',
        actionType: 'promotion'
      };

      const staff = TestUtils.generateMockStaff({
        role: StaffRole.JUNIOR_ASSOCIATE,
        promotionHistory: [promotionRecord]
      });

      expect(staff.promotionHistory).toHaveLength(1);
      expect(staff.promotionHistory[0]).toEqual(promotionRecord);
    });
  });

  describe('Staff Role Hierarchy', () => {
    it('should correctly identify role levels', () => {
      expect(RoleUtils.getRoleLevel(StaffRole.PARALEGAL)).toBe(1);
      expect(RoleUtils.getRoleLevel(StaffRole.JUNIOR_ASSOCIATE)).toBe(2);
      expect(RoleUtils.getRoleLevel(StaffRole.SENIOR_ASSOCIATE)).toBe(3);
      expect(RoleUtils.getRoleLevel(StaffRole.JUNIOR_PARTNER)).toBe(4);
      expect(RoleUtils.getRoleLevel(StaffRole.SENIOR_PARTNER)).toBe(5);
      expect(RoleUtils.getRoleLevel(StaffRole.MANAGING_PARTNER)).toBe(6);
    });

    it('should return correct max counts for each role', () => {
      expect(RoleUtils.getRoleMaxCount(StaffRole.PARALEGAL)).toBe(10);
      expect(RoleUtils.getRoleMaxCount(StaffRole.JUNIOR_ASSOCIATE)).toBe(10);
      expect(RoleUtils.getRoleMaxCount(StaffRole.SENIOR_ASSOCIATE)).toBe(10);
      expect(RoleUtils.getRoleMaxCount(StaffRole.JUNIOR_PARTNER)).toBe(5);
      expect(RoleUtils.getRoleMaxCount(StaffRole.SENIOR_PARTNER)).toBe(3);
      expect(RoleUtils.getRoleMaxCount(StaffRole.MANAGING_PARTNER)).toBe(1);
    });

    it('should validate role transitions correctly', () => {
      // Test getting next promotion
      expect(RoleUtils.getNextPromotion(StaffRole.PARALEGAL)).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(RoleUtils.getNextPromotion(StaffRole.JUNIOR_ASSOCIATE)).toBe(StaffRole.SENIOR_ASSOCIATE);
      expect(RoleUtils.getNextPromotion(StaffRole.SENIOR_ASSOCIATE)).toBe(StaffRole.JUNIOR_PARTNER);
      expect(RoleUtils.getNextPromotion(StaffRole.JUNIOR_PARTNER)).toBe(StaffRole.SENIOR_PARTNER);
      expect(RoleUtils.getNextPromotion(StaffRole.SENIOR_PARTNER)).toBe(StaffRole.MANAGING_PARTNER);
      expect(RoleUtils.getNextPromotion(StaffRole.MANAGING_PARTNER)).toBe(null);
      
      // Test getting previous demotion
      expect(RoleUtils.getPreviousDemotion(StaffRole.MANAGING_PARTNER)).toBe(StaffRole.SENIOR_PARTNER);
      expect(RoleUtils.getPreviousDemotion(StaffRole.SENIOR_PARTNER)).toBe(StaffRole.JUNIOR_PARTNER);
      expect(RoleUtils.getPreviousDemotion(StaffRole.JUNIOR_PARTNER)).toBe(StaffRole.SENIOR_ASSOCIATE);
      expect(RoleUtils.getPreviousDemotion(StaffRole.SENIOR_ASSOCIATE)).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(RoleUtils.getPreviousDemotion(StaffRole.JUNIOR_ASSOCIATE)).toBe(StaffRole.PARALEGAL);
      expect(RoleUtils.getPreviousDemotion(StaffRole.PARALEGAL)).toBe(null);
    });

    it('should validate promotion authority correctly', () => {
      // Senior Partner can promote to lower roles
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.JUNIOR_PARTNER)).toBe(true);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.SENIOR_ASSOCIATE)).toBe(true);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.JUNIOR_ASSOCIATE)).toBe(true);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_PARTNER, StaffRole.PARALEGAL)).toBe(true);
      
      // Managing Partner can promote to all lower roles
      expect(RoleUtils.canPromote(StaffRole.MANAGING_PARTNER, StaffRole.SENIOR_PARTNER)).toBe(true);
      expect(RoleUtils.canPromote(StaffRole.MANAGING_PARTNER, StaffRole.JUNIOR_PARTNER)).toBe(true);
      
      // Lower roles cannot promote
      expect(RoleUtils.canPromote(StaffRole.JUNIOR_ASSOCIATE, StaffRole.PARALEGAL)).toBe(false);
      expect(RoleUtils.canPromote(StaffRole.SENIOR_ASSOCIATE, StaffRole.JUNIOR_ASSOCIATE)).toBe(false);
      expect(RoleUtils.canPromote(StaffRole.JUNIOR_PARTNER, StaffRole.SENIOR_ASSOCIATE)).toBe(false);
    });
  });

  describe('Promotion History Management', () => {
    it('should track multiple promotions in chronological order', () => {
      const baseDate = new Date('2024-01-01');
      const promotions: PromotionRecord[] = [
        {
          fromRole: StaffRole.PARALEGAL,
          toRole: StaffRole.JUNIOR_ASSOCIATE,
          promotedBy: 'manager1',
          promotedAt: new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days later
          actionType: 'promotion'
        },
        {
          fromRole: StaffRole.JUNIOR_ASSOCIATE,
          toRole: StaffRole.SENIOR_ASSOCIATE,
          promotedBy: 'manager2',
          promotedAt: new Date(baseDate.getTime() + 90 * 24 * 60 * 60 * 1000), // 90 days later
          actionType: 'promotion'
        }
      ];

      const staff = TestUtils.generateMockStaff({
        role: StaffRole.SENIOR_ASSOCIATE,
        hiredAt: baseDate,
        promotionHistory: promotions
      });

      expect(staff.promotionHistory).toHaveLength(2);
      expect(staff.promotionHistory[0].toRole).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(staff.promotionHistory[1].toRole).toBe(StaffRole.SENIOR_ASSOCIATE);
      
      // Verify chronological order
      expect(staff.promotionHistory[0].promotedAt.getTime())
        .toBeLessThan(staff.promotionHistory[1].promotedAt.getTime());
    });

    it('should track demotion events', () => {
      const demotionRecord: PromotionRecord = {
        fromRole: StaffRole.SENIOR_ASSOCIATE,
        toRole: StaffRole.JUNIOR_ASSOCIATE,
        promotedBy: 'manager123',
        promotedAt: new Date(),
        reason: 'Performance issues',
        actionType: 'demotion'
      };

      const staff = TestUtils.generateMockStaff({
        role: StaffRole.JUNIOR_ASSOCIATE,
        promotionHistory: [demotionRecord]
      });

      expect(staff.promotionHistory[0].actionType).toBe('demotion');
      expect(staff.promotionHistory[0].reason).toBe('Performance issues');
      expect(RoleUtils.getRoleLevel(staff.promotionHistory[0].fromRole))
        .toBeGreaterThan(RoleUtils.getRoleLevel(staff.promotionHistory[0].toRole));
    });

    it('should track hiring and firing events', () => {
      const hireRecord: PromotionRecord = {
        fromRole: StaffRole.PARALEGAL, // Initial hire
        toRole: StaffRole.PARALEGAL,
        promotedBy: 'hr123',
        promotedAt: new Date(),
        actionType: 'hire'
      };

      const fireRecord: PromotionRecord = {
        fromRole: StaffRole.JUNIOR_ASSOCIATE,
        toRole: StaffRole.JUNIOR_ASSOCIATE, // Role doesn't change on fire
        promotedBy: 'manager123',
        promotedAt: new Date(),
        reason: 'Violation of policy',
        actionType: 'fire'
      };

      const hiredStaff = TestUtils.generateMockStaff({
        promotionHistory: [hireRecord]
      });

      const firedStaff = TestUtils.generateMockStaff({
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
      const activeStaff = TestUtils.generateMockStaff({ status: 'active' });
      expect(activeStaff.status).toBe('active');

      // Inactive staff (temporary leave)
      const inactiveStaff = TestUtils.generateMockStaff({ status: 'inactive' });
      expect(inactiveStaff.status).toBe('inactive');

      // Terminated staff
      const terminatedStaff = TestUtils.generateMockStaff({ status: 'terminated' });
      expect(terminatedStaff.status).toBe('terminated');
    });

    it('should maintain referential integrity with Discord roles', () => {
      const staffWithDiscordRole = TestUtils.generateMockStaff({
        discordRoleId: 'discord-role-123'
      });

      expect(staffWithDiscordRole.discordRoleId).toBe('discord-role-123');
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle empty promotion history', () => {
      const staff = TestUtils.generateMockStaff({
        promotionHistory: []
      });

      expect(staff.promotionHistory).toHaveLength(0);
      expect(Array.isArray(staff.promotionHistory)).toBe(true);
    });

    it('should handle staff with very long service history', () => {
      const longHistory: PromotionRecord[] = [];
      const baseDate = new Date('2020-01-01');
      
      // Create a promotion every 6 months for 4 years
      const roles = RoleUtils.getAllRolesSortedByLevel().reverse(); // Start from lowest level
      for (let i = 0; i < Math.min(8, roles.length - 1); i++) {
        longHistory.push({
          fromRole: i === 0 ? StaffRole.PARALEGAL : roles[i - 1],
          toRole: roles[Math.min(i, roles.length - 1)],
          promotedBy: `manager${i}`,
          promotedAt: new Date(baseDate.getTime() + i * 6 * 30 * 24 * 60 * 60 * 1000),
          actionType: 'promotion'
        });
      }

      const veteranStaff = TestUtils.generateMockStaff({
        role: StaffRole.SENIOR_PARTNER,
        hiredAt: baseDate,
        promotionHistory: longHistory
      });

      expect(veteranStaff.promotionHistory.length).toBeGreaterThan(5);
      expect(veteranStaff.role).toBe(StaffRole.SENIOR_PARTNER);
    });

    it('should handle staff with special characters in usernames', () => {
      const specialCharStaff = TestUtils.generateMockStaff({
        robloxUsername: 'User_With-Special.Chars123'
      });

      expect(specialCharStaff.robloxUsername).toBe('User_With-Special.Chars123');
    });

    it('should handle concurrent date updates', () => {
      const now = new Date();
      const staff = TestUtils.generateMockStaff({
        createdAt: now,
        updatedAt: now
      });

      expect(staff.createdAt.getTime()).toBe(now.getTime());
      expect(staff.updatedAt.getTime()).toBe(now.getTime());
    });

    it('should validate promotion record completeness', () => {
      const incompletePromotion = {
        fromRole: StaffRole.PARALEGAL,
        toRole: StaffRole.JUNIOR_ASSOCIATE,
        promotedBy: 'manager123',
        promotedAt: new Date(),
        actionType: 'promotion' as const
        // Missing optional reason
      };

      const staff = TestUtils.generateMockStaff({
        promotionHistory: [incompletePromotion]
      });

      expect(staff.promotionHistory[0].reason).toBeUndefined();
      expect(staff.promotionHistory[0].actionType).toBe('promotion');
    });
  });

  describe('Cross-Guild Isolation', () => {
    it('should maintain separate staff records per guild', () => {
      const guild1Staff = TestUtils.generateMockStaff({
        userId: 'user123',
        guildId: 'guild1',
        role: StaffRole.PARALEGAL
      });

      const guild2Staff = TestUtils.generateMockStaff({
        userId: 'user123', // Same user ID
        guildId: 'guild2', // Different guild
        role: StaffRole.MANAGING_PARTNER // Different role
      });

      expect(guild1Staff.userId).toBe(guild2Staff.userId);
      expect(guild1Staff.guildId).not.toBe(guild2Staff.guildId);
      expect(guild1Staff.role).not.toBe(guild2Staff.role);
    });

    it('should handle guild-specific role hierarchies', () => {
      const multiGuildStaff = [
        TestUtils.generateMockStaff({ guildId: 'guild1', role: StaffRole.JUNIOR_ASSOCIATE }),
        TestUtils.generateMockStaff({ guildId: 'guild2', role: StaffRole.SENIOR_PARTNER }),
        TestUtils.generateMockStaff({ guildId: 'guild3', role: StaffRole.PARALEGAL })
      ];

      multiGuildStaff.forEach(staff => {
        expect(staff.guildId).toBeTruthy();
        expect(Object.values(StaffRole)).toContain(staff.role);
      });

      // Verify different roles in different guilds
      const guildIds = multiGuildStaff.map(s => s.guildId);
      const roles = multiGuildStaff.map(s => s.role);
      
      expect(new Set(guildIds).size).toBe(3); // All different guilds
      expect(new Set(roles).size).toBe(3); // All different roles
    });
  });
});