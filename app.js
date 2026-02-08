// app.js

const express = require('express');
const helmet = require('helmet');
const winston = require('winston');
// The 'process' object is a global in Node.js, so explicitly requiring it is generally unnecessary.

// --- 1. Adopt a Structured Logging Solution ---
// Configure Winston logger for structured logging
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json() // Output logs as JSON for easier parsing by log aggregators
  ),
  transports: [
    // Console transport for development readability
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
      level: 'debug' // Log debug messages to console in development
    }),
    // In production, consider adding file transports or external logging services (e.g., Sentry, Splunk, ELK stack)
    // Uncomment these for file-based logging in production environments, or replace with external services.
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
  // Handle unhandled exceptions and promise rejections with the logger
  exceptionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'exceptions.log' }) // Log exceptions to a file
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'rejections.log' }) // Log rejections to a file
  ]
});

// For local development, consider using `dotenv` to manage environment variables from a .env file.
// require('dotenv').config(); // Add this line if using dotenv

const app = express();
const port = process.env.PORT || 3000;

// --- 2. Enhance Security with Middleware (Helmet) ---
// Helmet helps secure Express apps by setting various HTTP headers
app.use(helmet());

// Standard Express middleware for parsing request bodies
app.use(express.json()); // Parses incoming requests with JSON payloads
app.use(express.urlencoded({ extended: true })); // Parses incoming requests with URL-encoded payloads

// Custom middleware for logging all incoming requests
app.use((req, res, next) => {
  logger.info(`Incoming Request: ${req.method} ${req.originalUrl}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    // Note: Be cautious about logging sensitive information from req.body in production
    // body: req.body
  });
  next();
});

// --- 5. Modularize Routes (Addressing 'Missing Routes' by including example) ---
// To maintain a clean 'app.js', routes are ideally moved to separate files.
// For demonstration and to make the app functional, the example routes are included directly here.
// In a real application, you would create 'routes/api.js' and import it.
const apiRouter = express.Router();

apiRouter.get('/', (req, res) => {
  res.send('Hello from setup-a-ci Node.js app!');
});

// Add a Health Check Endpoint (Suggestion)
apiRouter.get('/health', (req, res) => {
  logger.info('Health check requested.');
  res.status(200).json({ status: 'healthy', uptime: process.uptime() });
});

// Example of a basic protected route (authentication middleware would go here)
apiRouter.get('/data', (req, res) => {
  res.json({ message: 'This is some protected data!' });
});

// Mount API routes under the /api prefix
app.use('/api', apiRouter);

// Basic root route for general access
app.get('/', (req, res) => {
  res.send('Welcome to the Node.js application! Check /api for API endpoints, or /api/health for status.');
});

// --- 3. Robust Error Handling (Already well-implemented, ensuring correct placement) ---

// 404 Not Found Middleware: Handles requests to undefined routes
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404;
  logger.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
  next(error); // Pass the error to the general error handler
});

// General Error Handling Middleware: Catches all errors passed via next(error)
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  res.status(statusCode);
  res.json({
    message: err.message,
    // Only provide stack trace in non-production environments for security and cleaner logs
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
  });
  logger.error(`Error: ${err.message}`, {
    status: statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    // Optionally log request body for debugging specific errors
    // body: req.body
  });
});

// Server startup with robust error handling for port conflicts
const server = app.listen(port, () => {
  logger.info(`Server is running on port ${port} in ${process.env.NODE_ENV || 'development'} mode.`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${port} is already in use. Please stop the other process or choose a different port.`);
    process.exit(1); // Exit the process with a failure code
  } else {
    logger.error(`Server startup failed: ${err.message}`, { stack: err.stack });
    process.exit(1); // Exit for other critical startup errors
  }
});

// Handle unhandled promise rejections (e.g., async operations without catch blocks)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In a production app, you might want to send alerts here.
  // Perform graceful shutdown to prevent the process from being in an indeterminate state.
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions (e.g., synchronous errors not caught by try-catch)
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message, { stack: error.stack });
  // In a production app, you might want to send alerts here.
  // Perform graceful shutdown.
  server.close(() => {
    process.exit(1);
  });
});

// Export the app for testing purposes (e.g., with Supertest)
module.exports = app;