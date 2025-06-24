import { BaseEntity } from './base';
import { StaffRole } from './staff-role';

export interface Staff extends BaseEntity {
  userId: string;
  guildId: string;
  robloxUsername: string;
  role: StaffRole;
  hiredAt: Date;
  hiredBy: string;
  promotionHistory: PromotionRecord[];
  status: 'active' | 'inactive' | 'terminated';
  discordRoleId?: string; // For role synchronization
}

export interface PromotionRecord {
  fromRole: StaffRole;
  toRole: StaffRole;
  promotedBy: string;
  promotedAt: Date;
  reason?: string;
  actionType: 'promotion' | 'demotion' | 'hire' | 'fire';
}