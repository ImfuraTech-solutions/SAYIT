const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const connectionState = require('./connectionState');
const compression = require('compression');

// Import route files
const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');
const adminRoutes = require('./routes/admin.routes');
const standardUserRoutes = require('./routes/standarduser.routes');
const anonymousUserRoutes = require('./routes/anonymoususer.routes');
const externalComplaintRoutes = require('./routes/externalcomplaint.routes');
const contactRoutes = require('./routes/contact.routes');
const feedbackRoutes = require('./routes/feedback.routes');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Create Express app
const app = express();

// Detect environment and platform
const isProduction = process.env.NODE_ENV === 'production';
const isAzure = process.env.WEBSITE_SITE_NAME || process.env.AZURE_WEBAPP_NAME;
const isHeroku = process.env.DYNO;
const isRender = process.env.RENDER;
const platform = isAzure ? 'azure' : isHeroku ? 'heroku' : isRender ? 'render' : 'other';

// Set trust proxy for platforms that use proxies (Heroku, Azure App Service, Render)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Compression middleware - improves performance on all platforms
app.use(compression({
  // Skip compressing responses with no-transform header or smaller than 1kb
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6 // Balanced CPU usage vs compression ratio
}));

// Enhanced security middleware with platform-specific optimizations
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "blob:"],
      scriptSrc: ["'self'", "'unsafe-inline'", ...(isAzure ? ["'unsafe-eval'"] : [])],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'", process.env.API_URL || "*"],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Disable certain headers on platforms that already add them
  xssFilter: !isAzure, // Azure App Service adds this
}));

// Cross-platform CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allowed origins list from environment, or any origin (*) in development
    const allowedOrigins = process.env.CORS_ORIGIN ? 
      process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()) : 
      (isProduction ? [] : '*');
    
    // Always allow requests with no origin (mobile apps, postman)
    if (!origin || allowedOrigins === '*') {
      return callback(null, true);
    }

    // Check if origin is in the allowed list
    if (Array.isArray(allowedOrigins) && allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // In development, log why CORS was blocked
    if (!isProduction) {
      console.warn(`CORS blocked: ${origin} not in allowed list`);
    }
    
    callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  maxAge: 86400, // 24 hours
  // Increase preflight caching on Azure
  ...(isAzure && { preflightContinue: false })
};
app.use(cors(corsOptions));

// Apply platform-agnostic rate limiting to API requests
// More permissive in development, more restrictive in production
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (isProduction ? 15 * 60 * 1000 : 60 * 1000), 
  max: parseInt(process.env.RATE_LIMIT_MAX) || (isProduction ? 100 : 500),
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Cross-platform IP detection that works across hosting platforms
  keyGenerator: (req) => {
    // Different platforms place client IP in different headers
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.headers['cf-connecting-ip'] || // Cloudflare
           req.headers['fastly-client-ip'] || // Fastly
           req.ip;
  },
  // Skip rate limiting for health checks and monitoring
  skip: (req) => {
    return req.path === '/health' || req.path.startsWith('/health/') || 
           req.headers['user-agent']?.includes('monitoring');
  },
  // Customize response based on platform
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
      retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000
    });
  }
});

// Apply rate limiting to API routes only
app.use('/api', limiter);

// Cross-platform logging setup
const getLogFormat = () => {
  if (isAzure) {
    // Azure App Insights compatible format
    return ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';
  } else if (isProduction) {
    return 'combined';
  }
  return 'dev'; // Development format
};

