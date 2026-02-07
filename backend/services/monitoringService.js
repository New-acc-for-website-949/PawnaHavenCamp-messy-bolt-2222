const { query } = require('../db');
const { WhatsAppService } = require('../utils/whatsappService');

const PAYMENT_TIMEOUT_MINUTES = 15;

const checkPendingPayments = async () => {
  try {
    const timeoutThreshold = new Date(Date.now() - PAYMENT_TIMEOUT_MINUTES * 60 * 1000);

    const result = await query(
      `SELECT booking_id, property_name, guest_name, guest_phone,
              advance_amount, created_at, booking_status, payment_status
       FROM bookings
       WHERE payment_status = 'PENDING'
         AND booking_status = 'PAYMENT_PENDING'
         AND created_at < $1
         AND alerted_admin IS NOT TRUE
       ORDER BY created_at ASC`,
      [timeoutThreshold]
    );

    if (result.rows.length === 0) {
      return {
        success: true,
        message: 'No pending payments to alert',
        count: 0,
      };
    }

    const whatsapp = new WhatsAppService();
    const adminPhone = process.env.ADMIN_PHONE || process.env.ADMIN_WHATSAPP_NUMBER;

    for (const booking of result.rows) {
      const minutesPending = Math.floor((Date.now() - new Date(booking.created_at).getTime()) / 60000);

      let alertMsg = `⚠️ *Payment Pending Alert*\n\n`;
      alertMsg += `Booking ID: ${booking.booking_id}\n`;
      alertMsg += `Property: ${booking.property_name}\n`;
      alertMsg += `Guest: ${booking.guest_name}\n`;
      alertMsg += `Phone: ${booking.guest_phone}\n`;
      alertMsg += `Amount: ₹${booking.advance_amount}\n`;
      alertMsg += `Pending Since: ${minutesPending} minutes\n\n`;
      alertMsg += `⚠️ *Action Required*\n`;
      alertMsg += `This payment has been pending for over ${PAYMENT_TIMEOUT_MINUTES} minutes.\n`;
      alertMsg += `Please investigate and contact the customer if needed.`;

      try {
        await whatsapp.sendTextMessage(adminPhone, alertMsg);

        await query(
          `UPDATE bookings
           SET alerted_admin = TRUE,
               admin_alerted_at = CURRENT_TIMESTAMP
           WHERE booking_id = $1`,
          [booking.booking_id]
        );

        console.log(`Admin alerted for pending payment: ${booking.booking_id}`);
      } catch (error) {
        console.error(`Failed to send alert for booking ${booking.booking_id}:`, error);
      }
    }

    return {
      success: true,
      message: `Alerted admin about ${result.rows.length} pending payments`,
      count: result.rows.length,
      bookings: result.rows.map(b => b.booking_id),
    };
  } catch (error) {
    console.error('Error checking pending payments:', error);
    throw error;
  }
};

const getStuckBookings = async () => {
  try {
    const result = await query(
      `SELECT booking_id, property_name, guest_name, guest_phone,
              advance_amount, booking_status, payment_status, created_at,
              alerted_admin, admin_alerted_at
       FROM bookings
       WHERE payment_status = 'PENDING'
         AND booking_status = 'PAYMENT_PENDING'
       ORDER BY created_at DESC`
    );

    return {
      success: true,
      stuck_bookings: result.rows,
      count: result.rows.length,
    };
  } catch (error) {
    console.error('Error fetching stuck bookings:', error);
    throw error;
  }
};

const checkFailedNotifications = async () => {
  try {
    const result = await query(
      `SELECT booking_id, property_name, guest_name, guest_phone,
              booking_status, payment_status, created_at
       FROM bookings
       WHERE booking_status = 'PAYMENT_SUCCESS'
         AND payment_status = 'SUCCESS'
         AND (
           notified_customer IS NOT TRUE
           OR notified_owner IS NOT TRUE
           OR notified_admin IS NOT TRUE
         )
       ORDER BY created_at DESC
       LIMIT 50`
    );

    return {
      success: true,
      failed_notifications: result.rows,
      count: result.rows.length,
    };
  } catch (error) {
    console.error('Error checking failed notifications:', error);
    throw error;
  }
};

const startMonitoring = (intervalMinutes = 5) => {
  console.log(`Starting payment monitoring service (checking every ${intervalMinutes} minutes)...`);

  setInterval(async () => {
    try {
      const result = await checkPendingPayments();
      if (result.count > 0) {
        console.log(`Payment monitoring: Alerted about ${result.count} pending payments`);
      }
    } catch (error) {
      console.error('Payment monitoring error:', error);
    }
  }, intervalMinutes * 60 * 1000);

  checkPendingPayments().catch(error => {
    console.error('Initial payment check failed:', error);
  });
};

module.exports = {
  checkPendingPayments,
  getStuckBookings,
  checkFailedNotifications,
  startMonitoring,
  PAYMENT_TIMEOUT_MINUTES,
};
