import { RoleSynchronizationEnhancementService, ConflictSeverity, RoleConflict } from '../../../application/services/role-synchronization-enhancement-service';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../../infrastructure/repositories/audit-log-repository';
import { StaffRole } from '../../../domain/entities/staff-role';
import { AuditAction } from '../../../domain/entities/audit-log';
import { GuildMember, Guild, Role, User } from 'discord.js';

// Mock dependencies
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../infrastructure/logger');

describe('RoleSynchronizationEnhancementService', () => {
  let service: RoleSynchronizationEnhancementService;
  let mockStaffRepository: jest.Mocked<StaffRepository>;
  let mockAuditLogRepository: jest.Mocked<AuditLogRepository>;
  
  // Discord.js mocks
  let mockGuild: Partial<Guild>;
  let mockMember: Partial<GuildMember>;
  let mockUser: Partial<User>;
  let mockRolesCache: Map<string, Role>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create service instance
    service = new RoleSynchronizationEnhancementService();
    
    // Get mocked repositories
    mockStaffRepository = (service as any).staffRepository;
    mockAuditLogRepository = (service as any).auditLogRepository;

    // Setup Discord.js mocks
    mockUser = {
      id: 'test-user-123',
      tag: 'TestUser#1234',
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockRolesCache = new Map<string, Role>();
    
    mockMember = {
      user: mockUser as User,
      guild: {} as Guild, // Will be set in tests
      roles: {
        cache: mockRolesCache,
        remove: jest.fn().mockResolvedValue(undefined),
      } as any,
      send: jest.fn().mockResolvedValue(undefined),
    };

    mockGuild = {
      id: 'test-guild-123',
      members: {
        fetch: jest.fn(),
        cache: new Map<string, GuildMember>(),
      } as any,
      roles: {
        cache: new Map<string, Role>(),
      } as any,
    };

    // Set guild reference in member
    mockMember.guild = mockGuild as Guild;
  });

  describe('detectMemberConflicts', () => {
    it('should return null when member has no staff roles', async () => {
      // No roles in cache
      const result = await service.detectMemberConflicts(mockMember as GuildMember);
      
      expect(result).toBeNull();
    });

    it('should return null when member has only one staff role', async () => {
      // Add single staff role
      mockRolesCache.set('role-1', {
        id: 'role-1',
        name: 'Senior Partner',
        position: 5,
      } as Role);

      const result = await service.detectMemberConflicts(mockMember as GuildMember);
      
      expect(result).toBeNull();
    });

    it('should detect conflict when member has multiple staff roles', async () => {
      // Add multiple staff roles
      mockRolesCache.set('role-1', {
        id: 'role-1',
        name: 'Managing Partner',
        position: 6,
      } as Role);
      
      mockRolesCache.set('role-2', {
        id: 'role-2',
        name: 'Paralegal',
        position: 1,
      } as Role);

      const result = await service.detectMemberConflicts(mockMember as GuildMember);
      
      expect(result).not.toBeNull();
      expect(result?.conflictingRoles).toHaveLength(2);
      expect(result?.highestRole.roleName).toBe('Managing Partner');
      expect(result?.severity).toBe(ConflictSeverity.HIGH); // Large level difference (5 levels)
    });

    it('should calculate correct severity for different role combinations', async () => {
      // Test HIGH severity (level difference >= 3)
      mockRolesCache.clear();
      mockRolesCache.set('role-1', {
        id: 'role-1',
        name: 'Senior Partner',
        position: 5,
      } as Role);
      
      mockRolesCache.set('role-2', {
        id: 'role-2',
        name: 'Paralegal',
        position: 1,
      } as Role);

      const result = await service.detectMemberConflicts(mockMember as GuildMember);
      
      expect(result?.severity).toBe(ConflictSeverity.HIGH);
    });

    it('should handle partner role mapping correctly', async () => {
      // Test that 'Partner' maps to Senior Partner
      mockRolesCache.set('role-1', {
        id: 'role-1',
        name: 'Partner',
        position: 5,
      } as Role);
      
      mockRolesCache.set('role-2', {
        id: 'role-2',
        name: 'Associate',
        position: 2,
      } as Role);

      const result = await service.detectMemberConflicts(mockMember as GuildMember);
      
      expect(result).not.toBeNull();
      expect(result?.highestRole.staffRole).toBe(StaffRole.SENIOR_PARTNER);
    });
  });

  describe('scanGuildForConflicts', () => {
    it('should scan all guild members for conflicts', async () => {
      // Setup guild members
      const member1 = createMockMember('user-1', 'User1#0001', [
        { id: 'role-1', name: 'Managing Partner' },
        { id: 'role-2', name: 'Paralegal' }
      ]);
      
      const member2 = createMockMember('user-2', 'User2#0002', [
        { id: 'role-3', name: 'Senior Associate' }
      ]);
      
      const member3 = createMockMember('user-3', 'User3#0003', [
        { id: 'role-4', name: 'Senior Partner' },
        { id: 'role-5', name: 'Associate' }
      ]);

      const membersMap = new Map<string, GuildMember>();
      membersMap.set('user-1', member1);
      membersMap.set('user-2', member2);
      membersMap.set('user-3', member3);

      (mockGuild.members!.fetch as jest.Mock).mockResolvedValue(membersMap);

      const conflicts = await service.scanGuildForConflicts(mockGuild as Guild);
      
      expect(conflicts).toHaveLength(2); // member1 and member3 have conflicts
      expect(conflicts[0].userId).toBe('user-1');
      expect(conflicts[1].userId).toBe('user-3');
    });

    it('should call progress callback during scan', async () => {
      // Create 50 members for testing progress
      const membersMap = new Map<string, GuildMember>();
      for (let i = 0; i < 50; i++) {
        const hasConflict = i % 10 === 0; // Every 10th member has conflict
        const roles = hasConflict 
          ? [{ id: `role-${i}-1`, name: 'Senior Partner' }, { id: `role-${i}-2`, name: 'Paralegal' }]
          : [{ id: `role-${i}`, name: 'Associate' }];
        
        const member = createMockMember(`user-${i}`, `User${i}#0000`, roles);
        membersMap.set(`user-${i}`, member);
      }

      (mockGuild.members!.fetch as jest.Mock).mockResolvedValue(membersMap);

      const progressCallback = jest.fn();
      
      await service.scanGuildForConflicts(mockGuild as Guild, progressCallback);
      
      // Should be called 6 times (initial + every 10 members)
      expect(progressCallback).toHaveBeenCalledTimes(6);
      
      // Check last progress call
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall.total).toBe(50);
      expect(lastCall.processed).toBe(50);
      expect(lastCall.conflictsFound).toBe(5);
    });
  });

  describe('resolveConflict', () => {
    let mockConflict: RoleConflict;

    beforeEach(() => {
      mockConflict = {
        userId: 'test-user-123',
        username: 'TestUser#1234',
        guildId: 'test-guild-123',
        conflictingRoles: [
          {
            roleName: 'Managing Partner',
            roleId: 'role-1',
            staffRole: StaffRole.MANAGING_PARTNER,
            level: 6
          },
          {
            roleName: 'Paralegal',
            roleId: 'role-2',
            staffRole: StaffRole.PARALEGAL,
            level: 1
          }
        ],
        highestRole: {
          roleName: 'Managing Partner',
          roleId: 'role-1',
          staffRole: StaffRole.MANAGING_PARTNER,
          level: 6
        },
        severity: ConflictSeverity.CRITICAL,
        detectedAt: new Date()
      };

      // Setup roles on member
      mockRolesCache.set('role-1', {
        id: 'role-1',
        name: 'Managing Partner',
      } as Role);
      
      mockRolesCache.set('role-2', {
        id: 'role-2',
        name: 'Paralegal',
      } as Role);
    });

    it('should remove lower precedence roles and keep highest', async () => {
      const result = await service.resolveConflict(mockMember as GuildMember, mockConflict, false);
      
      expect(result.resolved).toBe(true);
      expect(result.removedRoles).toEqual(['Paralegal']);
      expect(result.keptRole).toBe('Managing Partner');
      expect(mockMember.roles!.remove).toHaveBeenCalledWith('role-2', 'Resolving role conflict - keeping highest role only');
      expect(mockMember.roles!.remove).not.toHaveBeenCalledWith('role-1', expect.any(String));
    });

    it('should create audit log entry for resolution', async () => {
      await service.resolveConflict(mockMember as GuildMember, mockConflict, false);
      
      expect(mockAuditLogRepository.add).toHaveBeenCalledWith(expect.objectContaining({
        guildId: 'test-guild-123',
        action: AuditAction.ROLE_SYNC_PERFORMED,
        actorId: 'System-RoleSync',
        targetId: 'test-user-123',
        details: expect.objectContaining({
          before: { roles: ['Managing Partner', 'Paralegal'] },
          after: { role: 'Managing Partner' },
          reason: 'Automatic role conflict resolution',
          metadata: expect.objectContaining({
            conflictSeverity: ConflictSeverity.CRITICAL,
            removedRoles: ['Paralegal'],
            resolved: true
          })
        })
      }));
    });

    it('should send DM notification when requested', async () => {
      await service.resolveConflict(mockMember as GuildMember, mockConflict, true);
      
      expect(mockMember.send).toHaveBeenCalledWith(expect.objectContaining({
        embeds: expect.arrayContaining([expect.any(Object)])
      }));
    });

    it('should handle role removal failures gracefully', async () => {
      (mockMember.roles!.remove as jest.Mock).mockRejectedValueOnce(new Error('Permission denied'));
      
      const result = await service.resolveConflict(mockMember as GuildMember, mockConflict, false);
      
      expect(result.resolved).toBe(false);
      expect(result.error).toContain('Failed to remove some roles');
    });
  });

  describe('validateRoleAssignment', () => {
    it('should allow assignment when role is not a staff role', async () => {
      const result = await service.validateRoleAssignment(mockMember as GuildMember, 'Member');
      
      expect(result.isValid).toBe(true);
      expect(result.conflicts).toBeUndefined();
    });

    it('should allow assignment when member has no existing staff roles', async () => {
      const result = await service.validateRoleAssignment(mockMember as GuildMember, 'Senior Partner');
      
      expect(result.isValid).toBe(true);
    });

    it('should prevent assignment when member already has staff role', async () => {
      mockRolesCache.set('role-1', {
        id: 'role-1',
        name: 'Associate',
      } as Role);

      const result = await service.validateRoleAssignment(mockMember as GuildMember, 'Senior Partner');
      
      expect(result.isValid).toBe(false);
      expect(result.conflicts).toEqual(['Associate']);
      expect(result.preventionReason).toContain('already has staff role');
    });
  });

  describe('generateConflictReport', () => {
    it('should generate comprehensive conflict report', async () => {
      // Setup test data
      const membersMap = new Map<string, GuildMember>();
      
      // Add members with various role configurations
      membersMap.set('user-1', createMockMember('user-1', 'User1#0001', [
        { id: 'role-1', name: 'Managing Partner' },
        { id: 'role-2', name: 'Paralegal' }
      ]));
      
      membersMap.set('user-2', createMockMember('user-2', 'User2#0002', [
        { id: 'role-3', name: 'Senior Associate' }
      ]));
      
      membersMap.set('user-3', createMockMember('user-3', 'User3#0003', [
        { id: 'role-4', name: 'Senior Partner' },
        { id: 'role-5', name: 'Associate' }
      ]));

      (mockGuild.members!.fetch as jest.Mock).mockResolvedValue(membersMap);

      const report = await service.generateConflictReport(mockGuild as Guild);
      
      expect(report.guildId).toBe('test-guild-123');
      expect(report.totalMembers).toBe(3);
      expect(report.membersWithRoles).toBe(3);
      expect(report.conflictsFound).toBe(2);
      
      // Check conflict breakdown
      expect(report.conflictsByRole['Managing Partner']).toBe(1);
      expect(report.conflictsByRole['Paralegal']).toBe(1);
      expect(report.conflictsByRole['Senior Partner']).toBe(1);
      expect(report.conflictsByRole['Associate']).toBe(1);
      
      // Check severity breakdown
      expect(report.conflictsBySeverity[ConflictSeverity.HIGH]).toBe(2); // user-1 and user-3 both have large level differences
    });
  });

  describe('bulkResolveConflicts', () => {
    it('should resolve multiple conflicts with progress tracking', async () => {
      const conflicts: RoleConflict[] = [
        createMockConflict('user-1', 'User1#0001', ['Managing Partner', 'Paralegal']),
        createMockConflict('user-2', 'User2#0002', ['Senior Partner', 'Associate'])
      ];

      // Setup guild members
      const member1 = createMockMember('user-1', 'User1#0001', [
        { id: 'role-1', name: 'Managing Partner' },
        { id: 'role-2', name: 'Paralegal' }
      ]);
      
      const member2 = createMockMember('user-2', 'User2#0002', [
        { id: 'role-3', name: 'Senior Partner' },
        { id: 'role-4', name: 'Associate' }
      ]);

      (mockGuild.members!.fetch as jest.Mock)
        .mockResolvedValueOnce(member1)
        .mockResolvedValueOnce(member2);

      const progressCallback = jest.fn();
      
      const results = await service.bulkResolveConflicts(
        mockGuild as Guild,
        conflicts,
        progressCallback
      );
      
      expect(results).toHaveLength(2);
      expect(results[0].resolved).toBe(true);
      expect(results[1].resolved).toBe(true);
      
      // Check progress was tracked
      expect(progressCallback).toHaveBeenCalled();
      const lastProgress = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastProgress.processed).toBe(2);
      expect(lastProgress.conflictsResolved).toBe(2);
    });

    it('should handle member fetch failures gracefully', async () => {
      const conflicts: RoleConflict[] = [
        createMockConflict('user-1', 'User1#0001', ['Managing Partner', 'Paralegal'])
      ];

      (mockGuild.members!.fetch as jest.Mock).mockRejectedValue(new Error('Member not found'));

      const results = await service.bulkResolveConflicts(
        mockGuild as Guild,
        conflicts
      );
      
      expect(results).toHaveLength(0); // No results since member fetch failed
    });
  });

  describe('getConflictStatistics', () => {
    it('should return conflict resolution statistics', async () => {
      // Simulate some resolutions
      const member1 = createMockMember('user-1', 'User1#0001', [
        { id: 'role-1', name: 'Managing Partner' },
        { id: 'role-2', name: 'Paralegal' }
      ]);

      const conflict = createMockConflict('user-1', 'User1#0001', ['Managing Partner', 'Paralegal']);
      
      // Resolve a conflict to populate history
      await service.resolveConflict(member1, conflict, false);
      
      const stats = service.getConflictStatistics('test-guild-123');
      
      expect(stats.totalResolutions).toBe(1);
      expect(stats.successfulResolutions).toBe(1);
      expect(stats.failedResolutions).toBe(0);
      expect(stats.mostCommonConflicts['Paralegal']).toBe(1);
    });

    it('should return empty statistics for guild with no history', () => {
      const stats = service.getConflictStatistics('unknown-guild');
      
      expect(stats.totalResolutions).toBe(0);
      expect(stats.successfulResolutions).toBe(0);
      expect(stats.failedResolutions).toBe(0);
      expect(stats.mostCommonConflicts).toEqual({});
    });
  });

  describe('clearConflictHistory', () => {
    it('should clear conflict history for a guild', async () => {
      // Add some history
      const member1 = createMockMember('user-1', 'User1#0001', [
        { id: 'role-1', name: 'Managing Partner' },
        { id: 'role-2', name: 'Paralegal' }
      ]);

      const conflict = createMockConflict('user-1', 'User1#0001', ['Managing Partner', 'Paralegal']);
      await service.resolveConflict(member1, conflict, false);
      
      // Verify history exists
      let stats = service.getConflictStatistics('test-guild-123');
      expect(stats.totalResolutions).toBe(1);
      
      // Clear history
      service.clearConflictHistory('test-guild-123');
      
      // Verify history is cleared
      stats = service.getConflictStatistics('test-guild-123');
      expect(stats.totalResolutions).toBe(0);
    });
  });
});

