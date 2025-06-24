import { StaffService } from '../../application/services/staff-service';
import { StaffRepository } from '../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../infrastructure/repositories/audit-log-repository';
import { StaffRole } from '../../domain/entities/staff-role';

// Mock the repositories
jest.mock('../../infrastructure/repositories/staff-repository');
jest.mock('../../infrastructure/repositories/audit-log-repository');

describe('StaffService', () => {
  let staffService: StaffService;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;

  beforeEach(() => {
    mockStaffRepository = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockAuditLogRepository = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;
    staffService = new StaffService(mockStaffRepository, mockAuditLogRepository);
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
      role: StaffRole.PARALEGAL,
      hiredBy: 'admin123',
      reason: 'Test hire',
    };

    beforeEach(() => {
      mockStaffRepository.findByUserId.mockResolvedValue(null);
      mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue(null);
      mockStaffRepository.canHireRole.mockResolvedValue(true);
      mockAuditLogRepository.logAction.mockResolvedValue({} as any);
    });

    it('should successfully hire a new staff member', async () => {
      const mockStaff = {
        _id: {} as any,
        ...hireRequest,
        hiredAt: new Date(),
        promotionHistory: [],
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockStaffRepository.add.mockResolvedValue(mockStaff);

      const result = await staffService.hireStaff(hireRequest);

      expect(result.success).toBe(true);
      expect(result.staff).toBeDefined();
      expect(mockStaffRepository.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: hireRequest.userId,
          role: hireRequest.role,
          robloxUsername: hireRequest.robloxUsername,
          status: 'active',
        })
      );
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
      } as any);

      const result = await staffService.hireStaff(hireRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already an active staff member');
      expect(mockStaffRepository.add).not.toHaveBeenCalled();
    });

    it('should reject if Roblox username is already used', async () => {
      mockStaffRepository.findStaffByRobloxUsername.mockResolvedValue({} as any);

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
      newRole: StaffRole.JUNIOR_ASSOCIATE,
      promotedBy: 'admin123',
      reason: 'Good performance',
    };

    const mockStaff = {
      _id: {} as any,
      userId: 'user123',
      guildId: 'guild123',
      role: StaffRole.PARALEGAL,
      status: 'active' as const,
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
      mockAuditLogRepository.logAction.mockResolvedValue({} as any);
    });

    it('should successfully promote a staff member', async () => {
      const updatedStaff = { ...mockStaff, role: promotionRequest.newRole };
      mockStaffRepository.updateStaffRole.mockResolvedValue(updatedStaff);

      const result = await staffService.promoteStaff(promotionRequest);

      expect(result.success).toBe(true);
      expect(result.staff?.role).toBe(promotionRequest.newRole);
      expect(mockStaffRepository.updateStaffRole).toHaveBeenCalledWith(
        promotionRequest.guildId,
        promotionRequest.userId,
        promotionRequest.newRole,
        promotionRequest.promotedBy,
        promotionRequest.reason
      );
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
      const invalidRequest = { ...promotionRequest, newRole: StaffRole.PARALEGAL };

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