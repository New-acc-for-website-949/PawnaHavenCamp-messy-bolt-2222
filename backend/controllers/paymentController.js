const { query } = require('../db');
const { PaytmChecksum } = require('../utils/paytmChecksum');
const { WhatsAppService } = require('../utils/whatsappService');
const { createOwnerActionToken } = require('../utils/actionTokens');

function generatePaytmOrderId() {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return `PAYTM_${timestamp}_${random}`;
}

function parseFormData(body) {
  const params = {};
  const pairs = body.split('&');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value) {
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }

  return params;
}

const initiatePaytmPayment = async (req, res) => {
  try {
    const { booking_id, channel_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({ error: 'Booking ID is required' });
    }

    const result = await query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [booking_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];

    if (booking.payment_status === 'SUCCESS') {
      return res.status(400).json({ error: 'Payment already completed for this booking' });
    }

    const paytmOrderId = generatePaytmOrderId();
    const channelId = channel_id || process.env.PAYTM_CHANNEL_ID || 'WEB';

    const mid = process.env.PAYTM_MID || 'SpwYpD36833569776448';
    const website = process.env.PAYTM_WEBSITE || 'WEBSTAGING';
    const industryType = process.env.PAYTM_INDUSTRY_TYPE || 'Retail';
    const merchantKey = process.env.PAYTM_MERCHANT_KEY || 'j@D7fI3pAMAl7nQC';
    const host = req.get('x-forwarded-host') || req.get('host');
    // Force HTTPS for replit.dev domains as Paytm requires secure callbacks
    const protocol = host.includes('replit.dev') ? 'https' : 'http';
    const callbackUrl = `https://${host}/api/payments/paytm/callback`;
    const gatewayUrl = process.env.PAYTM_GATEWAY_URL || 'https://securegw-stage.paytm.in/order/process';
    
    // Completely open security headers for the payment initiation response
    res.setHeader('Content-Security-Policy', "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; img-src * data: blob:; frame-ancestors *; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *;");
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (!mid || !website || !industryType || !merchantKey) {
      console.error('Missing Paytm configuration');
      return res.status(500).json({ error: 'Payment gateway not configured' });
    }

    const paytmParams = {
      MID: String(mid),
      WEBSITE: String(website),
      INDUSTRY_TYPE_ID: String(industryType),
      CHANNEL_ID: String(channelId),
      ORDER_ID: String(paytmOrderId),
      CUST_ID: String(booking.guest_phone || 'GUEST'),
      MOBILE_NO: String(booking.guest_phone || '0000000000'),
      EMAIL: String(`${booking.guest_phone || 'guest'}@guest.com`),
      TXN_AMOUNT: String(parseFloat(booking.advance_amount).toFixed(2)),
      CALLBACK_URL: String(callbackUrl),
    };

    const checksum = await PaytmChecksum.generateChecksum(paytmParams, merchantKey);

    console.log('Payment Parameters:', {
      mid,
      website,
      industryType,
      orderId: paytmOrderId,
      amount: booking.advance_amount,
      gatewayUrl,
    });

    await query(
      'UPDATE bookings SET order_id = $1 WHERE booking_id = $2',
      [paytmOrderId, booking_id]
    );

    return res.status(200).json({
      success: true,
      paytm_params: {
        ...paytmParams,
        CHECKSUMHASH: checksum,
      },
      gateway_url: gatewayUrl,
      order_id: paytmOrderId,
      booking_id: booking_id,
      amount: booking.advance_amount,
    });
  } catch (error) {
    console.error('Error initiating payment:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

const paytmCallback = async (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    let paytmResponse;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      paytmResponse = req.body;
    } else if (contentType.includes('application/json')) {
      paytmResponse = req.body;
    } else {
      return res.status(400).json({ error: 'Unsupported content type' });
    }

    console.log('Paytm callback received:', paytmResponse);

    const checksumHash = paytmResponse.CHECKSUMHASH;
    if (!checksumHash) {
      return res.status(400).json({ error: 'Checksum not found in response' });
    }

    const merchantKey = process.env.PAYTM_MERCHANT_KEY || 'j@D7fI3pAMAl7nQC';
    const isValidChecksum = await PaytmChecksum.verifyChecksumByObject(
      paytmResponse,
      merchantKey,
      checksumHash
    );

    if (!isValidChecksum) {
      console.error('Invalid checksum received from Paytm');
    }

    const orderId = paytmResponse.ORDERID;
    const txnId = paytmResponse.TXNID || '';
    const txnAmount = paytmResponse.TXNAMOUNT || '';
    const status = paytmResponse.STATUS || '';
    const respMsg = paytmResponse.RESPMSG || '';

    const result = await query(
      'SELECT * FROM bookings WHERE order_id = $1',
      [orderId]
    );

    if (result.rows.length === 0) {
      console.error('Booking not found for order_id:', orderId);
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = result.rows[0];

    let updatePaymentStatus = 'FAILED';
    let updateBookingStatus = booking.booking_status;

    if (status === 'TXN_SUCCESS') {
      updatePaymentStatus = 'SUCCESS';
      updateBookingStatus = 'PAYMENT_SUCCESS';
    } else if (status === 'PENDING') {
      updatePaymentStatus = 'PENDING';
    }

    await query(
      'UPDATE bookings SET payment_status = $1, booking_status = $2, transaction_id = $3 WHERE booking_id = $4',
      [updatePaymentStatus, updateBookingStatus, txnId, booking.booking_id]
    );

    console.log('Booking updated successfully:', {
      booking_id: booking.booking_id,
      order_id: orderId,
      payment_status: updatePaymentStatus,
      booking_status: updateBookingStatus,
    });

    if (status === 'TXN_SUCCESS') {
      const whatsapp = new WhatsAppService();

      const checkinDate = new Date(booking.checkin_datetime).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
      const checkoutDate = new Date(booking.checkout_datetime).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      const dueAmount = (booking.total_amount || 0) - booking.advance_amount;
      const persons = booking.persons || ((booking.veg_guest_count || 0) + (booking.nonveg_guest_count || 0));

      let customerMessage = `✅ *Payment Successful*\n\n`;
      customerMessage += `Booking ID: ${booking.booking_id}\n`;
      customerMessage += `Property: ${booking.property_name}\n`;
      customerMessage += `Check-in: ${checkinDate}\n`;
      customerMessage += `Check-out: ${checkoutDate}\n`;
      customerMessage += `Persons: ${persons}\n`;
      customerMessage += `Advance Paid: ₹${booking.advance_amount}\n\n`;

      if (booking.referral_code && booking.customer_discount > 0) {
        customerMessage += `💰 Referral Discount Applied: ₹${booking.customer_discount}\n`;
        customerMessage += `Referral Code: ${booking.referral_code}\n\n`;
      }

      customerMessage += `⏳ Your booking request has been received.\n`;
      customerMessage += `It is being verified with the owner.\n`;
      customerMessage += `Your e-ticket will be shared within 1 hour.`;

      await whatsapp.sendTextMessage(booking.guest_phone, customerMessage);

      let adminMessage = `📋 *New Booking Alert*\n\n`;
      adminMessage += `Booking ID: ${booking.booking_id}\n`;
      adminMessage += `Property: ${booking.property_name}\n`;
      adminMessage += `Guest: ${booking.guest_name}\n`;
      adminMessage += `Phone: ${booking.guest_phone}\n`;
      adminMessage += `Owner: ${booking.owner_phone}\n`;
      adminMessage += `Check-in: ${checkinDate}\n`;
      adminMessage += `Check-out: ${checkoutDate}\n`;
      adminMessage += `Persons: ${persons}\n`;
      adminMessage += `Advance Paid: ₹${booking.advance_amount}\n`;
      adminMessage += `Due Amount: ₹${dueAmount}\n\n`;

      if (booking.referral_code) {
        adminMessage += `🎁 *Referral Applied*\n`;
        adminMessage += `Code: ${booking.referral_code}\n`;
        adminMessage += `Type: ${booking.referral_type}\n`;
        adminMessage += `Admin Commission: ₹${booking.admin_commission}\n`;
        adminMessage += `Referrer Commission: ₹${booking.referrer_commission}\n`;
        adminMessage += `Customer Discount: ₹${booking.customer_discount}\n`;
        adminMessage += `Commission Status: ${booking.commission_status}\n\n`;
      }

      adminMessage += `Status: ⏳ Waiting for owner confirmation`;

      await whatsapp.sendTextMessage(booking.admin_phone, adminMessage);

      const confirmToken = createOwnerActionToken(booking.booking_id, 'CONFIRM', booking.owner_phone);
      const cancelToken = createOwnerActionToken(booking.booking_id, 'CANCEL', booking.owner_phone);

      let ownerMessage = `🔔 *New Booking Request*\n\n`;
      ownerMessage += `Booking ID: ${booking.booking_id}\n`;
      ownerMessage += `Property: ${booking.property_name}\n`;
      ownerMessage += `Guest: ${booking.guest_name}\n`;
      ownerMessage += `Phone: ${booking.guest_phone}\n`;
      ownerMessage += `Check-in: ${checkinDate}\n`;
      ownerMessage += `Check-out: ${checkoutDate}\n`;
      ownerMessage += `Persons: ${persons}\n\n`;
      ownerMessage += `💰 *Payment Details*\n`;
      ownerMessage += `Advance Paid: ₹${booking.advance_amount}\n`;
      ownerMessage += `Due Amount: ₹${dueAmount}\n\n`;
      ownerMessage += `⚡ Please confirm or cancel this booking:`;

      await whatsapp.sendInteractiveButtons(
        booking.owner_phone,
        ownerMessage,
        [
          {
            id: confirmToken,
            title: '✅ Confirm',
          },
          {
            id: cancelToken,
            title: '❌ Cancel',
          },
        ]
      );

      await query(
        "UPDATE bookings SET booking_status = 'BOOKING_REQUEST_SENT_TO_OWNER' WHERE booking_id = $1",
        [booking.booking_id]
      );

      console.log('WhatsApp notifications sent for booking:', booking.booking_id);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5000';
    const redirectUrl = status === 'TXN_SUCCESS'
      ? `${frontendUrl}/ticket?booking_id=${booking.booking_id}`
      : `${frontendUrl}`;

    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment ${status === 'TXN_SUCCESS' ? 'Success' : 'Failed'}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 500px;
          }
          .success { color: #10b981; }
          .failed { color: #ef4444; }
          .icon { font-size: 4rem; margin-bottom: 1rem; }
          h1 { margin: 0 0 1rem 0; }
          p { color: #666; margin: 0.5rem 0; }
          .details {
            background: #f9fafb;
            padding: 1rem;
            border-radius: 5px;
            margin: 1rem 0;
            text-align: left;
          }
          .details p { margin: 0.5rem 0; font-size: 0.9rem; }
          .btn {
            display: inline-block;
            margin-top: 1.5rem;
            padding: 0.75rem 2rem;
            background: #667eea;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            transition: background 0.3s;
          }
          .btn:hover { background: #5568d3; }
        </style>
      </head>
      <body>
        <div class="container">
          ${status === 'TXN_SUCCESS' ? `
            <div class="icon success">✓</div>
            <h1 class="success">Payment Successful!</h1>
            <p>Your booking has been confirmed.</p>
          ` : `
            <div class="icon failed">✗</div>
            <h1 class="failed">Payment Failed</h1>
            <p>${respMsg}</p>
          `}
          <div class="details">
            <p><strong>Booking ID:</strong> ${booking.booking_id}</p>
            <p><strong>Order ID:</strong> ${orderId}</p>
            ${txnId ? `<p><strong>Transaction ID:</strong> ${txnId}</p>` : ''}
            <p><strong>Amount:</strong> ₹${txnAmount}</p>
            <p><strong>Status:</strong> ${status}</p>
          </div>
          <a href="${redirectUrl}" class="btn">Continue</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error in Paytm callback:', error);
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
};

module.exports = {
  initiatePaytmPayment,
  paytmCallback,
};
