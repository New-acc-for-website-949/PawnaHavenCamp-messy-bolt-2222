const { query } = require('../db');

const getCommissionSummary = async () => {
  try {
    const summaryResult = await query(`
      SELECT
        COUNT(*) as total_bookings,
        COUNT(*) FILTER (WHERE commission_status = 'PENDING') as pending_count,
        COUNT(*) FILTER (WHERE commission_status = 'CONFIRMED') as confirmed_count,
        COUNT(*) FILTER (WHERE commission_status = 'CANCELLED') as cancelled_count,
        SUM(admin_commission) FILTER (WHERE commission_status = 'CONFIRMED') as total_admin_commission,
        SUM(referrer_commission) FILTER (WHERE commission_status = 'CONFIRMED') as total_referrer_commission,
        SUM(customer_discount) FILTER (WHERE referral_type IN ('STANDARD')) as total_customer_discounts,
        SUM(admin_commission) FILTER (WHERE commission_status = 'PENDING') as pending_admin_commission,
        SUM(referrer_commission) FILTER (WHERE commission_status = 'PENDING') as pending_referrer_commission
      FROM bookings
      WHERE referral_code IS NOT NULL
    `);

    const summary = summaryResult.rows[0];

    return {
      success: true,
      summary: {
        total_bookings: parseInt(summary.total_bookings) || 0,
        pending_count: parseInt(summary.pending_count) || 0,
        confirmed_count: parseInt(summary.confirmed_count) || 0,
        cancelled_count: parseInt(summary.cancelled_count) || 0,
        total_admin_commission: parseFloat(summary.total_admin_commission) || 0,
        total_referrer_commission: parseFloat(summary.total_referrer_commission) || 0,
        total_customer_discounts: parseFloat(summary.total_customer_discounts) || 0,
        pending_admin_commission: parseFloat(summary.pending_admin_commission) || 0,
        pending_referrer_commission: parseFloat(summary.pending_referrer_commission) || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching commission summary:', error);
    throw error;
  }
};

const getCommissionsByStatus = async (status = 'CONFIRMED') => {
  try {
    const result = await query(
      `SELECT
        booking_id, property_name, guest_name, guest_phone,
        referral_code, referral_type, commission_status,
        admin_commission, referrer_commission, customer_discount,
        advance_amount, total_amount, booking_status,
        created_at, confirmed_at, payment_id
       FROM bookings
       WHERE commission_status = $1 AND referral_code IS NOT NULL
       ORDER BY created_at DESC`,
      [status]
    );

    return {
      success: true,
      commissions: result.rows,
      count: result.rows.length,
    };
  } catch (error) {
    console.error('Error fetching commissions by status:', error);
    throw error;
  }
};

const getReferrerCommissions = async (referralUserId) => {
  try {
    const result = await query(
      `SELECT
        b.booking_id, b.property_name, b.guest_name,
        b.referral_code, b.referral_type, b.commission_status,
        b.referrer_commission, b.advance_amount,
        b.booking_status, b.created_at, b.confirmed_at
       FROM bookings b
       WHERE b.referral_user_id = $1 AND b.referral_code IS NOT NULL
       ORDER BY b.created_at DESC`,
      [referralUserId]
    );

    const summary = await query(
      `SELECT
        COUNT(*) as total_referrals,
        SUM(referrer_commission) FILTER (WHERE commission_status = 'CONFIRMED') as total_earned,
        SUM(referrer_commission) FILTER (WHERE commission_status = 'PENDING') as pending_earnings,
        SUM(referrer_commission) FILTER (WHERE commission_status = 'CANCELLED') as cancelled_earnings
       FROM bookings
       WHERE referral_user_id = $1`,
      [referralUserId]
    );

    return {
      success: true,
      referrals: result.rows,
      summary: {
        total_referrals: parseInt(summary.rows[0].total_referrals) || 0,
        total_earned: parseFloat(summary.rows[0].total_earned) || 0,
        pending_earnings: parseFloat(summary.rows[0].pending_earnings) || 0,
        cancelled_earnings: parseFloat(summary.rows[0].cancelled_earnings) || 0,
      },
    };
  } catch (error) {
    console.error('Error fetching referrer commissions:', error);
    throw error;
  }
};

const getPayableCommissions = async () => {
  try {
    const result = await query(
      `SELECT
        ru.id as referral_user_id,
        ru.username,
        ru.mobile_number,
        ru.referral_code,
        ru.balance as current_balance,
        COUNT(b.id) as confirmed_bookings,
        SUM(b.referrer_commission) as total_payable
       FROM referral_users ru
       LEFT JOIN bookings b ON b.referral_user_id = ru.id
         AND b.commission_status = 'CONFIRMED'
       WHERE ru.status = 'active'
       GROUP BY ru.id, ru.username, ru.mobile_number, ru.referral_code, ru.balance
       HAVING COUNT(b.id) > 0
       ORDER BY total_payable DESC`
    );

    return {
      success: true,
      payable_commissions: result.rows,
      total_payable: result.rows.reduce((sum, row) => sum + parseFloat(row.total_payable || 0), 0),
    };
  } catch (error) {
    console.error('Error fetching payable commissions:', error);
    throw error;
  }
};

const getCommissionReport = async (startDate, endDate) => {
  try {
    const dateFilter = startDate && endDate
      ? `AND created_at BETWEEN $1 AND $2`
      : '';
    const params = startDate && endDate ? [startDate, endDate] : [];

    const result = await query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as bookings,
        COUNT(*) FILTER (WHERE commission_status = 'CONFIRMED') as confirmed,
        SUM(admin_commission) as admin_commission,
        SUM(referrer_commission) as referrer_commission,
        SUM(customer_discount) as customer_discount
       FROM bookings
       WHERE referral_code IS NOT NULL ${dateFilter}
       GROUP BY DATE(created_at)
       ORDER BY date DESC`,
      params
    );

    return {
      success: true,
      report: result.rows,
    };
  } catch (error) {
    console.error('Error generating commission report:', error);
    throw error;
  }
};

module.exports = {
  getCommissionSummary,
  getCommissionsByStatus,
  getReferrerCommissions,
  getPayableCommissions,
  getCommissionReport,
};
