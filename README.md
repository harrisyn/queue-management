# Queue Management System (QMS)

Multi-tenant, event-driven platform for managing patient/client flow across multiple service queues. Supports appointments, walk-ins, queue transfers, real-time updates, and EMR integration.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- Docker & Docker Compose
- PostgreSQL (via Docker)

### Installation

1. **Build the complete platform**:
   ```bash
   node BUILD_ALL.js
   ```

2. **Start Docker services** (PostgreSQL & Redis):
   ```bash
   docker-compose up -d
   ```

3. **Setup and start backend**:
   ```bash
   cd backend
   npm install
   npm run prisma:generate
   npm run prisma:migrate
   npm run dev
   ```

4. **Start frontend** (in another terminal):
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Access the application** (when using the `docker-compose` in this repo):
   - Frontend (dev container): http://localhost:8003
   - Backend API (dev container): http://localhost:8004/api/v1
   - Health Check: http://localhost:8004/health
   - Operator/admin login: http://localhost:8003/login
   - Patient/public join pages: http://localhost:8003/join/[code]  (public, no account required)

Developer note:
- Running `docker compose up -d --build` in this repo will start the frontend and backend in development mode (hot-reload enabled). Code edits to `./frontend` or `./backend` are reflected immediately in the running containers.
- The repo includes lightweight development Dockerfiles: `frontend/Dockerfile.dev` and `backend/Dockerfile.dev`. These skip the production multi-stage build so container rebuilds are much faster for iterative development.
 - The repo includes lightweight development Dockerfiles: `frontend/Dockerfile.dev` and `backend/Dockerfile.dev`. These skip the production multi-stage build so container rebuilds are much faster for iterative development.

Admin pages added:
- Operator invites management (admin-only): http://localhost:8003/admin/invites
- Admin locations management (assign public join codes): http://localhost:8003/admin/locations
Developer note:
 - Running `docker compose up -d --build` in this repo will start the frontend and backend in development mode (hot-reload enabled). Code edits to `./frontend` or `./backend` are reflected immediately in the running containers.
 - The repo includes lightweight development Dockerfiles: `frontend/Dockerfile.dev` and `backend/Dockerfile.dev`. These skip the production multi-stage build so container rebuilds are much faster for iterative development.

## 📁 Project Structure

```
queue-management/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Main server entry
│   │   ├── lib/
│   │   │   ├── prisma.ts         # Database client
│   │   │   └── socket.ts         # WebSocket utilities
│   │   ├── utils/
│   │   │   ├── ticket.ts         # Ticket generation
│   │   │   └── date.ts           # Date utilities
│   │   ├── controllers/          # API controllers
│   │   │   ├── auth.controller.ts
│   │   │   ├── organization.controller.ts
│   │   │   ├── location.controller.ts
│   │   │   ├── service.controller.ts
│   │   │   ├── queue.controller.ts
│   │   │   ├── appointment.controller.ts
│   │   │   ├── notification.controller.ts
│   │   │   ├── analytics.controller.ts
│   │   │   └── user.controller.ts
│   │   ├── middleware/           # Auth & error handling
│   │   └── routes/               # API routes
│   ├── prisma/
│   │   └── schema.prisma         # Database schema
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts         # API client
│   │   ├── components/
│   │   │   ├── Layout.tsx        # Main layout
│   │   │   ├── QueueDisplay.tsx  # Queue view
│   │   │   ├── QueueControl.tsx  # Staff controls
│   │   │   └── TicketDisplay.tsx # Patient ticket
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx   # Auth state
│   │   ├── hooks/
│   │   │   ├── useAuth.ts        # Auth hook
│   │   │   └── useSocket.ts      # WebSocket hook
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── QueueManagementPage.tsx
│   │   │   ├── MyQueuePage.tsx
│   │   │   ├── ServicesPage.tsx
│   │   │   └── AnalyticsPage.tsx
│   │   ├── types/
│   │   │   └── index.ts          # TypeScript types
│   │   ├── App.tsx               # Root component
│   │   ├── main.tsx              # Entry point
│   │   └── index.css             # Global styles
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml            # Docker services
├── BUILD_ALL.js                  # Complete build script
├── BUILD_BACKEND.js              # Backend builder
├── BUILD_FRONTEND.js             # Frontend builder
└── TECHNICAL_PRD.md              # Product requirements
```

## 🔧 Configuration

### Backend Environment (.env)
```env
DATABASE_URL="postgresql://qms_user:qms_password@localhost:5432/qms_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3000
NODE_ENV=development

FRONTEND_URL="http://localhost:5173"

### Local Email Testing (Mailpit)

When developing locally we include a Mailpit service in `docker-compose.yml` so you can capture and inspect outbound emails (OTP verification, notifications, etc.).

- Mailpit SMTP server (inside Docker) – host: `mailpit`, port: `1025`
- Mailpit Web UI (to view messages) – http://localhost:8025

If you're running the app via Docker Compose (recommended for dev), the backend will default SMTP settings to `mailpit:1025` so OTP emails are captured and visible in the Mailpit UI. To override these settings set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` and `SMTP_PASS` in your environment (or in a `.env` file).

### Registration mode
- `REGISTRATION_MODE` — controls who can register via `/auth/register`.
   - `invite` (default): registration requires an invite token (admin/staff only)
   - `open`: any user can register (not recommended for production)

To create operator accounts in the recommended invite flow use the `POST /api/v1/invites` endpoint (admin-only) which returns a short invite code.

