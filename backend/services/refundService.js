const { query } = require('../db');
const { WhatsAppService } = require('../utils/whatsappService');

const initiateRefundRequest = async (bookingId, reason = 'Owner cancelled booking') => {
  try {
    const bookingResult = await query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = bookingResult.rows[0];

    if (booking.booking_status !== 'OWNER_CANCELLED') {
      throw new Error('Refund can only be initiated for cancelled bookings');
    }

    await query(
      `UPDATE bookings
       SET booking_status = 'REFUND_REQUIRED',
           refund_reason = $1,
           refund_requested_at = CURRENT_TIMESTAMP
       WHERE booking_id = $2`,
      [reason, bookingId]
    );

    return {
      success: true,
      message: 'Refund request created',
      booking_id: bookingId,
      refund_amount: booking.advance_amount,
    };
  } catch (error) {
    console.error('Error initiating refund request:', error);
    throw error;
  }
};

const processRefund = async (bookingId, refundId, processedBy) => {
  try {
    const bookingResult = await query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = bookingResult.rows[0];

    if (booking.booking_status !== 'REFUND_REQUIRED') {
      throw new Error('Booking is not in refund required state');
    }

    await query(
      `UPDATE bookings
       SET booking_status = 'REFUND_INITIATED',
           refund_id = $1,
           refund_processed_by = $2,
           refund_processed_at = CURRENT_TIMESTAMP
       WHERE booking_id = $3`,
      [refundId, processedBy, bookingId]
    );

    const whatsapp = new WhatsAppService();

    const customerRefundMsg = `💰 *Refund Initiated*\n\n`;
    customerRefundMsg += `Booking ID: ${booking.booking_id}\n`;
    customerRefundMsg += `Refund Amount: ₹${booking.advance_amount}\n`;
    customerRefundMsg += `Refund Reference: ${refundId}\n\n`;
    customerRefundMsg += `Your refund has been processed and will be credited to your payment source within 5-7 business days.\n\n`;
    customerRefundMsg += `For any queries, please contact support.`;

    await whatsapp.sendTextMessage(booking.guest_phone, customerRefundMsg);

    const adminConfirmMsg = `✅ *Refund Processed*\n\n`;
    adminConfirmMsg += `Booking ID: ${booking.booking_id}\n`;
    adminConfirmMsg += `Refund ID: ${refundId}\n`;
    adminConfirmMsg += `Amount: ₹${booking.advance_amount}\n`;
    adminConfirmMsg += `Processed by: ${processedBy}\n`;
    adminConfirmMsg += `Customer notified via WhatsApp.`;

    await whatsapp.sendTextMessage(booking.admin_phone, adminConfirmMsg);

    return {
      success: true,
      message: 'Refund processed successfully',
      booking_id: bookingId,
      refund_id: refundId,
    };
  } catch (error) {
    console.error('Error processing refund:', error);
    throw error;
  }
};

const completeRefund = async (bookingId) => {
  try {
    await query(
      `UPDATE bookings
       SET booking_status = 'REFUND_COMPLETED',
           refund_completed_at = CURRENT_TIMESTAMP
       WHERE booking_id = $1`,
      [bookingId]
    );

    return {
      success: true,
      message: 'Refund marked as completed',
      booking_id: bookingId,
    };
  } catch (error) {
    console.error('Error completing refund:', error);
    throw error;
  }
};

const getPendingRefunds = async () => {
  try {
    const result = await query(
      `SELECT booking_id, property_name, guest_name, guest_phone,
              advance_amount, refund_reason, refund_requested_at, booking_status
       FROM bookings
       WHERE booking_status IN ('REFUND_REQUIRED', 'REFUND_INITIATED')
       ORDER BY refund_requested_at DESC`
    );

    return {
      success: true,
      refunds: result.rows,
    };
  } catch (error) {
    console.error('Error fetching pending refunds:', error);
    throw error;
  }
};

const getRefundHistory = async (limit = 50) => {
  try {
    const result = await query(
      `SELECT booking_id, property_name, guest_name, guest_phone,
              advance_amount, refund_reason, refund_id, refund_processed_by,
              refund_requested_at, refund_processed_at, refund_completed_at, booking_status
       FROM bookings
       WHERE booking_status IN ('REFUND_REQUIRED', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'OWNER_CANCELLED')
       ORDER BY refund_requested_at DESC
       LIMIT $1`,
      [limit]
    );

    return {
      success: true,
      history: result.rows,
    };
  } catch (error) {
    console.error('Error fetching refund history:', error);
    throw error;
  }
};

module.exports = {
  initiateRefundRequest,
  processRefund,
  completeRefund,
  getPendingRefunds,
  getRefundHistory,
};
