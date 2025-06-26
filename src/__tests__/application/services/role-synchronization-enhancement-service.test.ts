import { RoleSynchronizationEnhancementService, ConflictSeverity, RoleConflict, ConflictResolutionResult } from '../../../application/services/role-synchronization-enhancement-service';
import { StaffRepository } from '../../../infrastructure/repositories/staff-repository';
import { AuditLogRepository } from '../../../infrastructure/repositories/audit-log-repository';
import { StaffRole } from '../../../domain/entities/staff-role';
import { AuditAction } from '../../../domain/entities/audit-log';
import { logger } from '../../../infrastructure/logger';

// Mock Discord.js
jest.mock('discord.js');

// Mock repositories
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');

// Mock logger
jest.mock('../../../infrastructure/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('RoleSynchronizationEnhancementService', () => {
  let service: RoleSynchronizationEnhancementService;
  let mockStaffRepo: jest.Mocked<StaffRepository>;
  let mockAuditRepo: jest.Mocked<AuditLogRepository>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mocked repositories
    mockStaffRepo = new StaffRepository() as jest.Mocked<StaffRepository>;
    mockAuditRepo = new AuditLogRepository() as jest.Mocked<AuditLogRepository>;

    // Create service
    service = new RoleSynchronizationEnhancementService();
    (service as any).staffRepository = mockStaffRepo;
    (service as any).auditLogRepository = mockAuditRepo;
  });

  describe('detectMemberConflicts', () => {
    it('should return null when member has no staff roles', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map()
        }
      };

      const result = await service.detectMemberConflicts(mockMember as any);
      expect(result).toBeNull();
    });

    it('should return null when member has only one staff role', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Senior Partner' }]
          ])
        }
      };

      const result = await service.detectMemberConflicts(mockMember as any);
      expect(result).toBeNull();
    });

    it('should detect conflict when member has multiple staff roles', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Managing Partner' }],
            ['role2', { id: 'role2', name: 'Senior Associate' }],
            ['role3', { id: 'role3', name: 'Paralegal' }]
          ])
        }
      };

      const result = await service.detectMemberConflicts(mockMember as any);
      
      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user123');
      expect(result!.conflictingRoles).toHaveLength(3);
      expect(result!.highestRole.roleName).toBe('Managing Partner');
      expect(result!.severity).toBe(ConflictSeverity.CRITICAL);
    });

    it('should calculate correct severity for different role combinations', async () => {
      // Test case 1: High severity (level difference >= 3)
      const mockMember1 = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Senior Partner' }],
            ['role2', { id: 'role2', name: 'Paralegal' }]
          ])
        }
      };

      const result1 = await service.detectMemberConflicts(mockMember1 as any);
      expect(result1!.severity).toBe(ConflictSeverity.HIGH);

      // Test case 2: Medium severity (level difference = 2)
      const mockMember2 = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Senior Associate' }],
            ['role2', { id: 'role2', name: 'Paralegal' }]
          ])
        }
      };

      const result2 = await service.detectMemberConflicts(mockMember2 as any);
      expect(result2!.severity).toBe(ConflictSeverity.MEDIUM);

      // Test case 3: Low severity (level difference = 1)
      const mockMember3 = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Associate' }],
            ['role2', { id: 'role2', name: 'Paralegal' }]
          ])
        }
      };

      const result3 = await service.detectMemberConflicts(mockMember3 as any);
      expect(result3!.severity).toBe(ConflictSeverity.LOW);
    });
  });

  describe('scanGuildForConflicts', () => {
    it('should scan all guild members and detect conflicts', async () => {
      const mockMembers = new Map([
        ['user1', {
          user: { id: 'user1', tag: 'User1#1234' },
          roles: {
            cache: new Map([
              ['role1', { id: 'role1', name: 'Senior Partner' }],
              ['role2', { id: 'role2', name: 'Associate' }]
            ])
          }
        }],
        ['user2', {
          user: { id: 'user2', tag: 'User2#5678' },
          roles: {
            cache: new Map([
              ['role3', { id: 'role3', name: 'Senior Associate' }]
            ])
          }
        }],
        ['user3', {
          user: { id: 'user3', tag: 'User3#9012' },
          roles: {
            cache: new Map() // No staff roles
          }
        }]
      ]);

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockResolvedValue(mockMembers)
        }
      };

      const progressCallback = jest.fn();
      const conflicts = await service.scanGuildForConflicts(mockGuild as any, progressCallback);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0]?.userId).toBe('user1');
      expect(progressCallback).toHaveBeenCalled();
      
      const lastProgressCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastProgressCall.total).toBe(3);
      expect(lastProgressCall.processed).toBe(3);
      expect(lastProgressCall.conflictsFound).toBe(1);
    });

    it('should handle rate limiting with delays', async () => {
      // Create 60 mock members to trigger rate limiting
      const mockMembers = new Map();
      for (let i = 0; i < 60; i++) {
        mockMembers.set(`user${i}`, {
          user: { id: `user${i}`, tag: `User${i}#0000` },
          roles: { cache: new Map() }
        });
      }

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockResolvedValue(mockMembers)
        }
      };

      // Mock delay function
      const delaySpy = jest.spyOn(service as any, 'delay').mockResolvedValue(undefined);

      await service.scanGuildForConflicts(mockGuild as any);

      // Should have called delay once (at 50 members)
      expect(delaySpy).toHaveBeenCalledTimes(1);
      expect(delaySpy).toHaveBeenCalledWith(1000);
    });
  });

  describe('resolveConflict', () => {
    it('should remove lower-precedence roles and keep highest role', async () => {
      const mockConflict: RoleConflict = {
        userId: 'user123',
        username: 'User#1234',
        guildId: 'guild123',
        conflictingRoles: [
          { roleName: 'Managing Partner', roleId: 'role1', staffRole: StaffRole.MANAGING_PARTNER, level: 6 },
          { roleName: 'Senior Associate', roleId: 'role2', staffRole: StaffRole.SENIOR_ASSOCIATE, level: 3 },
          { roleName: 'Paralegal', roleId: 'role3', staffRole: StaffRole.PARALEGAL, level: 1 }
        ],
        highestRole: { roleName: 'Managing Partner', roleId: 'role1', staffRole: StaffRole.MANAGING_PARTNER, level: 6 },
        severity: ConflictSeverity.CRITICAL,
        detectedAt: new Date()
      };

      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          remove: jest.fn().mockResolvedValue(true)
        },
        send: jest.fn().mockResolvedValue(true)
      };

      mockAuditRepo.add.mockResolvedValue({} as any);

      const result = await service.resolveConflict(mockMember as any, mockConflict, true);

      expect(result.resolved).toBe(true);
      expect(result.removedRoles).toEqual(['Senior Associate', 'Paralegal']);
      expect(result.keptRole).toBe('Managing Partner');
      expect(mockMember.roles.remove).toHaveBeenCalledTimes(2);
      expect(mockMember.roles.remove).toHaveBeenCalledWith('role2', 'Resolving role conflict - keeping highest role only');
      expect(mockMember.roles.remove).toHaveBeenCalledWith('role3', 'Resolving role conflict - keeping highest role only');
      expect(mockMember.send).toHaveBeenCalled(); // DM notification sent
      expect(mockAuditRepo.add).toHaveBeenCalled();
    });

    it('should handle role removal failures gracefully', async () => {
      const mockConflict: RoleConflict = {
        userId: 'user123',
        username: 'User#1234',
        guildId: 'guild123',
        conflictingRoles: [
          { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          { roleName: 'Associate', roleId: 'role2', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 }
        ],
        highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
        severity: ConflictSeverity.HIGH,
        detectedAt: new Date()
      };

      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          remove: jest.fn().mockRejectedValue(new Error('Insufficient permissions'))
        },
        send: jest.fn()
      };

      mockAuditRepo.add.mockResolvedValue({} as any);

      const result = await service.resolveConflict(mockMember as any, mockConflict, false);

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('Failed to remove some roles');
      expect(mockMember.send).not.toHaveBeenCalled(); // No DM since notify=false
    });

    it('should handle DM failures silently', async () => {
      const mockConflict: RoleConflict = {
        userId: 'user123',
        username: 'User#1234',
        guildId: 'guild123',
        conflictingRoles: [
          { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          { roleName: 'Associate', roleId: 'role2', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 }
        ],
        highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
        severity: ConflictSeverity.HIGH,
        detectedAt: new Date()
      };

      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          remove: jest.fn().mockResolvedValue(true)
        },
        send: jest.fn().mockRejectedValue(new Error('User has DMs disabled'))
      };

      mockAuditRepo.add.mockResolvedValue({} as any);

      const result = await service.resolveConflict(mockMember as any, mockConflict, true);

      expect(result.resolved).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Could not send DM'),
        expect.any(Error)
      );
    });
  });

  describe('bulkResolveConflicts', () => {
    it('should resolve multiple conflicts with progress reporting', async () => {
      const conflicts: RoleConflict[] = [
        {
          userId: 'user1',
          username: 'User1#1234',
          guildId: 'guild123',
          conflictingRoles: [
            { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
            { roleName: 'Paralegal', roleId: 'role2', staffRole: StaffRole.PARALEGAL, level: 1 }
          ],
          highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          severity: ConflictSeverity.HIGH,
          detectedAt: new Date()
        },
        {
          userId: 'user2',
          username: 'User2#5678',
          guildId: 'guild123',
          conflictingRoles: [
            { roleName: 'Associate', roleId: 'role3', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 },
            { roleName: 'Paralegal', roleId: 'role4', staffRole: StaffRole.PARALEGAL, level: 1 }
          ],
          highestRole: { roleName: 'Associate', roleId: 'role3', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 },
          severity: ConflictSeverity.LOW,
          detectedAt: new Date()
        }
      ];

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn()
            .mockResolvedValueOnce({
              user: { id: 'user1', tag: 'User1#1234' },
              guild: { id: 'guild123' },
              roles: {
                remove: jest.fn().mockResolvedValue(true)
              },
              send: jest.fn().mockResolvedValue(true)
            })
            .mockResolvedValueOnce({
              user: { id: 'user2', tag: 'User2#5678' },
              guild: { id: 'guild123' },
              roles: {
                remove: jest.fn().mockResolvedValue(true)
              },
              send: jest.fn().mockResolvedValue(true)
            })
        }
      };

      mockAuditRepo.add.mockResolvedValue({} as any);

      const progressCallback = jest.fn();
      const results = await service.bulkResolveConflicts(mockGuild as any, conflicts, progressCallback);

      expect(results).toHaveLength(2);
      expect(results[0]?.resolved).toBe(true);
      expect(results[1]?.resolved).toBe(true);
      
      const lastProgress = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastProgress.conflictsResolved).toBe(2);
      expect(lastProgress.errors).toBe(0);
    });

    it('should handle member fetch failures', async () => {
      const conflicts: RoleConflict[] = [
        {
          userId: 'user1',
          username: 'User1#1234',
          guildId: 'guild123',
          conflictingRoles: [
            { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
            { roleName: 'Paralegal', roleId: 'role2', staffRole: StaffRole.PARALEGAL, level: 1 }
          ],
          highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          severity: ConflictSeverity.HIGH,
          detectedAt: new Date()
        }
      ];

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockRejectedValue(new Error('Member not found'))
        }
      };

      const progressCallback = jest.fn();
      const results = await service.bulkResolveConflicts(mockGuild as any, conflicts, progressCallback);

      expect(results).toHaveLength(0);
      
      const lastProgress = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastProgress.errors).toBe(1);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('validateRoleAssignment', () => {
    it('should allow assignment when member has no staff roles', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map()
        }
      };

      const result = await service.validateRoleAssignment(mockMember as any, 'Senior Partner');
      
      expect(result.isValid).toBe(true);
      expect(result.conflicts).toBeUndefined();
      expect(result.preventionReason).toBeUndefined();
    });

    it('should prevent assignment when member already has a staff role', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Associate' }]
          ])
        }
      };

      const result = await service.validateRoleAssignment(mockMember as any, 'Senior Partner');
      
      expect(result.isValid).toBe(false);
      expect(result.conflicts).toEqual(['Associate']);
      expect(result.preventionReason).toContain('Member already has staff role(s): Associate');
    });

    it('should allow assignment of non-staff roles', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Associate' }]
          ])
        }
      };

      const result = await service.validateRoleAssignment(mockMember as any, 'Member');
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('generateConflictReport', () => {
    it('should generate comprehensive conflict report', async () => {
      const mockMembers = new Map([
        ['user1', {
          user: { id: 'user1', tag: 'User1#1234' },
          roles: {
            cache: new Map([
              ['role1', { id: 'role1', name: 'Managing Partner' }],
              ['role2', { id: 'role2', name: 'Paralegal' }]
            ])
          }
        }],
        ['user2', {
          user: { id: 'user2', tag: 'User2#5678' },
          roles: {
            cache: new Map([
              ['role3', { id: 'role3', name: 'Senior Partner' }],
              ['role4', { id: 'role4', name: 'Associate' }]
            ])
          }
        }],
        ['user3', {
          user: { id: 'user3', tag: 'User3#9012' },
          roles: {
            cache: new Map([
              ['role5', { id: 'role5', name: 'Senior Associate' }]
            ])
          }
        }]
      ]);

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockResolvedValue(mockMembers)
        }
      };

      const report = await service.generateConflictReport(mockGuild as any);

      expect(report.guildId).toBe('guild123');
      expect(report.totalMembers).toBe(3);
      expect(report.membersWithRoles).toBe(3);
      expect(report.conflictsFound).toBe(2);
      expect(report.conflictsByRole['Managing Partner']).toBe(1);
      expect(report.conflictsByRole['Paralegal']).toBe(1);
      expect(report.conflictsByRole['Senior Partner']).toBe(1);
      expect(report.conflictsByRole['Associate']).toBe(1);
      expect(report.conflictsBySeverity[ConflictSeverity.CRITICAL]).toBe(1);
      expect(report.conflictsBySeverity[ConflictSeverity.HIGH]).toBe(1);
    });
  });

  describe('incrementalSync', () => {
    it('should sync specific members when memberIds provided', async () => {
      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn()
            .mockResolvedValueOnce({
              user: { id: 'user1', tag: 'User1#1234' },
              roles: {
                cache: new Map([
                  ['role1', { id: 'role1', name: 'Senior Partner' }],
                  ['role2', { id: 'role2', name: 'Paralegal' }]
                ])
              }
            })
            .mockResolvedValueOnce({
              user: { id: 'user2', tag: 'User2#5678' },
              roles: {
                cache: new Map([
                  ['role3', { id: 'role3', name: 'Associate' }]
                ])
              }
            })
        }
      };

      const result = await service.incrementalSync(mockGuild as any, {
        memberIds: ['user1', 'user2'],
        autoResolve: false
      });

      expect(mockGuild.members.fetch).toHaveBeenCalledTimes(2);
      expect(result.conflicts).toHaveLength(1); // Only user1 has conflict
      expect(result.resolved).toHaveLength(0); // autoResolve is false
      expect(result.errors).toHaveLength(0);
    });

    it('should handle member fetch errors in incremental sync', async () => {
      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockRejectedValue(new Error('Member not found'))
        }
      };

      const result = await service.incrementalSync(mockGuild as any, {
        memberIds: ['user1'],
        autoResolve: false
      });

      expect(result.conflicts).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to fetch member user1');
    });

    it('should auto-resolve conflicts when autoResolve is true', async () => {
      const mockMember = {
        user: { id: 'user1', tag: 'User1#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Senior Partner' }],
            ['role2', { id: 'role2', name: 'Paralegal' }]
          ]),
          remove: jest.fn().mockResolvedValue(true)
        },
        send: jest.fn().mockResolvedValue(true)
      };

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockResolvedValue(mockMember)
        }
      };

      mockAuditRepo.add.mockResolvedValue({} as any);

      const result = await service.incrementalSync(mockGuild as any, {
        memberIds: ['user1'],
        autoResolve: true
      });

      expect(result.conflicts).toHaveLength(1);
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0]?.resolved).toBe(true);
      expect(mockMember.roles.remove).toHaveBeenCalled();
    });

    it('should filter by join date when sinceTimestamp provided', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      const mockMembers = new Map([
        ['user1', {
          user: { id: 'user1', tag: 'User1#1234' },
          joinedAt: now, // Joined today
          roles: {
            cache: new Map([
              ['role1', { id: 'role1', name: 'Senior Partner' }]
            ])
          }
        }],
        ['user2', {
          user: { id: 'user2', tag: 'User2#5678' },
          joinedAt: twoDaysAgo, // Joined 2 days ago
          roles: {
            cache: new Map([
              ['role2', { id: 'role2', name: 'Associate' }]
            ])
          }
        }]
      ]);

      const mockGuild = {
        id: 'guild123',
        members: {
          fetch: jest.fn().mockResolvedValue(mockMembers)
        }
      };

      const result = await service.incrementalSync(mockGuild as any, {
        sinceTimestamp: yesterday
      });

      // Only user1 should be checked (joined after yesterday)
      expect(result.conflicts).toHaveLength(0); // No conflicts expected
    });
  });

  describe('checkRoleChangeForConflicts', () => {
    it('should prevent adding staff role when member already has one', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Associate' }],
            ['role2', { id: 'role2', name: 'Senior Partner' }]
          ])
        }
      };

      const oldRoles = ['Associate'];
      const newRoles = ['Associate', 'Senior Partner'];

      const result = await service.checkRoleChangeForConflicts(mockMember as any, oldRoles, newRoles);

      expect(result.hasConflict).toBe(true);
      expect(result.shouldPrevent).toBe(true);
      expect(result.preventionReason).toContain('Cannot assign multiple staff roles');
    });

    it('should allow adding first staff role', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Senior Partner' }]
          ])
        }
      };

      const oldRoles = [];
      const newRoles = ['Senior Partner'];

      const result = await service.checkRoleChangeForConflicts(mockMember as any, oldRoles, newRoles);

      expect(result.hasConflict).toBe(false);
      expect(result.shouldPrevent).toBe(false);
    });

    it('should detect but not prevent existing conflicts', async () => {
      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          cache: new Map([
            ['role1', { id: 'role1', name: 'Senior Partner' }],
            ['role2', { id: 'role2', name: 'Associate' }]
          ])
        }
      };

      const oldRoles = ['Senior Partner', 'Associate'];
      const newRoles = ['Senior Partner', 'Associate'];

      const result = await service.checkRoleChangeForConflicts(mockMember as any, oldRoles, newRoles);

      expect(result.hasConflict).toBe(true);
      expect(result.shouldPrevent).toBe(false);
      expect(result.conflict).toBeDefined();
    });
  });

  describe('createConflictResolutionModal', () => {
    it('should create properly formatted modal for conflict resolution', () => {
      const conflict: RoleConflict = {
        userId: 'user123',
        username: 'User#1234',
        guildId: 'guild123',
        conflictingRoles: [
          { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          { roleName: 'Associate', roleId: 'role2', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 }
        ],
        highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
        severity: ConflictSeverity.HIGH,
        detectedAt: new Date()
      };

      const modal = service.createConflictResolutionModal(conflict);

      expect(modal.customId).toContain('resolve_conflict_user123');
      expect(modal.title).toBe('Resolve Role Conflict');
      expect(modal.components).toHaveLength(3);
      expect(modal.components[0]?.components[0]?.value).toBe('Senior Partner');
      expect(modal.components[0]?.components[0]?.placeholder).toContain('Senior Partner, Associate');
    });
  });

  describe('handleManualConflictResolution', () => {
    it('should handle manual resolution from modal submission', async () => {
      const conflict: RoleConflict = {
        userId: 'user123',
        username: 'User#1234',
        guildId: 'guild123',
        conflictingRoles: [
          { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          { roleName: 'Associate', roleId: 'role2', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 }
        ],
        highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
        severity: ConflictSeverity.HIGH,
        detectedAt: new Date()
      };

      const mockMember = {
        user: { id: 'user123', tag: 'User#1234' },
        guild: { id: 'guild123' },
        roles: {
          remove: jest.fn().mockResolvedValue(true)
        },
        send: jest.fn().mockResolvedValue(true)
      };

      const mockInteraction = {
        user: { id: 'admin123', tag: 'Admin#0001' },
        guild: {
          id: 'guild123',
          members: {
            fetch: jest.fn().mockResolvedValue(mockMember)
          }
        },
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce('Associate') // selected_role
            .mockReturnValueOnce('User prefers this role') // resolution_reason
            .mockReturnValueOnce('yes') // notify_user
        }
      };

      mockAuditRepo.add.mockResolvedValue({} as any);

      const result = await service.handleManualConflictResolution(mockInteraction as any, conflict);

      expect(result.resolved).toBe(true);
      expect(result.keptRole).toBe('Associate');
      expect(result.removedRoles).toContain('Senior Partner');
      expect(mockMember.send).toHaveBeenCalled();
      expect(mockAuditRepo.add).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.ROLE_SYNC_PERFORMED,
          actorId: 'admin123',
          details: expect.objectContaining({
            reason: 'Manual resolution: User prefers this role',
            metadata: expect.objectContaining({
              manualResolution: true,
              resolvedBy: 'Admin#0001'
            })
          })
        })
      );
    });

    it('should handle invalid role selection', async () => {
      const conflict: RoleConflict = {
        userId: 'user123',
        username: 'User#1234',
        guildId: 'guild123',
        conflictingRoles: [
          { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
          { roleName: 'Associate', roleId: 'role2', staffRole: StaffRole.JUNIOR_ASSOCIATE, level: 2 }
        ],
        highestRole: { roleName: 'Senior Partner', roleId: 'role1', staffRole: StaffRole.SENIOR_PARTNER, level: 5 },
        severity: ConflictSeverity.HIGH,
        detectedAt: new Date()
      };

      const mockInteraction = {
        user: { id: 'admin123', tag: 'Admin#0001' },
        guild: {
          id: 'guild123',
          members: {
            fetch: jest.fn().mockResolvedValue({})
          }
        },
        fields: {
          getTextInputValue: jest.fn()
            .mockReturnValueOnce('Managing Partner') // Invalid - not in conflict
            .mockReturnValueOnce('') // resolution_reason
            .mockReturnValueOnce('no') // notify_user
        }
      };

      const result = await service.handleManualConflictResolution(mockInteraction as any, conflict);

      expect(result.resolved).toBe(false);
      expect(result.error).toContain('Invalid role selection');
    });
  });

  describe('conflict history management', () => {
    it('should track conflict resolution history', () => {
      service.clearConflictHistory('guild123');
      
      // Add some resolutions
      (service as any).addToConflictHistory('guild123', {
        userId: 'user1',
        resolved: true,
        removedRoles: ['Paralegal'],
        keptRole: 'Senior Partner'
      });

      (service as any).addToConflictHistory('guild123', {
        userId: 'user2',
        resolved: false,
        removedRoles: [],
        keptRole: '',
        error: 'Failed'
      });

      const stats = service.getConflictStatistics('guild123');

      expect(stats.totalResolutions).toBe(2);
      expect(stats.successfulResolutions).toBe(1);
      expect(stats.failedResolutions).toBe(1);
      expect(stats.mostCommonConflicts['Paralegal']).toBe(1);
    });

    it('should limit history to 100 entries per guild', () => {
      service.clearConflictHistory('guild123');
      
      // Add 105 resolutions
      for (let i = 0; i < 105; i++) {
        (service as any).addToConflictHistory('guild123', {
          userId: `user${i}`,
          resolved: true,
          removedRoles: ['Paralegal'],
          keptRole: 'Senior Partner'
        });
      }

      const stats = service.getConflictStatistics('guild123');
      expect(stats.totalResolutions).toBe(100);
    });
  });

  describe('sync timestamp management', () => {
    it('should track last sync timestamps per guild', () => {
      const beforeUpdate = service.getLastSyncTimestamp('guild123');
      expect(beforeUpdate).toBeNull();

      service.updateLastSyncTimestamp('guild123');
      
      const afterUpdate = service.getLastSyncTimestamp('guild123');
      expect(afterUpdate).toBeInstanceOf(Date);
      expect(afterUpdate!.getTime()).toBeCloseTo(Date.now(), -2);
    });
  });
});