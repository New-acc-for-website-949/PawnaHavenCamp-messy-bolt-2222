const { query } = require('../db');
const { WhatsAppService } = require('../utils/whatsappService');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const sendWithRetry = async (phoneNumber, message, messageType = 'text', retryCount = 0) => {
  const whatsapp = new WhatsAppService();

  try {
    let success;
    if (messageType === 'text') {
      success = await whatsapp.sendTextMessage(phoneNumber, message);
    } else if (messageType === 'interactive' && message.buttons) {
      success = await whatsapp.sendInteractiveButtons(phoneNumber, message.bodyText, message.buttons);
    }

    if (success) {
      console.log(`Message sent successfully to ${phoneNumber} (attempt ${retryCount + 1})`);
      return { success: true, attempts: retryCount + 1 };
    }

    throw new Error('Message sending returned false');
  } catch (error) {
    console.error(`Failed to send message to ${phoneNumber} (attempt ${retryCount + 1}):`, error.message);

    if (retryCount < MAX_RETRIES - 1) {
      console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
      await sleep(RETRY_DELAY_MS);
      return sendWithRetry(phoneNumber, message, messageType, retryCount + 1);
    }

    console.error(`All ${MAX_RETRIES} attempts failed for ${phoneNumber}`);
    return {
      success: false,
      attempts: retryCount + 1,
      error: error.message,
    };
  }
};

const logNotificationAttempt = async (bookingId, recipientType, phoneNumber, success, attempts, error = null) => {
  try {
    await query(
      `INSERT INTO notification_logs
       (booking_id, recipient_type, phone_number, success, attempts, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
      [bookingId, recipientType, phoneNumber, success, attempts, error]
    );
  } catch (err) {
    console.error('Failed to log notification attempt:', err);
  }
};

const sendBookingNotifications = async (booking, notificationType = 'payment_success') => {
  const results = {
    customer: { success: false },
    owner: { success: false },
    admin: { success: false },
  };

  const customerMessage = generateCustomerMessage(booking, notificationType);
  const ownerMessage = generateOwnerMessage(booking, notificationType);
  const adminMessage = generateAdminMessage(booking, notificationType);

  if (booking.guest_phone) {
    results.customer = await sendWithRetry(booking.guest_phone, customerMessage, 'text');
    await logNotificationAttempt(
      booking.booking_id,
      'customer',
      booking.guest_phone,
      results.customer.success,
      results.customer.attempts,
      results.customer.error
    );
  }

  if (booking.owner_phone) {
    if (notificationType === 'payment_success' && ownerMessage.buttons) {
      results.owner = await sendWithRetry(booking.owner_phone, ownerMessage, 'interactive');
    } else {
      results.owner = await sendWithRetry(booking.owner_phone, ownerMessage, 'text');
    }
    await logNotificationAttempt(
      booking.booking_id,
      'owner',
      booking.owner_phone,
      results.owner.success,
      results.owner.attempts,
      results.owner.error
    );
  }

  if (booking.admin_phone) {
    results.admin = await sendWithRetry(booking.admin_phone, adminMessage, 'text');
    await logNotificationAttempt(
      booking.booking_id,
      'admin',
      booking.admin_phone,
      results.admin.success,
      results.admin.attempts,
      results.admin.error
    );
  }

  await query(
    `UPDATE bookings
     SET notified_customer = $1,
         notified_owner = $2,
         notified_admin = $3,
         notification_attempts_at = CURRENT_TIMESTAMP
     WHERE booking_id = $4`,
    [results.customer.success, results.owner.success, results.admin.success, booking.booking_id]
  );

  return results;
};

const generateCustomerMessage = (booking, notificationType) => {
  if (notificationType === 'payment_success') {
    let msg = `✅ *Payment Received!*\n\n`;
    msg += `Booking ID: ${booking.booking_id}\n`;
    msg += `Property: ${booking.property_name}\n`;
    msg += `Amount Paid: ₹${booking.advance_amount}\n\n`;
    if (booking.referral_code && booking.customer_discount > 0) {
      msg += `💰 Referral Discount Applied: ₹${booking.customer_discount}\n\n`;
    }
    msg += `Your booking request has been sent to the owner.\n`;
    msg += `You will receive confirmation within 1 hour.\n\n`;
    msg += `Thank you for choosing LoonCamp! 🏕️`;
    return msg;
  }
  return '';
};

const generateOwnerMessage = (booking, notificationType) => {
  if (notificationType === 'payment_success') {
    return {
      bodyText: `New booking request received with advance payment.`,
      buttons: null,
    };
  }
  return '';
};

const generateAdminMessage = (booking, notificationType) => {
  if (notificationType === 'payment_success') {
    let msg = `💰 *New Booking - Payment Success*\n\n`;
    msg += `Booking ID: ${booking.booking_id}\n`;
    msg += `Property: ${booking.property_name}\n`;
    msg += `Guest: ${booking.guest_name} (${booking.guest_phone})\n`;
    msg += `Amount: ₹${booking.advance_amount}\n`;
    if (booking.referral_code) {
      msg += `\n🎁 *Referral Details*\n`;
      msg += `Code: ${booking.referral_code}\n`;
      msg += `Type: ${booking.referral_type}\n`;
      msg += `Admin Commission: ₹${booking.admin_commission}\n`;
      msg += `Referrer Commission: ₹${booking.referrer_commission}\n`;
    }
    return msg;
  }
  return '';
};

module.exports = {
  sendWithRetry,
  logNotificationAttempt,
  sendBookingNotifications,
  MAX_RETRIES,
};
