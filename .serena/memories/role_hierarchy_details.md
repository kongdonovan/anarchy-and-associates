# Staff Role Hierarchy and Permissions

## Role Hierarchy (Level 1-6)
1. **Paralegal** (Level 1) - Entry level, no case handling permissions
2. **Junior Associate** (Level 2) - Basic lawyer, can be assigned to cases
3. **Senior Associate** (Level 3) - Can be assigned to cases and be lead attorney
4. **Junior Partner** (Level 4) - Same as Senior Associate with higher status
5. **Senior Partner** (Level 5) - Senior leadership, notified of critical issues
6. **Managing Partner** (Level 6) - Top leadership, admin permissions

## Case Handling Permissions
- **Lawyer Permissions** (can be assigned to cases): Junior Associate and above
- **Lead Attorney Permissions** (can lead cases): Senior Associate and above
- **Case Channel Access**: Managing Partner, Senior Partner, Junior Partner by default

## Discord Role Mapping
- 'Managing Partner' → StaffRole.MANAGING_PARTNER
- 'Senior Partner' → StaffRole.SENIOR_PARTNER
- 'Partner' → StaffRole.SENIOR_PARTNER (mapped)
- 'Senior Associate' → StaffRole.SENIOR_ASSOCIATE
- 'Associate' → StaffRole.JUNIOR_ASSOCIATE (mapped)
- 'Paralegal' → StaffRole.PARALEGAL

## Key Business Rules
- When staff lose lawyer permissions, they must be unassigned from all cases
- When staff lose lead attorney permissions, their lead status must be removed
- Cases with no lawyers should notify Senior Partners and Managing Partner
- All role changes trigger automatic database updates and audit logs