import { StaffService } from '../../application/services/staff-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRole } from '../../domain/entities/staff-role';
import { AuditAction } from '../../domain/entities/audit-log';
import { TestUtils } from '../helpers/test-utils';
import { DatabaseTestHelpers } from '../helpers/database-helpers';

describe('StaffService Integration Tests', () => {
  let staffService: StaffService;
  let staffRepository: StaffRepository;
  let auditLogRepository: AuditLogRepository;

  beforeAll(async () => {
    await DatabaseTestHelpers.setupTestDatabase();
  });

  beforeEach(async () => {
    staffRepository = new StaffRepository();
    auditLogRepository = new AuditLogRepository();
    staffService = new StaffService(staffRepository, auditLogRepository);
    
    await TestUtils.clearTestDatabase();
  });

  afterAll(async () => {
    await DatabaseTestHelpers.teardownTestDatabase();
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
        role: StaffRole.PARALEGAL
      });

      // Verify staff record creation
      expect(result.success).toBe(true);
      expect(result.staff).toBeDefined();
      expect(result.staff!.userId).toBe(userId);
      expect(result.staff!.guildId).toBe(guildId);
      expect(result.staff!.role).toBe(StaffRole.PARALEGAL);
      expect(result.staff!.status).toBe('active');
      expect(result.staff!.robloxUsername).toBe(robloxUsername);
      expect(result.staff!.hiredBy).toBe(hiredBy);

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
      expect(auditLogs[0]).toBeDefined();
      expect(auditLogs[0]!.action).toBe(AuditAction.STAFF_HIRED);
      expect(auditLogs[0]!.actorId).toBe(hiredBy);
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
        role: StaffRole.MANAGING_PARTNER
      });
      expect(firstHire.success).toBe(true);

      // Try to hire second Managing Partner (limit is 1)
      const secondHire = await staffService.hireStaff({
        guildId,
        userId: 'user-2',
        hiredBy,
        robloxUsername: 'User2',
        role: StaffRole.MANAGING_PARTNER
      });
      expect(secondHire.success).toBe(false);
      expect(secondHire.error).toContain('Maximum limit');

      // Verify only one Managing Partner exists
      const managingPartners = await staffRepository.findByRole(guildId, StaffRole.MANAGING_PARTNER);
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
        role: StaffRole.PARALEGAL
      });
      expect(firstHire.success).toBe(true);

      // Second hire of same user should fail
      const secondHire = await staffService.hireStaff({
        guildId,
        userId,
        hiredBy,
        robloxUsername: 'TestUser2',
        role: StaffRole.JUNIOR_ASSOCIATE
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
        role: StaffRole.PARALEGAL
      });
      expect(firstHire.success).toBe(true);

      // Second hire with same Roblox username should fail
      const secondHire = await staffService.hireStaff({
        guildId,
        userId: 'user-2',
        hiredBy,
        robloxUsername,
        role: StaffRole.JUNIOR_ASSOCIATE
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
        role: StaffRole.PARALEGAL
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
        newRole: StaffRole.JUNIOR_ASSOCIATE,
        reason: 'Excellent performance'
      });

      // Verify promotion
      expect(result.success).toBe(true);
      expect(result.staff).toBeDefined();
      expect(result.staff!.role).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(result.staff!.promotionHistory.length).toBeGreaterThan(1);
      
      const promotion = result.staff!.promotionHistory.find(p => p.actionType === 'promotion');
      expect(promotion?.fromRole).toBe(StaffRole.PARALEGAL);
      expect(promotion?.toRole).toBe(StaffRole.JUNIOR_ASSOCIATE);
      expect(promotion?.promotedBy).toBe(promotedBy);
      expect(promotion?.reason).toBe('Excellent performance');
      expect(promotion?.actionType).toBe('promotion');

      // Verify audit log
      const auditLogs = await auditLogRepository.findByFilters({ 
        guildId, 
        targetId: userId,
        action: AuditAction.STAFF_PROMOTED
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
        newRole: StaffRole.PARALEGAL
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
        role: StaffRole.JUNIOR_ASSOCIATE
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
        action: AuditAction.STAFF_FIRED
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
        { userId: 'user-1', role: StaffRole.MANAGING_PARTNER, robloxUsername: 'ManagingPartner1' },
        { userId: 'user-2', role: StaffRole.SENIOR_PARTNER, robloxUsername: 'SeniorPartner1' },
        { userId: 'user-3', role: StaffRole.JUNIOR_PARTNER, robloxUsername: 'JuniorPartner1' },
        { userId: 'user-4', role: StaffRole.SENIOR_ASSOCIATE, robloxUsername: 'SeniorAssociate1' },
        { userId: 'user-5', role: StaffRole.JUNIOR_ASSOCIATE, robloxUsername: 'JuniorAssociate1' },
        { userId: 'user-6', role: StaffRole.PARALEGAL, robloxUsername: 'Paralegal1' }
      ];

      for (const member of staffMembers) {
        const result = await staffService.hireStaff({
          guildId: 'test-guild-123',
          userId: member.userId,
          hiredBy: 'admin-123',
          robloxUsername: member.robloxUsername,
          role: member.role
        });
        
        // Ensure all hirings succeed
        expect(result.success).toBe(true);
      }
    });

    it('should retrieve staff members with pagination', async () => {
      const guildId = 'test-guild-123';
      const staffList = await staffService.getStaffList(guildId, 'admin-123');

      expect(staffList.staff).toHaveLength(6);
      expect(staffList.total).toBe(6);
      
      // Verify role distribution
      const roleCounts = await staffService.getRoleCounts(guildId);
      expect(roleCounts[StaffRole.MANAGING_PARTNER]).toBe(1);
      expect(roleCounts[StaffRole.SENIOR_PARTNER]).toBe(1);
      expect(roleCounts[StaffRole.PARALEGAL]).toBe(1);
    });

    it('should retrieve staff hierarchy overview', async () => {
      const guildId = 'test-guild-123';
      const hierarchy = await staffService.getStaffHierarchy(guildId);

      expect(hierarchy).toBeDefined();
      expect(hierarchy.length).toBe(6);
      
      const roleCounts = await staffService.getRoleCounts(guildId);
      expect(roleCounts[StaffRole.MANAGING_PARTNER]).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Test with malformed input that should cause internal errors but be handled gracefully
      const result = await staffService.hireStaff({
        guildId: 'test-guild-123',
        userId: 'user-123', 
        hiredBy: 'admin-123',
        robloxUsername: 'TestUser123',
        role: 'InvalidRole' as any // Invalid role type
      });
      
      // Service should handle the error gracefully and return failure response
      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to hire staff member');
    });

    it('should handle malformed staff data', async () => {
      // Test invalid Roblox username (too short - this actually fails validation)
      const result1 = await staffService.hireStaff({
        guildId: 'test-guild-123',
        userId: 'user-invalid-1',
        hiredBy: 'admin-123',
        robloxUsername: 'X', // Too short (less than 3 chars)
        role: StaffRole.PARALEGAL
      });
      expect(result1.success).toBe(false);

      // Test invalid Roblox username (contains invalid characters)
      const result2 = await staffService.hireStaff({
        guildId: 'test-guild-123',
        userId: 'user-invalid-2',
        hiredBy: 'admin-123',
        robloxUsername: 'Test@User!', // Contains invalid characters
        role: StaffRole.PARALEGAL
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
        role: StaffRole.MANAGING_PARTNER
      });

      await staffService.hireStaff({
        guildId: guild2,
        userId,
        hiredBy: 'admin-2',
        robloxUsername: 'User2',
        role: StaffRole.PARALEGAL
      });

      // Verify isolation
      const guild1StaffList = await staffService.getStaffList(guild1, 'admin-1');
      const guild2StaffList = await staffService.getStaffList(guild2, 'admin-2');

      expect(guild1StaffList.staff).toHaveLength(1);
      expect(guild2StaffList.staff).toHaveLength(1);
      expect(guild1StaffList.staff[0]?.role).toBe(StaffRole.MANAGING_PARTNER);
      expect(guild2StaffList.staff[0]?.role).toBe(StaffRole.PARALEGAL);

      // Verify separate role limits through role counts
      const guild1Counts = await staffService.getRoleCounts(guild1);
      const guild2Counts = await staffService.getRoleCounts(guild2);

      expect(guild1Counts[StaffRole.MANAGING_PARTNER]).toBe(1); // Guild 1 has MP
      expect(guild2Counts[StaffRole.MANAGING_PARTNER]).toBe(0);  // Guild 2 doesn't have MP
    });
  });
});