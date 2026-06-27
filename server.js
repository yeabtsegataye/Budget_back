require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const categoryRoutes = require('./routes/categories');
const statsRoutes = require('./routes/stats');
const userRoutes = require('./routes/user');
const bankRoutes = require('./routes/banks');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5000;

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://budget-front-jxuu.onrender.com',
  'https://budget-front-fsmxigqzc-yeabtsegas-projects.vercel.app'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Root route - This fixes the "Route not found" error
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'Budget Tracker API is running',
    version: '1.0.0',
    endpoints: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        me: 'GET /api/auth/me'
      },
      transactions: {
        getAll: 'GET /api/transactions',
        getOne: 'GET /api/transactions/:id',
        create: 'POST /api/transactions',
        update: 'PUT /api/transactions/:id',
        delete: 'DELETE /api/transactions/:id'
      },
      categories: {
        getAll: 'GET /api/categories',
        getOne: 'GET /api/categories/:id',
        create: 'POST /api/categories',
        update: 'PUT /api/categories/:id',
        delete: 'DELETE /api/categories/:id'
      },
      stats: {
        summary: 'GET /api/stats/summary',
        monthly: 'GET /api/stats/monthly',
        yearly: 'GET /api/stats/yearly'
      },
      user: {
        profile: 'GET /api/user/profile',
        update: 'PUT /api/user/profile',
        changePassword: 'PUT /api/user/change-password'
      },
      health: 'GET /health'
    },
    docs: 'For more information, visit the API documentation',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/banks', bankRoutes);

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      root: 'GET /',
      health: 'GET /health',
      auth: '/api/auth/*',
      transactions: '/api/transactions/*',
      categories: '/api/categories/*',
      stats: '/api/stats/*',
      user: '/api/user/*'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate key error' });
  }
  
  res.status(500).json({ error: 'Something went wrong!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB');
  
  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  });
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM signal, shutting down gracefully...');
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});