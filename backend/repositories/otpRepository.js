const { query } = require('../db');

const OtpRepository = {
  async getOtpCount(mobile, purpose, since) {
    const text = `
      SELECT COUNT(*) 
      FROM otp_verifications 
      WHERE mobile_number = $1 AND purpose = $2 AND created_at >= $3
    `;
    const res = await query(text, [mobile, purpose, since]);
    return parseInt(res.rows[0].count);
  },

  async createOtp(mobile, otp, purpose, expiresAt) {
    const text = `
      INSERT INTO otp_verifications (mobile_number, otp_code, purpose, expires_at)
      VALUES ($1, $2, $3, $4)
    `;
    return query(text, [mobile, otp, purpose, expiresAt]);
  },

  async getLatestOtp(mobile, purpose) {
    const text = `
      SELECT * FROM otp_verifications 
      WHERE mobile_number = $1 AND purpose = $2 
      ORDER BY created_at DESC LIMIT 1
    `;
    const res = await query(text, [mobile, purpose]);
    return res.rows[0];
  },

  async incrementAttempts(id) {
    const text = 'UPDATE otp_verifications SET attempts = attempts + 1 WHERE id = $1';
    return query(text, [id]);
  },

  async deleteOtp(id) {
    const text = 'DELETE FROM otp_verifications WHERE id = $1';
    return query(text, [id]);
  }
};

module.exports = OtpRepository;