# Queue Management System (QMS) - AI Coding Agent Instructions

## Architecture Overview

Multi-tenant queue management system with **Express.js + Prisma backend** and **Next.js 15 frontend**. Real-time updates via Socket.IO. Three-tier hierarchy: `Organization → Location → Service → Queue → QueueEntry`.

### Key Design Patterns

**Multi-tenancy**: All entities cascade from `Organization`. Use `organizationId` filtering for data isolation.

**Event-driven updates**: Backend emits Socket.IO events to room-based channels (`queue:${id}`, `user:${id}`, `service:${id}`, `location:${id}`). Frontend hooks subscribe using `useSocket()`. See `backend/src/lib/socket.ts` for event constants.

**Two distinct user flows**:
- **Operators/Staff** register via `/auth/register` with invite codes, log in at `/login`, manage queues via authenticated APIs. Dashboard shows role-based navigation.
- **Patients/Customers** join queues anonymously via `/join/[publicCode]` pages — **no login required**. They receive a ticket number and can track status.

### Core Domain Model

```
Organization (tenant root)
└── Location (physical branch, has optional publicCode for patient access)
    └── Service (defines queue type: INDIVIDUAL/GENERAL)
        ├── Queue (daily instance with slots)
        │   ├── Slot (time windows)
        │   └── QueueEntry (person in line, has ticketNumber)
        ├── ServiceFlow (defines auto-transitions between services)
        └── Practitioner (staff assignment)
```

**Queue lifecycle**: Created daily per service. Slots auto-generated from `Service.{startTime, endTime, slotDuration}`. Entries track status: `WAITING → SERVING → SERVED` (see `EntryStatus` enum).

**User roles** (`backend/prisma/schema.prisma`): `SUPER_ADMIN`, `ORG_ADMIN`, `LOCATION_ADMIN`, `SERVICE_STAFF`, `RECEPTIONIST`, `PATIENT`. Auth middleware uses `authenticate()` + `authorize(...roles)`.

## Development Workflow

> **IMPORTANT**: This project runs in Docker containers. All `npm`, `npx`, and `prisma` commands should be executed **inside the containers**, not on the host machine. Running commands locally may use different package versions and cause errors.

**Setup & Run**:
```bash
# Full Docker dev environment (hot-reload enabled) - THIS IS THE PRIMARY WORKFLOW
docker-compose up -d --build

# Containers expose:
#   - Frontend: http://localhost:8003 (Next.js)
#   - Backend: http://localhost:8004 (Express API)
#   - Mailpit: http://localhost:8025 (Email testing UI)
#   - Redis: localhost:6380
```

**Executing Commands Inside Containers**:
```bash
# Backend container commands (prisma, npm, etc.)
docker-compose exec backend npm run prisma:generate
docker-compose exec backend npm run prisma:migrate
docker-compose exec backend npx prisma migrate dev --name <migration_name>
docker-compose exec backend npx prisma studio
docker-compose exec backend npm install <package>

# Frontend container commands
docker-compose exec frontend npm install <package>
docker-compose exec frontend npm run build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Database migrations**: Run inside the backend container:
```bash
docker-compose exec backend npx prisma migrate dev --name <description>
```

**Do NOT run locally** (will fail due to version mismatches):
```bash
# ❌ WRONG - runs with host's package versions
cd backend && npx prisma migrate dev

