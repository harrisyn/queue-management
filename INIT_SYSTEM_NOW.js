const fs = require('fs');
const path = require('path');

console.log('🚀 Initializing Queue Management System...\n');

// Root package.json
const rootPackageJson = {
  "name": "queue-management-system",
  "version": "1.0.0",
  "description": "Multi-tenant Queue Management System",
  "scripts": {
    "setup": "node INIT_SYSTEM_NOW.js",
    "install-all": "npm install && cd backend && npm install && cd ../frontend && npm install",
    "dev:backend": "cd backend && npm run dev",
    "dev:frontend": "cd frontend && npm run dev",
    "build": "cd backend && npm run build && cd ../frontend && npm run build",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  },
  "keywords": ["queue", "management", "healthcare"],
  "author": "",
  "license": "MIT"
};

// Backend package.json
const backendPackageJson = {
  "name": "qms-backend",
  "version": "1.0.0",
  "description": "Queue Management System Backend API",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.7.0",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "express-validator": "^7.0.1",
    "socket.io": "^4.6.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.10.5",
    "@types/cors": "^2.8.17",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "prisma": "^5.7.0"
  }
};

// Frontend package.json
const frontendPackageJson = {
  "name": "qms-frontend",
  "version": "1.0.0",
  "description": "Queue Management System Frontend",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.1",
    "axios": "^1.6.2",
    "socket.io-client": "^4.6.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.0.8",
    "typescript": "^5.3.3"
  }
};

// Backend tsconfig.json
const backendTsConfig = {
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
};

// Prisma schema
const prismaSchema = `// Queue Management System - Database Schema
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Organization {
  id        String     @id @default(uuid())
  name      String
  email     String?
  phone     String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  locations Location[]
  users     User[]
}

model Location {
  id             String       @id @default(uuid())
  organizationId String
  name           String
  address        String?
  timezone       String       @default("UTC")
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  services       Service[]
}

enum ServiceType {
  INDIVIDUAL
  GENERAL
}

model Service {
  id              String        @id @default(uuid())
  locationId      String
  name            String
  description     String?
  type            ServiceType   @default(GENERAL)
  slotDuration    Int           @default(15) // minutes
  concurrentLimit Int           @default(1)
  activeDays      String        @default("1,2,3,4,5") // Mon-Fri
  startTime       String        @default("09:00")
  endTime         String        @default("17:00")
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  location        Location      @relation(fields: [locationId], references: [id], onDelete: Cascade)
  queues          Queue[]
  practitioners   Practitioner[]
  appointments    Appointment[]
  flowsFrom       ServiceFlow[] @relation("FromService")
  flowsTo         ServiceFlow[] @relation("ToService")
}

model Practitioner {
  id        String   @id @default(uuid())
  userId    String
  serviceId String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  service   Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  
  @@unique([userId, serviceId])
}

enum QueueStatus {
  ACTIVE
  PAUSED
  CLOSED
}

model Queue {
  id           String        @id @default(uuid())
  serviceId    String
  date         DateTime
  status       QueueStatus   @default(ACTIVE)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  service      Service       @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  slots        Slot[]
  entries      QueueEntry[]
  
  @@unique([serviceId, date])
}

model Slot {
  id           String        @id @default(uuid())
  queueId      String
  startTime    DateTime
  endTime      DateTime
  capacity     Int           @default(1)
  bookedCount  Int           @default(0)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  queue        Queue         @relation(fields: [queueId], references: [id], onDelete: Cascade)
  appointments Appointment[]
}

enum EntryStatus {
  WAITING
  SERVING
  SERVED
  CANCELLED
  NO_SHOW
}

model QueueEntry {
  id           String      @id @default(uuid())
  queueId      String
  userId       String
  ticketNumber String
  status       EntryStatus @default(WAITING)
  priority     Int         @default(0)
  joinedAt     DateTime    @default(now())
  calledAt     DateTime?
  servedAt     DateTime?
  completedAt  DateTime?
  notes        String?
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt
  queue        Queue       @relation(fields: [queueId], references: [id], onDelete: Cascade)
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([queueId, status])
  @@index([userId])
}

model ServiceFlow {
  id            String   @id @default(uuid())
  fromServiceId String
  toServiceId   String
  condition     String?  // JSON condition for when to auto-transition
  autoTransfer  Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  fromService   Service  @relation("FromService", fields: [fromServiceId], references: [id], onDelete: Cascade)
  toService     Service  @relation("ToService", fields: [toServiceId], references: [id], onDelete: Cascade)
  
  @@unique([fromServiceId, toServiceId])
}

model Appointment {
  id            String    @id @default(uuid())
  userId        String
  serviceId     String
  slotId        String
  createdBy     String
  status        String    @default("SCHEDULED") // SCHEDULED, CONFIRMED, CANCELLED, COMPLETED
  rescheduledAt DateTime?
  notes         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  service       Service   @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  slot          Slot      @relation(fields: [slotId], references: [id], onDelete: Cascade)
  creator       User      @relation("CreatedAppointments", fields: [createdBy], references: [id])
  
  @@index([userId])
  @@index([serviceId])
}

enum UserRole {
  SUPER_ADMIN
  ORG_ADMIN
  LOCATION_ADMIN
  SERVICE_STAFF
  RECEPTIONIST
  PATIENT
}

model User {
  id                    String          @id @default(uuid())
  organizationId        String?
  email                 String          @unique
  password              String
  firstName             String
  lastName              String
  phone                 String?
  role                  UserRole        @default(PATIENT)
  isActive              Boolean         @default(true)
  createdAt             DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  organization          Organization?   @relation(fields: [organizationId], references: [id], onDelete: SetNull)
  queueEntries          QueueEntry[]
  appointments          Appointment[]
  createdAppointments   Appointment[]   @relation("CreatedAppointments")
  practitioners         Practitioner[]
  notifications         Notification[]
}

enum NotificationType {
  QUEUE_JOINED
  TURN_APPROACHING
  NOW_SERVING
  APPOINTMENT_REMINDER
  APPOINTMENT_CANCELLED
}

enum NotificationChannel {
  EMAIL
  SMS
  PUSH
  IN_APP
}

model Notification {
  id        String              @id @default(uuid())
  userId    String
  type      NotificationType
  channel   NotificationChannel
  message   String
  sentAt    DateTime            @default(now())
  readAt    DateTime?
  user      User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, readAt])
}
`;

