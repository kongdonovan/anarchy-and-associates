# Server Configuration System

The Anarchy & Associates Discord bot now supports a comprehensive configuration system that allows you to customize server setup through JSON configuration files.

## Overview

The configuration system allows you to define:
- **Custom Roles** with permissions, colors, and hierarchy
- **Channel Categories** with specific permissions
- **Text/Voice/Forum Channels** with detailed permission settings
- **Jobs** tied to roles with custom application questions

## Key Features

### 🏗️ **Role Hierarchy**
- Roles are ordered by definition position (first = highest rank)
- Automatic hierarchy level assignment based on order
- Configurable position limits per role

### 📋 **Configuration Management**
- Export/import configuration templates
- Validation before server setup
- JSON-based configuration files

### 🎯 **Automatic Job Creation**
- Jobs automatically created during server setup
- Custom application questions per job
- Tied to role hierarchy and limits

## Available Commands

### `/config` Commands

- `/config summary` - View current configuration template
- `/config export-template` - Download the default configuration template
- `/config validate-template` - Validate a custom configuration file
- `/config view` - View current server settings
- `/config set` - Set individual channel/category configurations

### `/admin` Commands

- `/admin setupserver` - **COMPLETE SERVER WIPE** + setup with configuration

## Configuration File Structure

```json
{
  "roles": [
    {
      "name": "Managing Partner",
      "color": "#E74C3C",
      "permissions": ["ViewChannel", "SendMessages", "ManageMessages"],
      "hoist": true,
      "mentionable": true,
      "maxCount": 1,
      "description": "Highest ranking partner"
    }
  ],
  "categories": [
    {
      "name": "Administrative",
      "id": "admin",
      "permissions": [
        {
          "target": "@everyone",
          "allow": [],
          "deny": ["ViewChannel"]
        },
        {
          "target": "role:Managing Partner",
          "allow": ["ViewChannel", "SendMessages"],
          "deny": []
        }
      ]
    }
  ],
  "channels": [
    {
      "name": "announcements",
      "type": "announcement",
      "category": "admin",
      "permissions": [...],
      "topic": "Important firm announcements"
    }
  ],
  "jobs": [
    {
      "title": "Managing Partner Position",
      "description": "Lead the legal firm...",
      "roleName": "Managing Partner",
      "isOpenByDefault": false,
      "autoCreateOnSetup": true,
      "customQuestions": [...]
    }
  ]
}
```

## Role Configuration

### Role Properties
- `name`: Role display name
- `color`: Hex color code (e.g., "#FF0000")
- `permissions`: Array of Discord permission names
- `hoist`: Show separately in member list
- `mentionable`: Can be mentioned
- `maxCount`: Optional position limit
- `description`: Documentation purpose

### Role Hierarchy
Roles are automatically assigned hierarchy levels based on their order in the configuration:
1. First role = Highest level (e.g., Level 8)
2. Second role = Second highest (e.g., Level 7)
3. And so on...

## Permission System

### Permission Targets
- `@everyone` - Everyone role
- `role:RoleName` - Specific role by name
- `user:userId` - Specific user by Discord ID

### Permission Arrays
- `allow`: Array of permissions to grant
- `deny`: Array of permissions to deny

## Channel Types

- `text` - Standard text channel
- `voice` - Voice channel
- `forum` - Forum channel (threaded discussions)
- `announcement` - Announcement channel

## Job Configuration

### Job Properties
- `title`: Job posting title
- `description`: Job description
- `roleName`: Must match a role name from the roles array
- `isOpenByDefault`: Whether job starts open
- `autoCreateOnSetup`: Create automatically during setup
- `customQuestions`: Additional questions beyond defaults

### Custom Questions
```json
{
  "id": "unique_question_id",
  "question": "What is your experience?",
  "type": "paragraph",
  "required": true,
  "maxLength": 1000
}
```

Question types: `short`, `paragraph`, `number`, `choice`

## Usage Workflow

### 1. Export Template
```
/config export-template
```
Downloads the default configuration template.

### 2. Customize Configuration
Edit the JSON file to customize:
- Add/remove/reorder roles
- Modify channel structure
- Configure permissions
- Set up custom jobs

### 3. Validate Configuration
```
/config validate-template config_file:[your-file.json]
```
Validates your configuration before using it.

### 4. Apply Configuration
```
/admin setupserver
```
**⚠️ WARNING**: This **COMPLETELY WIPES** the server and rebuilds it with your configuration.

## Default Configuration

The default configuration includes:
- **8 Roles**: Managing Partner → Legal Intern → Client
- **4 Categories**: Administrative, Case Management, Client Services, General
- **11 Channels**: Various text/voice/forum channels with appropriate permissions
- **5 Jobs**: Configured for different role levels with custom questions

## Best Practices

1. **Test First**: Always validate your configuration before applying
2. **Backup Important**: Export current config before major changes
3. **Role Order Matters**: First role = highest rank
4. **Permission Testing**: Verify permission overrides work as expected
5. **Job Limits**: Set appropriate `maxCount` for roles to prevent overstaffing

## Example Customizations

### Add New Department Role
```json
{
  "name": "IT Specialist",
  "color": "#00FF00",
  "permissions": ["ViewChannel", "SendMessages"],
  "hoist": true,
  "mentionable": true,
  "maxCount": 3
}
```

### Create Department-Specific Channel
```json
{
  "name": "it-support",
  "type": "text",
  "category": "general",
  "permissions": [
    {
      "target": "@everyone",
      "allow": [],
      "deny": ["ViewChannel"]
    },
    {
      "target": "role:IT Specialist",
      "allow": ["ViewChannel", "SendMessages"],
      "deny": []
    }
  ]
}
```

### Add Custom Job with Specific Questions
```json
{
  "title": "IT Specialist Position",
  "description": "Technical support for the legal firm",
  "roleName": "IT Specialist",
  "isOpenByDefault": true,
  "autoCreateOnSetup": true,
  "customQuestions": [
    {
      "id": "tech_experience",
      "question": "What programming languages do you know?",
      "type": "paragraph",
      "required": true,
      "maxLength": 500
    }
  ]
}
```

This configuration system provides complete flexibility while maintaining the professional legal firm structure.