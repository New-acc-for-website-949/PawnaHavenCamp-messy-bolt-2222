const errorCodes = {
  PROPERTY_NOT_FOUND: { status: 404, code: 'PROPERTY_NOT_FOUND', message: 'Property not found' },
  UNIT_NOT_FOUND: { status: 404, code: 'UNIT_NOT_FOUND', message: 'Unit not found' },
  VILLA_NOT_FOUND: { status: 404, code: 'VILLA_NOT_FOUND', message: 'Villa not found' },
  CAMPING_NOT_FOUND: { status: 404, code: 'CAMPING_NOT_FOUND', message: 'Camping property not found' },
  INVALID_CATEGORY: { status: 400, code: 'INVALID_CATEGORY', message: 'Invalid property category' },
  INVALID_DATE: { status: 400, code: 'INVALID_DATE', message: 'Invalid date format' },
  INVALID_PRICE: { status: 400, code: 'INVALID_PRICE', message: 'Invalid price format' },
  MISSING_REQUIRED_FIELD: { status: 400, code: 'MISSING_REQUIRED_FIELD', message: 'Required field is missing' },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED', message: 'Authentication required' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN', message: 'Access denied' },
  DATABASE_ERROR: { status: 500, code: 'DATABASE_ERROR', message: 'Database operation failed' },
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' }
};

class AppError extends Error {
  constructor(errorCode, details = null) {
    super(errorCode.message);
    this.status = errorCode.status;
    this.code = errorCode.code;
    this.details = details;
    this.isOperational = true;
  }
}

const createError = (errorCode, details = null) => {
  return new AppError(errorCode, details);
};

const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const errorMiddleware = (err, req, res, next) => {
  console.error(`[ERROR] ${err.code || 'UNKNOWN'}: ${err.message}`, {
    path: req.path,
    method: req.method,
    details: err.details,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });

  if (err.isOperational) {
    return res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    });
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  });
};

const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

const sendError = (res, errorCode, details = null) => {
  return res.status(errorCode.status).json({
    success: false,
    error: {
      code: errorCode.code,
      message: errorCode.message,
      details
    }
  });
};

module.exports = {
  errorCodes,
  AppError,
  createError,
  asyncHandler,
  errorMiddleware,
  sendSuccess,
  sendError
};
