const bcrypt = require('bcrypt');
const { query } = require('../db');
const { generateToken } = require('../utils/jwt');

// Admin login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Check if admin exists
    const result = await query(
      'SELECT id, email, password_hash FROM admins WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const admin = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: admin.id,
      email: admin.email,
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again.',
    });
  }
};

// Admin logout (client-side token removal)
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logout successful.',
  });
};

// Verify token
const verifyAuth = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Token is valid.',
    data: {
      admin: req.admin,
    },
  });
};

module.exports = {
  login,
  logout,
  verifyAuth,
};
