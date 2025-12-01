# Queue Management System (QMS) - AI Coding Agent Instructions

## Architecture Overview

Multi-tenant queue management system with **Express.js + Prisma backend** and **Next.js 15 frontend**. Real-time updates via Socket.IO. Three-tier hierarchy: `Organization → Location → Service → Queue → QueueEntry`.

### Key Design Patterns

**Multi-tenancy**: All entities cascade from `Organization`. Use `organizationId` filtering for data isolation.

**Event-driven updates**: Backend emits Socket.IO events to room-based channels (`queue:${id}`, `user:${id}`, `service:${id}`, `location:${id}`). Frontend hooks subscribe using `useSocket()`. See `backend/src/lib/socket.ts` for event constants.

**Public vs operator flows**: 
- **Operators** register via `/auth/register` with invite codes, manage queues via authenticated APIs
- **Patients** join anonymously via `/join/[publicCode]` pages (no registration required)
- Locations have optional `publicCode` for patient-facing queue joins

### Core Domain Model

```
Organization (tenant root)
└── Location (physical branch, has optional publicCode)
    └── Service (defines queue type: INDIVIDUAL/GENERAL)
        ├── Queue (daily instance with slots)
        │   ├── Slot (time windows)
        │   └── QueueEntry (person in line, has ticketNumber)
        ├── ServiceFlow (defines auto-transitions between services)
        └── Practitioner (staff assignment)
```

**Queue lifecycle**: Created daily per service. Slots auto-generated from `Service.{startTime, endTime, slotDuration}`. Entries track status: `WAITING → SERVING → SERVED` (see `EntryStatus` enum).

**User roles** (`backend/prisma/schema.prisma`): `SUPER_ADMIN`, `ORG_ADMIN`, `LOCATION_ADMIN`, `SERVICE_STAFF`, `RECEPTIONIST`, `PATIENT`. Auth middleware in `backend/src/middleware/auth.middleware.ts` uses `authenticate()` + `authorize(...roles)`.

## Development Workflow

**Setup & Run**:
```bash
# Full Docker dev environment (hot-reload enabled)
docker-compose up -d --build

# Or manual backend setup
cd backend && npm install
npm run prisma:generate && npm run prisma:migrate
npm run dev  # Starts on :9000

# Frontend
cd frontend && npm install && npm run dev  # Starts on :3000
```

**Exposed ports** (Docker): Frontend `:8003`, Backend `:8004`, Redis `:6380`. Backend expects Postgres at `host.docker.internal:5432` by default.

**Database migrations**: Always run `npm run prisma:migrate` after schema changes. Use `npx prisma studio` to inspect data.

## Critical Conventions

**Socket.IO rooms**: Backend uses prefixed room names (`queue:${id}`, `user:${id}`, etc.). Frontend must join rooms via `socket.emit('join:queue', queueId)` before receiving updates. See `backend/src/index.ts` lines 60-85.

**Ticket generation** (`backend/src/utils/ticket.ts`): Format is `${PREFIX}${SEQUENCE}` (e.g., `A001`). Sequence increments per queue per day. QR data is JSON-encoded entry metadata.

**Date handling** (`backend/src/utils/date.ts`): Queues use `getStartOfDay()` for date normalization. Slot generation via `generateTimeSlots()` creates non-overlapping windows. Services have `activeDays` as comma-separated weekday numbers (0=Sunday).

**API structure**: Controllers in `backend/src/controllers/`, routes in `backend/src/routes/`. All routes prefixed with `/api/v1`. Public endpoints (e.g., `/public/locations`) bypass auth.

**Frontend API client** (`frontend/src/api/client.ts`): Axios instance with auto-token injection. Token stored in `localStorage`. 401 responses trigger redirect to `/login`.

**Error handling**: Use `next(error)` in controllers to pass to `backend/src/middleware/error.middleware.ts`. Frontend expects `{ error: string }` response format.

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

## Service Flows

**Auto-transitions**: `ServiceFlow` model defines chains (e.g., Reception → Doctor → Lab). When entry marked `SERVED`, controller checks `flowsFrom` relations and optionally creates new entry in target service. See `backend/src/controllers/queue.controller.ts` `completeAndTransition()`.

## Testing & Debugging

**Health check**: `GET /health` returns `{ status: 'OK', timestamp, version }`.

**Smoke tests**: `tests/smoke-test.js` validates basic API functionality.

**Common issues**:
- Socket not receiving updates → Check room join event was emitted
- 401 errors → Verify JWT_SECRET matches across containers
- Prisma client errors → Regenerate client after schema changes
- Slot booking conflicts → Check `concurrentLimit` and `bookedCount` logic

## Key Files

- `backend/src/index.ts` - Server entry, Socket.IO setup
- `backend/prisma/schema.prisma` - Database schema, enums, relations
- `backend/src/lib/socket.ts` - Socket utilities, event constants
- `backend/src/controllers/queue.controller.ts` - Queue operations (580 lines, handles join/call/serve)
- `frontend/src/api/client.ts` - API client with auth interceptors
- `frontend/src/hooks/useSocket.ts` - WebSocket hook for real-time updates
- `docker-compose.yml` - Dev environment (uses `.dev` Dockerfiles for hot-reload)

## Environment Variables

**Backend** (`.env` or Docker env):
- `DATABASE_URL` - Postgres connection string
- `JWT_SECRET` - Token signing key
- `REDIS_URL` - Redis for caching (optional)
- `FRONTEND_URL` - CORS origin

**Frontend**:
- `NEXT_PUBLIC_API_URL` - Backend API base (default: `http://localhost:8004/api/v1`)
- `NEXT_PUBLIC_SOCKET_URL` - Socket.IO endpoint (default: `http://localhost:8004`)