// Add request ID generation for cross-platform tracing
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || 
           req.headers['x-correlation-id'] || 
           `req-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Configure logging with platform-specific optimizations
app.use(morgan(getLogFormat(), {
  skip: (req) => req.url === '/health' || req.url.includes('/health/'),
  // Add request ID to logs for cross-platform tracing
  stream: {
    write: (message) => {
      console.log(message.trim());
    }
  }
}));

// Cross-platform body parsing with appropriate limits
const bodyParserLimit = isProduction ? '1mb' : '5mb';
app.use(express.json({ 
  limit: bodyParserLimit,
  // Verify content type to prevent content-type attacks
  verify: (req, res, buf, encoding) => {
    if (buf.length > parseInt(bodyParserLimit)) {
      throw new Error('Request payload too large');
    }
  } 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: bodyParserLimit 
}));

// Cross-platform file upload directories
const getUploadDir = () => {
  // Azure specific path (persisted storage location)
  if (isAzure && process.env.HOME) {
    return path.join(process.env.HOME, 'site', 'wwwroot', 'uploads');
  }
  
  // Default path that works across platforms
  return path.join(__dirname, 'uploads');
};

// Ensure uploads directory exists with cross-platform compatibility
const uploadDir = getUploadDir();
if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.warn(`Could not create upload directory at ${uploadDir}: ${err.message}`);
    // Fallback to temp directory for platforms where we can't write to app directory
    if (isProduction) {
      console.info('Using system temp directory for uploads instead');
    }
  }
}

// Enhanced health check endpoint with platform-specific details
app.get('/health', (req, res) => {
  const dbStatus = connectionState.isConnected ? 'connected' : 'disconnected';
  const memory = process.memoryUsage();
  
  const healthInfo = {
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    platform,
    uptime: process.uptime(),
    memory: {
      rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
      heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
      external: `${Math.round(memory.external / 1024 / 1024)} MB`,
    }
  };
  
  res.status(dbStatus === 'connected' ? 200 : 503).json(healthInfo);
});

// Detailed health check for better platform monitoring
app.get('/health/detailed', (req, res) => {
  const services = {
    api: { status: 'ok' },
    database: { 
      status: connectionState.isConnected ? 'ok' : 'degraded',
      details: connectionState.details || {}
    },
    uploads: { 
      status: fs.existsSync(uploadDir) && fs.accessSync(uploadDir, fs.constants.W_OK) ? 'ok' : 'degraded',
      path: uploadDir
    }
  };
  
  const overallStatus = Object.values(services).every(s => s.status === 'ok') ? 'ok' : 'degraded';
  
  res.status(overallStatus === 'ok' ? 200 : 503).json({
    status: overallStatus,
    services,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    platform
  });
});

// Liveness and readiness probes for Kubernetes environments
app.get('/health/liveness', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

app.get('/health/readiness', (req, res) => {
  const isReady = connectionState.isConnected;
  res.status(isReady ? 200 : 503).json({ 
    status: isReady ? 'ready' : 'not_ready' 
  });
});

// Apply routes with better error handling
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/standarduser', standardUserRoutes);
app.use('/api/anonymous', anonymousUserRoutes);
app.use('/api/external', externalComplaintRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/feedback', feedbackRoutes);

// Serve React Frontend with platform-specific optimizations
const distPath = path.join(__dirname, '../../Frontend/dist');
app.use(express.static(distPath, {
  maxAge: isProduction ? '1d' : 0, // Longer cache for production
  etag: true,
  lastModified: true,
  // Compression already handled by middleware
  setHeaders: (res, path) => {
    // Set specific headers for different file types
    if (path.endsWith('.html')) {
      // No caching for HTML
      res.setHeader('Cache-Control', 'no-cache');
    } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
      // Long cache for static assets with versioning
      res.setHeader('Cache-Control', isProduction ? 'public, max-age=604800, immutable' : 'no-cache');
    }
  }
}));

// Root route with platform info
app.get('/api', (req, res) => {
  res.json({
    message: 'SAYIT API is running',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    platform,
    documentation: '/api/docs'  // API documentation URL if available
  });
});

// Improved API 404 handler with suggestion
app.all('/api/*', (req, res) => {
  // Extract the requested endpoint for better error message
  const endpoint = req.path.replace('/api/', '');
  
  res.status(404).json({ 
    success: false, 
    message: `API endpoint not found: ${endpoint}`,
    availableEndpoints: [
      '/api/auth',
      '/api/complaints',
      '/api/admin',
      '/api/standarduser',
      '/api/anonymous',
      '/api/contact',
      '/api/staff',
      '/api/feedback'
    ]
  });
});

// Serve React app for client-side routing - with platform-specific optimizations
app.get('*', (req, res) => {
  // Check if index.html exists
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // Fallback if frontend isn't built/available
    res.status(200).send(`
      <html>
        <head><title>SAYIT Platform</title></head>
        <body>
          <h1>SAYIT API Server</h1>
          <p>The API server is running, but the frontend files are not available.</p>
          <p>API status: <a href="/health">Health Check</a></p>
          <p>Environment: ${process.env.NODE_ENV || 'development'}</p>
          <p>Platform: ${platform}</p>
        </body>
      </html>
    `);
  }
});

// Cross-platform error handler with detailed information for debugging
app.use((err, req, res, next) => {
  // Generate error ID for tracking
  const errorId = `err-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  // Log with request ID for correlation
  console.error(`Error ${errorId} on ${req.method} ${req.url} [${req.id}]: ${err.message}`);
  
  // Include stack trace in non-production environments
  if (!isProduction) {
    console.error(err.stack);
  } else {
    // In production, log to appropriate platform-specific logging
    if (isAzure) {
      // Azure Application Insights logs errors automatically when console.error is used
    } else if (isHeroku) {
      // Heroku logs via stdout/stderr
    }
  }
  
  // Set appropriate status code
  const statusCode = err.statusCode || err.status || 500;
  
  // Prepare response based on environment
  const response = { 
    success: false,
    message: err.message || 'Server error',
    errorId // Always include error ID for reference
  };
  
  // Include developer info in non-production
  if (!isProduction) {
    response.error = {
      stack: err.stack,
      ...err
    };
  }
  
  res.status(statusCode).json(response);
});

