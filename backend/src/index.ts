import 'dotenv/config';
import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import routes from './routes';
import { errorHandler } from './middleware/error.middleware';
import { setSocketIO } from './lib/socket';

// dotenv is loaded above via import 'dotenv/config'
// This ensures environment variables (DATABASE_URL) are available
// before other modules initialize (Prisma client imports at module load)

const app: Application = express();
const httpServer = createServer(app);
// CORS allowed origins for development and Docker
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:8003',
  'http://localhost:5173',
].filter((o): o is string => Boolean(o));

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

// Initialize socket
setSocketIO(io);

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all origins in development
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general rate limit to all API routes
app.use('/api/', generalLimiter);

// API Routes
app.use('/api/v1', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// WebSocket handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join queue room
  socket.on('join:queue', (queueId: string) => {
    socket.join(`queue:${queueId}`);
    console.log(`Socket ${socket.id} joined queue:${queueId}`);
  });

  // Leave queue room
  socket.on('leave:queue', (queueId: string) => {
    socket.leave(`queue:${queueId}`);
    console.log(`Socket ${socket.id} left queue:${queueId}`);
  });

  // Join user room (for notifications)
  socket.on('join:user', (userId: string) => {
    socket.join(`user:${userId}`);
    console.log(`Socket ${socket.id} joined user:${userId}`);
  });

  // Join service room
  socket.on('join:service', (serviceId: string) => {
    socket.join(`service:${serviceId}`);
    console.log(`Socket ${socket.id} joined service:${serviceId}`);
  });

  // Join location room
  socket.on('join:location', (locationId: string) => {
    socket.join(`location:${locationId}`);
    console.log(`Socket ${socket.id} joined location:${locationId}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`
  🚀 Queue Management System API
  ==============================
  Server running on port ${PORT}
  Health check: http://localhost:${PORT}/health
  API base: http://localhost:${PORT}/api/v1
  
  Environment: ${process.env.NODE_ENV || 'development'}
  `);
});

export { io };
