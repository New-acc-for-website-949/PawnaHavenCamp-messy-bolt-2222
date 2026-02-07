const QRCode = require('qrcode');
const { query } = require('../db');

const generateTicketQRCode = async (bookingId) => {
  try {
    const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/ticket?booking_id=${bookingId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(ticketUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return qrCodeDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
};

const generateTicketForBooking = async (bookingId) => {
  try {
    const bookingResult = await query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [bookingId]
    );

    if (bookingResult.rows.length === 0) {
      throw new Error('Booking not found');
    }

    const booking = bookingResult.rows[0];

    if (booking.booking_status !== 'OWNER_CONFIRMED') {
      throw new Error('Booking must be confirmed by owner before generating ticket');
    }

    const qrCode = await generateTicketQRCode(bookingId);

    await query(
      `UPDATE bookings
       SET booking_status = 'TICKET_GENERATED',
           qr_code = $1,
           ticket_generated_at = CURRENT_TIMESTAMP
       WHERE booking_id = $2`,
      [qrCode, bookingId]
    );

    const ticketUrl = `${process.env.FRONTEND_URL || 'http://localhost:5000'}/ticket?booking_id=${bookingId}`;

    return {
      success: true,
      ticketUrl,
      qrCode,
      booking: {
        booking_id: booking.booking_id,
        guest_name: booking.guest_name,
        guest_phone: booking.guest_phone,
        property_name: booking.property_name,
        checkin_datetime: booking.checkin_datetime,
        checkout_datetime: booking.checkout_datetime,
        advance_amount: booking.advance_amount,
        total_amount: booking.total_amount,
      },
    };
  } catch (error) {
    console.error('Error generating ticket:', error);
    throw error;
  }
};

const getTicketByBookingId = async (bookingId) => {
  try {
    const result = await query(
      'SELECT * FROM bookings WHERE booking_id = $1',
      [bookingId]
    );

    if (result.rows.length === 0) {
      return { success: false, error: 'Booking not found' };
    }

    const booking = result.rows[0];

    if (booking.booking_status !== 'TICKET_GENERATED' && booking.booking_status !== 'OWNER_CONFIRMED') {
      return {
        success: false,
        error: 'Ticket not available',
        current_status: booking.booking_status,
      };
    }

    const dueAmount = (booking.total_amount || 0) - booking.advance_amount;

    const ticketData = {
      booking_id: booking.booking_id,
      property_name: booking.property_name,
      guest_name: booking.guest_name,
      guest_phone: booking.guest_phone,
      checkin_datetime: booking.checkin_datetime,
      checkout_datetime: booking.checkout_datetime,
      advance_amount: booking.advance_amount,
      due_amount: dueAmount,
      total_amount: booking.total_amount,
      owner_name: booking.owner_name,
      owner_phone: booking.owner_phone,
      map_link: booking.map_link,
      property_address: booking.property_address,
      persons: booking.persons,
      booking_status: booking.booking_status,
      qr_code: booking.qr_code,
      created_at: booking.created_at,
      confirmed_at: booking.confirmed_at,
      ticket_generated_at: booking.ticket_generated_at,
    };

    return { success: true, ticket: ticketData };
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return { success: false, error: 'Internal server error' };
  }
};

module.exports = {
  generateTicketQRCode,
  generateTicketForBooking,
  getTicketByBookingId,
};