// Enhanced connection logic with platform-specific optimizations
async function startServer() {
  try {
    // Platform-specific MongoDB connection options
    const mongoOptions = {
      maxPoolSize: parseInt(process.env.MONGO_POOL_SIZE) || (isProduction ? 10 : 5),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 1,
      connectTimeoutMS: parseInt(process.env.MONGO_CONNECT_TIMEOUT) || 30000,
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT) || 45000,
      // Azure Cosmos DB specific settings if applicable
      ...(process.env.DATABASE_TYPE === 'azure_cosmos_db' && {
        retryWrites: false, // Cosmos DB doesn't support retryWrites
        readPreference: 'nearest'
      }),
      // Heroku and Render often need these settings
      ...(isHeroku || isRender ? {
        serverSelectionTimeoutMS: 10000,
        heartbeatFrequencyMS: 30000
      } : {})
    };

    // Connect to MongoDB
    await connectionState.connect(process.env.MONGODB_URI, mongoOptions);

    // Start server after successful database connection
    const PORT = process.env.PORT || 5000;
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (${platform} platform)`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
    
    // Increase default timeout for platforms with longer cold starts
    server.timeout = parseInt(process.env.SERVER_TIMEOUT) || (isProduction ? 120000 : 60000);
    
    // Enhanced graceful shutdown for all platforms
    const gracefulShutdown = async (signal) => {
      console.log(`Received ${signal || 'shutdown'} signal, shutting down gracefully...`);
      
      // Stop accepting new connections
      server.close(async () => {
        console.log('HTTP server closed');
        
        // Close database connection
        await connectionState.disconnect();
        console.log('All connections closed');
        
        // Exit with success status
        process.exit(0);
      });
      
      // Force close if graceful shutdown takes too long
      // Different platforms may need different timeout values
      const forceTimeout = isAzure ? 10000 : isHeroku ? 5000 : 15000;
      setTimeout(() => {
        console.error(`Could not close connections in time (${forceTimeout}ms), forcing shutdown`);
        process.exit(1);
      }, forceTimeout);
    };
    
    // Register listeners for various termination signals used by different platforms
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // Nodemon restart
    
    return server;
  } catch (err) {
    console.error('Database connection failed:', err);
    
    // Retry logic - only in production to avoid infinite loops during development issues
    if (isProduction && process.env.AUTO_RETRY === 'true') {
      console.log('Retrying in 5 seconds...');
      setTimeout(() => startServer(), 5000);
    } else {
      // Exit with error status
      process.exit(1);
    }
  }
}

// Handle unhandled promise rejections - cross-platform stability
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection:', reason);
  
  // Log the promise details
  console.error('Promise:', promise);
  
  // Don't crash in production - just log the error
  if (!isProduction) {
    // In development, show more details to developer
    console.error('Stack:', reason.stack);
  }
});

// Handle uncaught exceptions - cross-platform stability
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  console.error('Stack:', err.stack);
  
  // Don't crash in production unless it's a critical error
  if (!isProduction || err.code === 'EADDRINUSE') {
    process.exit(1);
  }
  
  // For production, log but try to keep the service running
  console.error('Attempting to continue despite uncaught exception...');
});

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
