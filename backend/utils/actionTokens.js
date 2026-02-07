const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const TOKEN_EXPIRY = '30m';

const generateActionToken = (payload) => {
  return jwt.sign(payload, SECRET_KEY, { expiresIn: TOKEN_EXPIRY });
};

const verifyActionToken = (token) => {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { error: 'Token has expired' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { error: 'Invalid token' };
    }
    return { error: 'Token verification failed' };
  }
};

const createOwnerActionToken = (bookingId, action, ownerId) => {
  const payload = {
    type: 'OWNER_ACTION',
    bookingId,
    action,
    ownerId,
    timestamp: Date.now(),
  };
  return generateActionToken(payload);
};

module.exports = {
  generateActionToken,
  verifyActionToken,
  createOwnerActionToken,
};
