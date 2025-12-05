/**
 * Error Handler Middleware
 * 
 * Centralized error handling for Express app.
 */

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Database errors
  if (err.code === '23505') { // Unique violation
    return res.status(409).json({
      success: false,
      error: 'Duplicate entry. This record already exists.'
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      error: 'Invalid reference. Referenced record does not exist.'
    });
  }

  // Request aborted errors
  if (err.message === 'request aborted' || err.message?.includes('aborted') || err.name === 'BadRequestError') {
    // Don't log as error - client disconnected, which is normal
    console.warn('Request aborted by client:', {
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString()
    });
    // Don't send response if headers already sent or connection closed
    if (!res.headersSent && !req.aborted) {
      return res.status(499).json({
        response: {
          status: 'error',
          message: 'Request was cancelled',
          data: {}
        }
      });
    }
    return; // Connection already closed
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Authentication token expired'
    });
  }

  // Default error
  const statusCode = err.statusCode || err.status || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};