// Helper functions
function createMockMember(userId: string, tag: string, roles: Array<{ id: string; name: string }>): GuildMember {
  const rolesCache = new Map<string, Role>();
  roles.forEach(r => {
    rolesCache.set(r.id, {
      id: r.id,
      name: r.name,
      position: getPositionForRole(r.name),
    } as Role);
  });

  return {
    user: {
      id: userId,
      tag,
      send: jest.fn().mockResolvedValue(undefined),
    } as any,
    guild: {
      id: 'test-guild-123',
    } as any,
    roles: {
      cache: rolesCache,
      remove: jest.fn().mockResolvedValue(undefined),
    } as any,
    send: jest.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockConflict(userId: string, username: string, roleNames: string[]): RoleConflict {
  const staffRoleMapping: Record<string, StaffRole> = {
    'Managing Partner': StaffRole.MANAGING_PARTNER,
    'Senior Partner': StaffRole.SENIOR_PARTNER,
    'Partner': StaffRole.SENIOR_PARTNER,
    'Senior Associate': StaffRole.SENIOR_ASSOCIATE,
    'Associate': StaffRole.JUNIOR_ASSOCIATE,
    'Paralegal': StaffRole.PARALEGAL,
  };

  const conflictingRoles = roleNames.map((name, index) => ({
    roleName: name,
    roleId: `role-${index}`,
    staffRole: staffRoleMapping[name] || StaffRole.PARALEGAL,
    level: getPositionForRole(name)
  }));

  const sortedRoles = [...conflictingRoles].sort((a, b) => b.level - a.level);

  return {
    userId,
    username,
    guildId: 'test-guild-123',
    conflictingRoles,
    highestRole: sortedRoles[0],
    severity: ConflictSeverity.HIGH,
    detectedAt: new Date()
  };
}

function getPositionForRole(roleName: string): number {
  const positions: Record<string, number> = {
    'Managing Partner': 6,
    'Senior Partner': 5,
    'Partner': 5,
    'Senior Associate': 3,
    'Associate': 2,
    'Paralegal': 1,
  };
  return positions[roleName] || 0;
}