"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const role_synchronization_enhancement_service_1 = require("../../../application/services/role-synchronization-enhancement-service");
const staff_role_1 = require("../../../domain/entities/staff-role");
const audit_log_1 = require("../../../domain/entities/audit-log");
// Mock dependencies
jest.mock('../../../infrastructure/repositories/staff-repository');
jest.mock('../../../infrastructure/repositories/audit-log-repository');
jest.mock('../../../infrastructure/logger');
describe('RoleSynchronizationEnhancementService', () => {
    let service;
    let mockAuditLogRepository;
    // Discord.js mocks
    let mockGuild;
    let mockMember;
    let mockUser;
    let mockRolesCache;
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        // Create service instance
        service = new role_synchronization_enhancement_service_1.RoleSynchronizationEnhancementService();
        // Get mocked repositories
        mockAuditLogRepository = service.auditLogRepository;
        // Setup Discord.js mocks
        mockUser = {
            id: 'test-user-123',
            tag: 'TestUser#1234',
            send: jest.fn().mockResolvedValue(undefined),
        };
        mockRolesCache = new Map();
        mockMember = {
            user: mockUser,
            guild: {}, // Will be set in tests
            roles: {
                cache: mockRolesCache,
                remove: jest.fn().mockResolvedValue(undefined),
            },
            send: jest.fn().mockResolvedValue(undefined),
        };
        mockGuild = {
            id: 'test-guild-123',
            members: {
                fetch: jest.fn(),
                cache: new Map(),
            },
            roles: {
                cache: new Map(),
            },
        };
        // Set guild reference in member
        mockMember.guild = mockGuild;
    });
    describe('detectMemberConflicts', () => {
        it('should return null when member has no staff roles', async () => {
            // No roles in cache
            const result = await service.detectMemberConflicts(mockMember);
            expect(result).toBeNull();
        });
        it('should return null when member has only one staff role', async () => {
            // Add single staff role
            mockRolesCache.set('role-1', {
                id: 'role-1',
                name: 'Senior Partner',
                position: 5,
            });
            const result = await service.detectMemberConflicts(mockMember);
            expect(result).toBeNull();
        });
        it('should detect conflict when member has multiple staff roles', async () => {
            // Add multiple staff roles
            mockRolesCache.set('role-1', {
                id: 'role-1',
                name: 'Managing Partner',
                position: 6,
            });
            mockRolesCache.set('role-2', {
                id: 'role-2',
                name: 'Paralegal',
                position: 1,
            });
            const result = await service.detectMemberConflicts(mockMember);
            expect(result).not.toBeNull();
            expect(result?.conflictingRoles).toHaveLength(2);
            expect(result?.highestRole.roleName).toBe('Managing Partner');
            expect(result?.severity).toBe(role_synchronization_enhancement_service_1.ConflictSeverity.HIGH); // Large level difference (5 levels)
        });
        it('should calculate correct severity for different role combinations', async () => {
            // Test HIGH severity (level difference >= 3)
            mockRolesCache.clear();
            mockRolesCache.set('role-1', {
                id: 'role-1',
                name: 'Senior Partner',
                position: 5,
            });
            mockRolesCache.set('role-2', {
                id: 'role-2',
                name: 'Paralegal',
                position: 1,
            });
            const result = await service.detectMemberConflicts(mockMember);
            expect(result?.severity).toBe(role_synchronization_enhancement_service_1.ConflictSeverity.HIGH);
        });
        it('should handle partner role mapping correctly', async () => {
            // Test that 'Partner' maps to Senior Partner
            mockRolesCache.set('role-1', {
                id: 'role-1',
                name: 'Partner',
                position: 5,
            });
            mockRolesCache.set('role-2', {
                id: 'role-2',
                name: 'Associate',
                position: 2,
            });
            const result = await service.detectMemberConflicts(mockMember);
            expect(result).not.toBeNull();
            expect(result?.highestRole.staffRole).toBe(staff_role_1.StaffRole.SENIOR_PARTNER);
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
            const membersMap = new Map();
            membersMap.set('user-1', member1);
            membersMap.set('user-2', member2);
            membersMap.set('user-3', member3);
            mockGuild.members.fetch.mockResolvedValue(membersMap);
            const conflicts = await service.scanGuildForConflicts(mockGuild);
            expect(conflicts).toHaveLength(2); // member1 and member3 have conflicts
            expect(conflicts[0].userId).toBe('user-1');
            expect(conflicts[1].userId).toBe('user-3');
        });
        it('should call progress callback during scan', async () => {
            // Create 50 members for testing progress
            const membersMap = new Map();
            for (let i = 0; i < 50; i++) {
                const hasConflict = i % 10 === 0; // Every 10th member has conflict
                const roles = hasConflict
                    ? [{ id: `role-${i}-1`, name: 'Senior Partner' }, { id: `role-${i}-2`, name: 'Paralegal' }]
                    : [{ id: `role-${i}`, name: 'Associate' }];
                const member = createMockMember(`user-${i}`, `User${i}#0000`, roles);
                membersMap.set(`user-${i}`, member);
            }
            mockGuild.members.fetch.mockResolvedValue(membersMap);
            const progressCallback = jest.fn();
            await service.scanGuildForConflicts(mockGuild, progressCallback);
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
        let mockConflict;
        beforeEach(() => {
            mockConflict = {
                userId: 'test-user-123',
                username: 'TestUser#1234',
                guildId: 'test-guild-123',
                conflictingRoles: [
                    {
                        roleName: 'Managing Partner',
                        roleId: 'role-1',
                        staffRole: staff_role_1.StaffRole.MANAGING_PARTNER,
                        level: 6
                    },
                    {
                        roleName: 'Paralegal',
                        roleId: 'role-2',
                        staffRole: staff_role_1.StaffRole.PARALEGAL,
                        level: 1
                    }
                ],
                highestRole: {
                    roleName: 'Managing Partner',
                    roleId: 'role-1',
                    staffRole: staff_role_1.StaffRole.MANAGING_PARTNER,
                    level: 6
                },
                severity: role_synchronization_enhancement_service_1.ConflictSeverity.CRITICAL,
                detectedAt: new Date()
            };
            // Setup roles on member
            mockRolesCache.set('role-1', {
                id: 'role-1',
                name: 'Managing Partner',
            });
            mockRolesCache.set('role-2', {
                id: 'role-2',
                name: 'Paralegal',
            });
        });
        it('should remove lower precedence roles and keep highest', async () => {
            const result = await service.resolveConflict(mockMember, mockConflict, false);
            expect(result.resolved).toBe(true);
            expect(result.removedRoles).toEqual(['Paralegal']);
            expect(result.keptRole).toBe('Managing Partner');
            expect(mockMember.roles.remove).toHaveBeenCalledWith('role-2', 'Resolving role conflict - keeping highest role only');
            expect(mockMember.roles.remove).not.toHaveBeenCalledWith('role-1', expect.any(String));
        });
        it('should create audit log entry for resolution', async () => {
            await service.resolveConflict(mockMember, mockConflict, false);
            expect(mockAuditLogRepository.add).toHaveBeenCalledWith(expect.objectContaining({
                guildId: 'test-guild-123',
                action: audit_log_1.AuditAction.ROLE_SYNC_PERFORMED,
                actorId: 'System-RoleSync',
                targetId: 'test-user-123',
                details: expect.objectContaining({
                    before: { roles: ['Managing Partner', 'Paralegal'] },
                    after: { role: 'Managing Partner' },
                    reason: 'Automatic role conflict resolution',
                    metadata: expect.objectContaining({
                        conflictSeverity: role_synchronization_enhancement_service_1.ConflictSeverity.CRITICAL,
                        removedRoles: ['Paralegal'],
                        resolved: true
                    })
                })
            }));
        });
        it('should send DM notification when requested', async () => {
            await service.resolveConflict(mockMember, mockConflict, true);
            expect(mockMember.send).toHaveBeenCalledWith(expect.objectContaining({
                embeds: expect.arrayContaining([expect.any(Object)])
            }));
        });
        it('should handle role removal failures gracefully', async () => {
            mockMember.roles.remove.mockRejectedValueOnce(new Error('Permission denied'));
            const result = await service.resolveConflict(mockMember, mockConflict, false);
            expect(result.resolved).toBe(false);
            expect(result.error).toContain('Failed to remove some roles');
        });
    });
    describe('validateRoleAssignment', () => {
        it('should allow assignment when role is not a staff role', async () => {
            const result = await service.validateRoleAssignment(mockMember, 'Member');
            expect(result.isValid).toBe(true);
            expect(result.conflicts).toBeUndefined();
        });
        it('should allow assignment when member has no existing staff roles', async () => {
            const result = await service.validateRoleAssignment(mockMember, 'Senior Partner');
            expect(result.isValid).toBe(true);
        });
        it('should prevent assignment when member already has staff role', async () => {
            mockRolesCache.set('role-1', {
                id: 'role-1',
                name: 'Associate',
            });
            const result = await service.validateRoleAssignment(mockMember, 'Senior Partner');
            expect(result.isValid).toBe(false);
            expect(result.conflicts).toEqual(['Associate']);
            expect(result.preventionReason).toContain('already has staff role');
        });
    });
    describe('generateConflictReport', () => {
        it('should generate comprehensive conflict report', async () => {
            // Setup test data
            const membersMap = new Map();
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
            mockGuild.members.fetch.mockResolvedValue(membersMap);
            const report = await service.generateConflictReport(mockGuild);
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
            expect(report.conflictsBySeverity[role_synchronization_enhancement_service_1.ConflictSeverity.HIGH]).toBe(2); // user-1 and user-3 both have large level differences
        });
    });
    describe('bulkResolveConflicts', () => {
        it('should resolve multiple conflicts with progress tracking', async () => {
            const conflicts = [
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
            mockGuild.members.fetch
                .mockResolvedValueOnce(member1)
                .mockResolvedValueOnce(member2);
            const progressCallback = jest.fn();
            const results = await service.bulkResolveConflicts(mockGuild, conflicts, progressCallback);
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
            const conflicts = [
                createMockConflict('user-1', 'User1#0001', ['Managing Partner', 'Paralegal'])
            ];
            mockGuild.members.fetch.mockRejectedValue(new Error('Member not found'));
            const results = await service.bulkResolveConflicts(mockGuild, conflicts);
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
function createMockMember(userId, tag, roles) {
    const rolesCache = new Map();
    roles.forEach(r => {
        rolesCache.set(r.id, {
            id: r.id,
            name: r.name,
            position: getPositionForRole(r.name),
        });
    });
    return {
        user: {
            id: userId,
            tag,
            send: jest.fn().mockResolvedValue(undefined),
        },
        guild: {
            id: 'test-guild-123',
        },
        roles: {
            cache: rolesCache,
            remove: jest.fn().mockResolvedValue(undefined),
        },
        send: jest.fn().mockResolvedValue(undefined),
    };
}
function createMockConflict(userId, username, roleNames) {
    const staffRoleMapping = {
        'Managing Partner': staff_role_1.StaffRole.MANAGING_PARTNER,
        'Senior Partner': staff_role_1.StaffRole.SENIOR_PARTNER,
        'Partner': staff_role_1.StaffRole.SENIOR_PARTNER,
        'Senior Associate': staff_role_1.StaffRole.SENIOR_ASSOCIATE,
        'Associate': staff_role_1.StaffRole.JUNIOR_ASSOCIATE,
        'Paralegal': staff_role_1.StaffRole.PARALEGAL,
    };
    const conflictingRoles = roleNames.map((name, index) => ({
        roleName: name,
        roleId: `role-${index}`,
        staffRole: staffRoleMapping[name] || staff_role_1.StaffRole.PARALEGAL,
        level: getPositionForRole(name)
    }));
    const sortedRoles = [...conflictingRoles].sort((a, b) => b.level - a.level);
    return {
        userId,
        username,
        guildId: 'test-guild-123',
        conflictingRoles,
        highestRole: sortedRoles[0],
        severity: role_synchronization_enhancement_service_1.ConflictSeverity.HIGH,
        detectedAt: new Date()
    };
}
function getPositionForRole(roleName) {
    const positions = {
        'Managing Partner': 6,
        'Senior Partner': 5,
        'Partner': 5,
        'Senior Associate': 3,
        'Associate': 2,
        'Paralegal': 1,
    };
    return positions[roleName] || 0;
}
//# sourceMappingURL=role-synchronization-enhancement-service.test.js.map