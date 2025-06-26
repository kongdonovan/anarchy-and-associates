# Anarchy & Associates Bot - Project Overview

## Purpose
Enterprise-grade Discord bot for Anarchy & Associates legal firm built with TypeScript, following Domain-Driven Design (DDD) and Clean Architecture principles. The bot manages comprehensive legal firm operations including staff management, case tracking, job applications, retainer agreements, and client feedback.

## Tech Stack
- **TypeScript** with strict mode and decorators
- **Discord.js v14** with **discordx** decorators for slash commands
- **MongoDB** with custom repository pattern
- **Winston** for structured logging
- **Jest** for testing (95%+ coverage)
- **Node.js >= 16.0.0**

## Architecture
- **Domain Layer** (`src/domain/`): Business entities and core domain logic
- **Application Layer** (`src/application/`): Business services implementing use cases
- **Infrastructure Layer** (`src/infrastructure/`): Repositories, MongoDB integration, external services
- **Presentation Layer** (`src/presentation/`): Discord command files with slash commands

## Key Features
- Staff management with 6-level role hierarchy
- Case management with automatic Discord channel creation
- Job posting and application system
- Retainer agreements with digital signatures
- Client feedback and performance metrics
- Automated role tracking and synchronization
- Permission-based access control
- Multi-server support with guild isolation