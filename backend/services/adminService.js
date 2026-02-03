const ReferralRepository = require('../repositories/referralRepository');
const { query } = require('../db');

const AdminService = {
  async getAllReferralUsers() {
    const text = `
      SELECT 
        u.id, 
        u.username, 
        u.mobile_number, 
        u.referral_code, 
        u.status, 
        u.created_at,
        COALESCE(SUM(CASE WHEN t.type = 'earning' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN t.type = 'withdrawal' AND t.status = 'completed' THEN t.amount ELSE 0 END), 0) as balance,
        (SELECT COUNT(*) FROM referral_transactions WHERE referral_user_id = u.id AND type = 'earning' AND source = 'booking') as total_referrals
      FROM referral_users u
      LEFT JOIN referral_transactions t ON u.id = t.referral_user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
    const res = await query(text);
    return res.rows;
  },

  async updateReferralStatus(userId, status) {
    const text = 'UPDATE referral_users SET status = $1 WHERE id = $2 RETURNING *';
    const res = await query(text, [status, userId]);
    return res.rows[0];
  }
};

module.exports = AdminService;