// Backend index.ts
const backendIndexTs = `import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/error.middleware';

dotenv.config();

const app: Application = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(\`🚀 Server running on port \${PORT}\`);
});

export { io };
`;

// Auth controller
const authControllerTs = `import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'PATIENT'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};
`;

// Auth middleware
const authMiddlewareTs = `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JwtPayload;

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};
`;

// Error middleware
const errorMiddlewareTs = `import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', err);

  res.status(500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
`;

// Auth routes
const authRoutesTs = `import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);

export default router;
`;

// Docker Compose
const dockerComposeYml = `version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: qms-postgres
    environment:
      POSTGRES_USER: qms_user
      POSTGRES_PASSWORD: qms_password
      POSTGRES_DB: qms_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - qms-network

  redis:
    image: redis:7-alpine
    container_name: qms-redis
    ports:
      - "6379:6379"
    networks:
      - qms-network

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: qms-backend
    environment:
      DATABASE_URL: postgresql://qms_user:qms_password@postgres:5432/qms_db
      REDIS_URL: redis://redis:6379
      JWT_SECRET: your-secret-key-change-in-production
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    volumes:
      - ./backend:/app
      - /app/node_modules
    networks:
      - qms-network

volumes:
  postgres_data:

networks:
  qms-network:
    driver: bridge
`;

// Backend Dockerfile
const backendDockerfile = `FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
`;

// Backend .env
const backendEnv = `DATABASE_URL="postgresql://qms_user:qms_password@localhost:5432/qms_db"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-change-in-production"
PORT=3000
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"
`;

// Frontend index.html
const frontendIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Queue Management System</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`;

// Write all files
const writeFile = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, typeof content === 'object' ? JSON.stringify(content, null, 2) : content);
  console.log(`✅ Created: ${filePath}`);
};

// Create all files
try {
  console.log('📝 Creating configuration files...\n');

  // Root files
  writeFile('package.json', rootPackageJson);
  writeFile('docker-compose.yml', dockerComposeYml);

  // Backend files
  writeFile('backend/package.json', backendPackageJson);
  writeFile('backend/tsconfig.json', backendTsConfig);
  writeFile('backend/Dockerfile', backendDockerfile);
  writeFile('backend/.env', backendEnv);
  writeFile('backend/prisma/schema.prisma', prismaSchema);
  writeFile('backend/src/index.ts', backendIndexTs);
  writeFile('backend/src/controllers/auth.controller.ts', authControllerTs);
  writeFile('backend/src/middleware/auth.middleware.ts', authMiddlewareTs);
  writeFile('backend/src/middleware/error.middleware.ts', errorMiddlewareTs);
  writeFile('backend/src/routes/auth.routes.ts', authRoutesTs);

  // Frontend files
  writeFile('frontend/package.json', frontendPackageJson);
  writeFile('frontend/index.html', frontendIndexHtml);

  console.log('\n✨ All files created successfully!\n');
  console.log('📋 Next steps:');
  console.log('1. Run: npm install');
  console.log('2. Run: cd backend && npm install');
  console.log('3. Run: cd frontend && npm install');
  console.log('4. Start Docker: docker-compose up -d');
  console.log('5. Run migrations: cd backend && npx prisma migrate dev --name init');
  console.log('6. Start backend: cd backend && npm run dev');
  console.log('7. Start frontend: cd frontend && npm run dev\n');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