# ✅ CORRECT - runs inside container with correct versions
docker-compose exec backend npx prisma migrate dev
```

## API Structure

**Authenticated endpoints** (require JWT token):
- `/api/v1/orgs`, `/api/v1/locations`, `/api/v1/services`, `/api/v1/queues` - CRUD operations
- `/api/v1/invites` - Create/list operator invite codes (admin only)

**Public endpoints** (no auth required):
- `GET /api/v1/public/locations` - List locations with public join codes
- `GET /api/v1/public/locations/:code` - Get location details by public code
- `POST /api/v1/public/join` - Join queue anonymously `{ serviceId, name, phone?, notes? }`
- `GET /api/v1/public/status/:queueId/:entryId` - Get real-time queue position and status

## Frontend Page Structure

| Route | Access | Purpose |
|-------|--------|---------|
| `/login` | Public | Operator/staff login |
| `/register` | Public | Operator registration (requires invite code) |
| `/` | Authenticated | Dashboard with role-based quick actions |
| `/queues` | Staff+ | Queue management, call next, serve customers |
| `/services` | Admin | Configure services and schedules |
| `/admin/locations` | Admin | Manage locations, assign public codes |
| `/admin/invites` | Admin | Create invite codes for operators |
| `/analytics` | Admin | Usage metrics and reports |
| `/locations` | Public | Browse public locations |
| `/join/[code]` | Public | Anonymous queue join flow for patients |
| `/status/[queueId]/[entryId]` | Public | Real-time position tracking with notifications |

## Patient Flow (Public, No Auth)

1. **Browse Locations**: Visit `/locations` to see available locations with public codes
2. **Join Queue**: Navigate to `/join/[publicCode]`, select service, enter name
3. **Get Ticket**: Receive ticket number, position, and estimated wait time
4. **Track Status**: Auto-redirect to `/status/[queueId]/[entryId]` for real-time updates
5. **Get Notified**: Enable browser notifications and audio alerts when position changes
6. **Share Ticket**: Use QR code or share link to access ticket from another device

**Status page features**:
- Real-time updates via Socket.IO (falls back to 30s polling)
- Browser notifications when position improves or called
- Audio alerts when position ≤3 or called
- QR code for easy sharing
- Visual progress ring showing position in queue

## Real-Time Communication

**Backend emits** (via `emitToQueue`, `emitToUser`, etc.):
- `queue.updated` - Queue state changes (new entries, status updates)
- `entry.status_changed` - Entry transitions (WAITING → SERVING → SERVED)
- `serviceflow.transition` - Auto-move to next service
- `notification.sent` - User-specific alerts

**Frontend subscribes** (`frontend/src/hooks/useSocket.ts`):
```typescript
const { joinQueue, onQueueUpdated } = useSocket();
useEffect(() => {
  joinQueue(queueId);
  return onQueueUpdated(data => { /* handle update */ });
}, [queueId]);
```

## Critical Conventions

**Ticket generation** (`backend/src/utils/ticket.ts`): Format is `${PREFIX}${SEQUENCE}` (e.g., `A001`). Sequence increments per queue per day.

**Date handling** (`backend/src/utils/date.ts`): Queues use `getStartOfDay()` for date normalization. Services have `activeDays` as comma-separated weekday numbers (0=Sunday).

**Guest users**: When patients join via `/public/join`, a guest user is created with email `guest_xxx@guest.qms.local` and role `PATIENT`.

**Auth flow**: Frontend stores JWT in `localStorage`. API client in `frontend/src/api/client.ts` auto-injects token. 401 responses redirect to `/login`.

## Key Files

- `backend/src/index.ts` - Server entry, Socket.IO room handlers
- `backend/prisma/schema.prisma` - Database schema, enums, relations
- `backend/src/routes/index.ts` - Route registration, public endpoints
- `backend/src/controllers/queue.controller.ts` - Queue operations including `publicJoinQueue`, `getPublicStatus`
- `frontend/src/api/client.ts` - API client with auth interceptors and public methods
- `frontend/src/hooks/useSocket.ts` - WebSocket hook for real-time updates
- `frontend/src/components/Layout.tsx` - Main layout with role-based navigation
- `frontend/src/app/join/[code]/page.tsx` - Public queue join flow
- `frontend/src/app/status/[queueId]/[entryId]/page.tsx` - Real-time position tracking with notifications

## Environment Variables

**Backend** (`.env` or Docker env):
- `DATABASE_URL` - Postgres connection string
- `JWT_SECRET` - Token signing key
- `REDIS_URL` - Redis for caching (optional)
- `FRONTEND_URL` - CORS origin

**Frontend**:
- `NEXT_PUBLIC_API_URL` - Backend API base (default: `http://localhost:8004/api/v1`)
- `NEXT_PUBLIC_SOCKET_URL` - Socket.IO endpoint (default: `http://localhost:8004`)
