# Role Tracking System

The Discord bot now automatically tracks role changes and reflects them in the staff database. This system monitors for hiring, firing, promotions, and demotions based on Discord role assignments.

## How It Works

### Automatic Role Monitoring

The bot listens for `guildMemberUpdate` events and compares old vs new role assignments:

- **Hiring**: When a user gains their first staff role (any role from Managing Partner to Paralegal)
- **Firing**: When a user loses all staff roles 
- **Promotion**: When a user gains a higher-level staff role
- **Demotion**: When a user loses their current role but retains a lower-level role

### Role Hierarchy

The system recognizes these staff roles in order of seniority (highest to lowest):

1. **Managing Partner** (Level 6)
2. **Senior Partner** (Level 5) 
3. **Partner** (Level 4)
4. **Senior Associate** (Level 3)
5. **Associate** (Level 2)
6. **Paralegal** (Level 1)

### Staff Database Integration

When role changes occur, the system automatically:

- Creates or updates staff records in the database
- Adds promotion/demotion history with timestamps
- Sets appropriate status (`active`, `terminated`)
- Links Discord role IDs for synchronization
- Logs all changes to the audit trail

## Features

### Real-Time Tracking

- Monitors Discord role changes in real-time
- Instantly updates staff database when roles change
- Maintains complete promotion history for each staff member

### Audit Trail

Every role change is logged with:
- Who was affected (user ID)
- What changed (old role → new role)
- When it happened (timestamp)
- Action type (hire/fire/promotion/demotion)
- Source (role-tracking-service)

### Manual Synchronization

Administrators can manually sync roles using the `/role sync` command to:
- Add missing staff records for users with Discord roles
- Mark terminated staff who no longer have roles
- Fix any database inconsistencies

## Commands

### `/role sync`
- **Permission**: Admin only
- **Purpose**: Manually synchronize Discord roles with staff database
- **Usage**: Run when you suspect the database is out of sync

### `/role status`  
- **Permission**: Admin only
- **Purpose**: View current role tracking system status
- **Shows**: Role distribution, tracking status, system information

## Staff Role Mapping

The system maps Discord roles to internal staff roles:

```typescript
Discord Role → Staff Role
'Managing Partner' → StaffRole.MANAGING_PARTNER
'Senior Partner' → StaffRole.SENIOR_PARTNER  
'Partner' → StaffRole.SENIOR_PARTNER (mapped to Senior Partner)
'Senior Associate' → StaffRole.SENIOR_ASSOCIATE
'Associate' → StaffRole.JUNIOR_ASSOCIATE (mapped to Junior Associate)
'Paralegal' → StaffRole.PARALEGAL
```

## Example Scenarios

### Scenario 1: New Hire
```
User has no staff roles → User gets "Associate" role
Result: New staff record created with status "active"
```

### Scenario 2: Promotion
```
User has "Associate" role → User gets "Senior Associate" role
Result: Staff record updated, promotion added to history
```

### Scenario 3: Termination  
```
User has "Paralegal" role → User loses all staff roles
Result: Staff record marked as "terminated"
```

### Scenario 4: Demotion
```
User has "Partner" role → User gets "Associate" role  
Result: Staff record updated, demotion added to history
```

## Database Structure

### Staff Record Updates

When roles change, the system updates:

```typescript
{
  userId: string,
  guildId: string,
  role: StaffRole,           // Updated to new role
  status: 'active' | 'terminated',
  promotionHistory: [{
    fromRole: StaffRole,     // Previous role (or null for hire)
    toRole: StaffRole,       // New role (or null for fire)
    actionType: 'hire' | 'fire' | 'promotion' | 'demotion',
    promotedAt: Date,
    promotedBy: 'System',
    reason: 'Role change via Discord'
  }],
  discordRoleId?: string     // Discord role ID for sync
}
```

### Audit Log Entries

```typescript
{
  guildId: string,
  action: AuditAction,       // STAFF_HIRED, STAFF_FIRED, etc.
  actorId: 'System',
  targetId: string,          // User affected
  details: {
    before: { role: StaffRole },
    after: { role: StaffRole },
    reason: 'Role change via Discord: promotion',
    metadata: { source: 'role-tracking-service' }
  },
  timestamp: Date
}
```

## Technical Implementation

### Service Integration

The `RoleTrackingService` is initialized in the bot startup:

1. Service is created during bot initialization
2. Discord client event handlers are registered
3. Service monitors `guildMemberUpdate` events
4. Role changes trigger appropriate database updates

### Error Handling

- All role tracking operations include comprehensive error handling
- Failed operations are logged but don't crash the bot
- Database inconsistencies can be resolved with manual sync

### Performance Considerations

- Only processes changes to staff roles (ignores non-staff role changes)
- Uses efficient role comparison to minimize database operations
- Batches multiple role changes for the same user appropriately

## Monitoring & Maintenance

### Health Checks

Use `/role status` to monitor:
- Number of Discord users with staff roles
- Role distribution across the organization  
- System status and configuration

### Troubleshooting

If the database seems out of sync:
1. Run `/role status` to see current state
2. Use `/role sync` to fix inconsistencies
3. Check audit logs for any failed operations

### Best Practices

- Run periodic role syncs (weekly/monthly)
- Monitor audit logs for unusual activity
- Ensure proper Discord permissions for the bot
- Keep role names consistent with the mapping

## Security & Permissions

- Only administrators can run role management commands
- All changes are logged for accountability
- System requires proper Discord bot permissions:
  - `GuildMembers` intent (to track member updates)
  - `Guilds` intent (to access guild information)

This automated system ensures your staff database stays synchronized with Discord role assignments, providing accurate tracking of your organization's personnel changes.