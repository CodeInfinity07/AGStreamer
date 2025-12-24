# Agora Voice Bot

## Overview

Agora Voice Bot is a browser-based real-time voice chat application that enables users to join voice channels using the Agora RTC SDK. The application provides a simple interface for configuring connection parameters, managing audio controls, monitoring network quality, and viewing real-time logs of voice session activities.

**Core Purpose:** Enable users to participate in voice chat sessions directly from their browser with comprehensive audio controls and connection monitoring.

**Connection Methods:**
- **Code-based**: Enter a code to fetch credentials from external API (auto-joins after fetch)
- **Manual**: Enter App ID, Channel ID, User ID, and Token directly

**Tech Stack:**
- Frontend: React with TypeScript, Vite build system
- UI Framework: shadcn/ui components with Radix UI primitives, Tailwind CSS
- Backend: Express.js server
- Real-time Voice: Agora RTC SDK (loaded via CDN)
- Data Validation: Zod schemas
- State Management: React Query (TanStack Query)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Component Structure:**
- Single-page application (SPA) with client-side routing using Wouter
- Component hierarchy follows a feature-based organization under `client/src/components/voice-bot/`
- Main application entry point at `client/src/pages/voice-bot.tsx`
- Centralized theme management with system/light/dark mode support via React Context

**State Management Pattern:**
- Custom React hooks for complex state logic (e.g., `useAgora` hook manages all voice session state)
- TanStack Query for server state and API interactions
- Local component state for UI-specific concerns
- Ref-based management for SDK client instances and timers

**Design System:**
- Material Design 3 principles with Discord/Slack communication patterns
- Comprehensive component library from shadcn/ui (40+ UI components)
- Tailwind CSS with custom configuration for consistent spacing, colors, and typography
- Design tokens defined in CSS custom properties for light/dark themes
- Typography system using Inter font family with specific size scales for different content types

### Backend Architecture

**Server Structure:**
- Express.js HTTP server with minimal API surface
- In-memory session storage using JavaScript Map (no database persistence)
- RESTful API endpoints for health checks and session management
- Static file serving for production builds

**Authentication:**
- Token-based authentication with 24-hour session TTL
- Login credentials configured via environment variables (LOGIN_EMAIL, LOGIN_PASSWORD)
- All protected routes require Bearer token in Authorization header
- Supports both Replit Secrets and local .env file

**Session Management:**
- Sessions stored in memory with unique UUIDs
- Session data includes channel ID, user ID, join timestamp, last activity, and expiry time
- Usage limits: 3 connections per day, 5 minutes per session
- Auto-expiry: Sessions automatically terminate after 5 minutes with server-side timeout
- Daily usage tracking per authenticated user (resets at UTC midnight)

**API Endpoints:**
- `GET /api/health` - Health check with active session count
- `POST /api/auth/login` - User login (returns auth token)
- `GET /api/auth/verify` - Verify auth token
- `POST /api/sessions` - Create new voice session (enforces daily limits)
- `GET /api/sessions/limits` - Get current usage limits status
- `POST /api/vc/fetch-credentials` - Fetch channel credentials via code
- Session data validated using Zod schemas

### Voice Communication Layer

**Agora SDK Integration:**
- SDK loaded via CDN script tag in HTML (`<script src="https://cdn.jsdelivr.net/npm/agora-rtc-sdk-ng@4.24.1/..."`)
- Type definitions manually created in `client/src/lib/agora-types.ts` for TypeScript support
- Client-side only integration (no server-side Agora SDK usage)

**Real-time Features:**
- Audio track creation and management
- Microphone mute/unmute controls
- Volume adjustment (0-100%)
- Network quality monitoring (6 quality levels from Excellent to Down)
- Remote user tracking with audio level indicators
- Volume indicator polling for real-time audio level updates

**Connection States:**
- Five connection states: DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING, ERROR
- Event-based state updates from SDK callbacks
- Automatic reconnection handling

### Data Flow

**Configuration to Connection:**
1. User enters Agora credentials (App ID, Channel ID, User ID, optional token) in ConfigForm
2. Values validated using Zod schema (`voiceConfigSchema`)
3. On join, session created via POST to `/api/sessions`
4. Agora SDK client initialized and joins channel with credentials
5. Audio track created and published to channel

**Audio Control Flow:**
1. User interactions (mute, volume) trigger React state updates
2. State changes invoke SDK methods (setEnabled, setVolume)
3. SDK events update remote user states
4. UI re-renders based on state changes

**Logging System:**
- All significant events logged to in-memory array
- Log entries include timestamp, message, and type (info/warning/error/success)
- Maximum 100 log entries retained (FIFO)
- Console component displays logs with syntax highlighting

### Build System

**Development:**
- Vite dev server with HMR (Hot Module Replacement)
- TypeScript compilation without emit (type checking only)
- Custom middleware mode for Express integration
- Runtime error overlay for better DX

**Production:**
- Client built with Vite to `dist/public`
- Server bundled with esbuild to single CJS file at `dist/index.cjs`
- Allowlist-based bundling for faster cold starts (reduces syscalls)
- Static asset serving from built client

**Path Aliases:**
- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## External Dependencies

### Third-party Services

**Agora RTC SDK:**
- Purpose: Real-time voice communication infrastructure
- Integration: CDN-loaded JavaScript SDK (version 4.24.1)
- Required credentials: App ID, Channel ID, optional authentication token
- Features used: Audio-only channels, network quality detection, volume indicators

### Database and Storage

**Current State:**
- In-memory storage only (JavaScript Map)
- No database configured
- Drizzle ORM configured but not actively used
- Database schema defined in `shared/schema.ts` but only contains Zod validation schemas, not database models

**Note:** The application has Drizzle ORM and PostgreSQL configuration files present (`drizzle.config.ts`), but actual database integration is not implemented. The application uses in-memory storage for sessions.

### UI Component Libraries

**shadcn/ui Components:**
- Radix UI primitives for accessible, unstyled components
- Custom styled variants using class-variance-authority
- 40+ pre-built components (buttons, inputs, dialogs, dropdowns, etc.)

**Styling:**
- Tailwind CSS for utility-first styling
- PostCSS with autoprefixer
- Custom theme with CSS variables for easy theming

### Development Tools

**Build Tools:**
- Vite for frontend bundling and dev server
- esbuild for server bundling
- tsx for TypeScript execution in development

**Code Quality:**
- TypeScript for type safety
- Zod for runtime schema validation
- React Hook Form with Zod resolver for form validation

**Replit Integration:**
- Cartographer plugin for development
- Dev banner plugin
- Runtime error modal plugin