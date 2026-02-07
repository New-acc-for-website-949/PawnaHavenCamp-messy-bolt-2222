const { query } = require('../db');
const { WhatsAppService } = require('../utils/whatsappService');
const { verifyActionToken } = require('../utils/actionTokens');
const { generateTicketForBooking } = require('../services/ticketService');
const { initiateRefundRequest } = require('../services/refundService');

const whatsappWebhookVerify = (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const whatsapp = new WhatsAppService();
    const verifiedChallenge = whatsapp.verifyWebhook(mode, token, challenge);

    if (verifiedChallenge) {
      return res.status(200).send(verifiedChallenge);
    }

    return res.status(403).send('Verification failed');
  } catch (error) {
    console.error('Error in webhook verification:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const whatsappWebhookReceive = async (req, res) => {
  try {
    console.log('WhatsApp webhook received:', JSON.stringify(req.body, null, 2));

    const whatsapp = new WhatsAppService();
    const buttonResponse = whatsapp.extractButtonResponse(req.body);

    if (!buttonResponse) {
      return res.status(200).json({ success: true, message: 'No action required' });
    }

    const { from, buttonId } = buttonResponse;

    const tokenPayload = verifyActionToken(buttonId);

    if (tokenPayload.error) {
      console.error('Token verification failed:', tokenPayload.error);
      await whatsapp.sendTextMessage(
        from,
        `❌ Action failed: ${tokenPayload.error}\n\nPlease contact support if you need to modify this booking.`
      );
      return res.status(200).json({ success: false, error: tokenPayload.error });
    }

    const { bookingId, action, ownerId } = tokenPayload;

    if (from.replace(/^\+/, '') !== ownerId.replace(/^\+/, '')) {
      console.error('Unauthorized action attempt:', { from, expected: ownerId });
      await whatsapp.sendTextMessage(
        from,
        `❌ Unauthorized action.\n\nThis action can only be performed by the property owner.`
      );
      return res.status(200).json({ success: false, error: 'Unauthorized' });
    }

    const bookingResult = await query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      await whatsapp.sendTextMessage(
        from,
        `❌ Booking not found.\n\nBooking ID: ${bookingId}`
      );
      return res.status(200).json({ success: false, error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    if (booking.booking_status !== 'BOOKING_REQUEST_SENT_TO_OWNER') {
      await whatsapp.sendTextMessage(
        from,
        `❌ Booking has already been processed.\n\nCurrent status: ${booking.booking_status}`
      );
      return res.status(200).json({ success: false, error: 'Already processed' });
    }

    if (action === 'CONFIRM') {
      await handleOwnerConfirmation(booking, whatsapp);
    } else if (action === 'CANCEL') {
      await handleOwnerCancellation(booking, whatsapp);
    } else {
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(200).json({ success: true, action, bookingId });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

const handleOwnerConfirmation = async (booking, whatsapp) => {
  try {
    await query(
      `UPDATE bookings
       SET booking_status = 'OWNER_CONFIRMED',
           confirmed_at = CURRENT_TIMESTAMP,
           commission_status = CASE
             WHEN commission_status = 'PENDING' THEN 'CONFIRMED'
             ELSE commission_status
           END
       WHERE booking_id = $1`,
      [booking.booking_id]
    );

    if (booking.referral_user_id && booking.referrer_commission > 0) {
      await query(
        `INSERT INTO referral_transactions
         (referral_user_id, booking_id, amount, type, status, commission_status)
         VALUES ($1, $2, $3, 'earning', 'completed', 'CONFIRMED')`,
        [booking.referral_user_id, booking.id, booking.referrer_commission]
      );

      await query(
        `UPDATE referral_users
         SET balance = balance + $1
         WHERE id = $2`,
        [booking.referrer_commission, booking.referral_user_id]
      );
    }

    const checkinDate = new Date(booking.checkin_datetime).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const checkoutDate = new Date(booking.checkout_datetime).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const persons = booking.persons || ((booking.veg_guest_count || 0) + (booking.nonveg_guest_count || 0));

    const ticketResult = await generateTicketForBooking(booking.booking_id);

    const ownerConfirmMsg = `✅ *Booking Confirmed Successfully*\n\n`;
    await whatsapp.sendTextMessage(booking.owner_phone, ownerConfirmMsg + `Booking ID: ${booking.booking_id}\nGuest: ${booking.guest_name}\n\nE-Ticket has been sent to the customer.`);

    let customerTicketMsg = `🎉 *Booking Confirmed!*\n\n`;
    customerTicketMsg += `🎫 *Your E-Ticket is Ready*\n\n`;
    customerTicketMsg += `Booking ID: ${booking.booking_id}\n`;
    customerTicketMsg += `Property: ${booking.property_name}\n`;
    customerTicketMsg += `Guest: ${booking.guest_name}\n`;
    customerTicketMsg += `Check-in: ${checkinDate}\n`;
    customerTicketMsg += `Check-out: ${checkoutDate}\n`;
    customerTicketMsg += `Persons: ${persons}\n`;
    customerTicketMsg += `Advance Paid: ₹${booking.advance_amount}\n\n`;
    customerTicketMsg += `📱 *View Your E-Ticket*\n`;
    customerTicketMsg += `${ticketResult.ticketUrl}\n\n`;
    customerTicketMsg += `💡 *Check-in Instructions*\n`;
    customerTicketMsg += `- Show this ticket at the property\n`;
    customerTicketMsg += `- Carry a valid ID proof\n`;
    customerTicketMsg += `- Contact owner if needed: ${booking.owner_phone}\n\n`;
    customerTicketMsg += `Have a wonderful stay! 🏡`;

    await whatsapp.sendTextMessage(booking.guest_phone, customerTicketMsg);

    let adminConfirmMsg = `✅ *Booking Confirmed by Owner*\n\n`;
    adminConfirmMsg += `Booking ID: ${booking.booking_id}\n`;
    adminConfirmMsg += `Property: ${booking.property_name}\n`;
    adminConfirmMsg += `Guest: ${booking.guest_name} (${booking.guest_phone})\n`;
    adminConfirmMsg += `Advance: ₹${booking.advance_amount}\n\n`;

    if (booking.referral_code) {
      adminConfirmMsg += `🎁 *Referral Commission Confirmed*\n`;
      adminConfirmMsg += `Code: ${booking.referral_code}\n`;
      adminConfirmMsg += `Referrer Commission: ₹${booking.referrer_commission} (CONFIRMED)\n`;
      adminConfirmMsg += `Admin Commission: ₹${booking.admin_commission}\n\n`;
    }

    adminConfirmMsg += `🎫 Ticket Link: ${ticketResult.ticketUrl}`;

    await whatsapp.sendTextMessage(booking.admin_phone, adminConfirmMsg);

    console.log('Owner confirmation processed successfully for booking:', booking.booking_id);
  } catch (error) {
    console.error('Error handling owner confirmation:', error);
    throw error;
  }
};

const handleOwnerCancellation = async (booking, whatsapp) => {
  try {
    await query(
      `UPDATE bookings
       SET booking_status = 'OWNER_CANCELLED',
           cancelled_at = CURRENT_TIMESTAMP,
           commission_status = CASE
             WHEN commission_status = 'PENDING' THEN 'CANCELLED'
             ELSE commission_status
           END
       WHERE booking_id = $1`,
      [booking.booking_id]
    );

    if (booking.referral_user_id && booking.commission_status === 'PENDING') {
      await query(
        `INSERT INTO referral_transactions
         (referral_user_id, booking_id, amount, type, status, commission_status)
         VALUES ($1, $2, $3, 'earning', 'failed', 'CANCELLED')`,
        [booking.referral_user_id, booking.id, booking.referrer_commission]
      );
    }

    await initiateRefundRequest(booking.booking_id, 'Owner cancelled booking due to unavailability');

    const ownerCancelMsg = `❌ *Booking Cancelled*\n\n`;
    await whatsapp.sendTextMessage(booking.owner_phone, ownerCancelMsg + `Booking ID: ${booking.booking_id}\nRefund request has been created for admin processing.`);

    let customerRefundMsg = `❌ *Booking Cancelled*\n\n`;
    customerRefundMsg += `Booking ID: ${booking.booking_id}\n`;
    customerRefundMsg += `Property: ${booking.property_name}\n\n`;
    customerRefundMsg += `Due to unavailability, your booking has been cancelled by the owner.\n\n`;
    customerRefundMsg += `💰 *Refund Information*\n`;
    customerRefundMsg += `Amount: ₹${booking.advance_amount}\n`;
    customerRefundMsg += `The refund will be credited to your payment source within 5-7 business days.\n\n`;
    customerRefundMsg += `For any queries, please contact support.`;

    await whatsapp.sendTextMessage(booking.guest_phone, customerRefundMsg);

    let adminRefundMsg = `❌ *Booking Cancelled by Owner*\n\n`;
    adminRefundMsg += `Booking ID: ${booking.booking_id}\n`;
    adminRefundMsg += `Property: ${booking.property_name}\n`;
    adminRefundMsg += `Guest: ${booking.guest_name} (${booking.guest_phone})\n`;
    adminRefundMsg += `Refund Amount: ₹${booking.advance_amount}\n\n`;

    if (booking.referral_code) {
      adminRefundMsg += `🎁 *Referral Commission Cancelled*\n`;
      adminRefundMsg += `Code: ${booking.referral_code}\n`;
      adminRefundMsg += `Referrer Commission: ₹${booking.referrer_commission} (CANCELLED)\n\n`;
    }

    adminRefundMsg += `⚠️ *Action Required*\n`;
    adminRefundMsg += `Please process the refund through Paytm merchant dashboard.`;

    await whatsapp.sendTextMessage(booking.admin_phone, adminRefundMsg);

    console.log('Owner cancellation processed successfully for booking:', booking.booking_id);
  } catch (error) {
    console.error('Error handling owner cancellation:', error);
    throw error;
  }
};

module.exports = {
  whatsappWebhookVerify,
  whatsappWebhookReceive,
  handleOwnerConfirmation,
  handleOwnerCancellation,
};