```

## 🎯 Features

### Phase 1 (Core) ✅
- ✅ Multi-tenant organization support
- ✅ Location and service management
- ✅ Queue & slot management
- ✅ Real-time updates (WebSocket)
- ✅ Appointment booking
- ✅ Service flow automation
- ✅ Role-based access control (6 roles)
- ✅ JWT authentication
- ✅ RESTful API
- ✅ Analytics dashboard

### User Roles
| Role | Access Level |
|------|--------------|
| SUPER_ADMIN | Full system access |
| ORG_ADMIN | Organization management |
| LOCATION_ADMIN | Location management |
| SERVICE_STAFF | Queue operations |
| RECEPTIONIST | Appointments & check-in |
| PATIENT | Self-service queue |

## 📊 Database Models

- **Organization** → **Location** → **Service** → **Queue** → **QueueEntry**
- **User** (multiple roles)
- **Appointment** (scheduled bookings)
- **ServiceFlow** (define service transitions)
- **Notification** (multi-channel alerts)

## 🔗 API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/register` | POST | Register new user |
| `/api/v1/auth/login` | POST | Login & get JWT token |

### Organizations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/orgs` | GET | List all organizations |
| `/api/v1/orgs` | POST | Create organization |
| `/api/v1/orgs/:id` | GET | Get organization details |
| `/api/v1/orgs/:id` | PUT | Update organization |

### Locations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/locations/orgs/:orgId/locations` | GET | List locations |
| `/api/v1/locations/orgs/:orgId/locations` | POST | Create location |
| `/api/v1/locations/:id` | GET | Get location details |

### Services
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/services/locations/:id/services` | GET | List services |
| `/api/v1/services/locations/:id/services` | POST | Create service |
| `/api/v1/services/:id/schedule` | GET | Get schedule |
| `/api/v1/services/flows` | POST | Create service flow |

### Queues
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/queues` | POST | Create/get queue for date |
| `/api/v1/queues/:id` | GET | Get queue with entries |
| `/api/v1/queues/:id/join` | POST | Join queue |
| `/api/v1/queues/:id/call-next` | POST | Call next in queue |
| `/api/v1/queues/:id/entry/:entryId/serve` | PATCH | Mark as served |
| `/api/v1/queues/:id/entry/:entryId/cancel` | PATCH | Cancel entry |
| `/api/v1/queues/:id/move` | PATCH | Transfer to another queue |
| `/api/v1/queues/:id/waittime` | GET | Get estimated wait time |
| `/api/v1/queues/:id/ticket/:entryId` | GET | Get ticket with QR data |

### Appointments
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/appointments` | POST | Create appointment |
| `/api/v1/appointments` | GET | List appointments |
| `/api/v1/appointments/user/:userId` | GET | User's appointments |
| `/api/v1/appointments/service/:id/slots` | GET | Available slots |
| `/api/v1/appointments/:id/check-in` | POST | Check-in to queue |
| `/api/v1/appointments/:id/reschedule` | PATCH | Reschedule |
| `/api/v1/appointments/:id/cancel` | PATCH | Cancel |

### Analytics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/queue/:id` | GET | Queue metrics |
| `/api/v1/analytics/service/:id` | GET | Service metrics |
| `/api/v1/analytics/location/:id` | GET | Location throughput |
| `/api/v1/analytics/service/:id/peak-hours` | GET | Peak hours analysis |

### Users & Notifications
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/users/me` | GET | Current user |
| `/api/v1/users` | GET | List users |
| `/api/v1/notifications/user/:userId` | GET | User notifications |
| `/api/v1/notifications/:id/read` | PATCH | Mark as read |

## 📡 WebSocket Events

| Event | Description |
|-------|-------------|
| `queue.updated` | Queue state or entries changed |
| `entry.status_changed` | Entry status: WAITING → SERVING → SERVED |
| `slot.released` | Appointment slot became available |
| `serviceflow.transition` | Patient moved to next service |
| `notification.sent` | User notification |

### WebSocket Rooms
- `queue:{queueId}` - Subscribe to queue updates
- `user:{userId}` - Subscribe to personal notifications
- `service:{serviceId}` - Subscribe to service events
- `location:{locationId}` - Subscribe to location events

## 🐛 Troubleshooting

### Empty Files Issue
If files are empty after git clone, run:
```bash
node INIT_SYSTEM_NOW.js
```

### Database Connection Error
Ensure Docker services are running:
```bash
docker-compose ps
docker-compose up -d
```

### Port Already in Use
Check if ports 3000 (backend), 5173 (frontend), or 5432 (postgres) are already in use:
```bash
# Windows
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :5432
```

## 📝 Development Commands

```bash
# Backend
cd backend
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Run production build
npx prisma studio    # Open database GUI

# Frontend
cd frontend
npm run dev          # Start dev server
npm run build        # Build for production
npm run preview      # Preview production build

# Docker
docker-compose up -d      # Start services
docker-compose down       # Stop services
docker-compose logs -f    # View logs

## ✅ Quick verification / smoke-test
After starting the dev stack run the small smoke test to ensure public listing and join pages are reachable:

```bash
node tests/smoke-test.js
```

```

## 🚢 Deployment

See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md) for detailed deployment instructions.

## 📄 Technical Documentation

- [Technical PRD](./TECHNICAL_PRD.md) - Full product requirements
- [Implementation Guide](./IMPLEMENTATION_GUIDE.md) - Development phases
- [Setup Guide](./SETUP_GUIDE.md) - Detailed setup instructions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📧 Support

For issues or questions, please open a GitHub issue.

---

Built with ❤️ for efficient queue management
