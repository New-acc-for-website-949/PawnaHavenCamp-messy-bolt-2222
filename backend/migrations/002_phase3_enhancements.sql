-- Phase 3 Enhancements: Ticket Generation, Refunds & Monitoring

-- Add ticket and QR code fields to bookings
ALTER TABLE bookings
ADD COLUMN IF NOT EXISTS qr_code TEXT,
ADD COLUMN IF NOT EXISTS ticket_generated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_reason TEXT,
ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS refund_processed_by VARCHAR(100),
ADD COLUMN IF NOT EXISTS refund_processed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS refund_completed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS alerted_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_alerted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS notified_customer BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notified_owner BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notified_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_attempts_at TIMESTAMP;

-- Create notification logs table for tracking all notification attempts
CREATE TABLE IF NOT EXISTS notification_logs (
  id SERIAL PRIMARY KEY,
  booking_id VARCHAR(100) NOT NULL,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('customer', 'owner', 'admin')),
  phone_number VARCHAR(20) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_payment_monitoring
  ON bookings(payment_status, booking_status, created_at)
  WHERE payment_status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_bookings_refund_status
  ON bookings(booking_status)
  WHERE booking_status IN ('REFUND_REQUIRED', 'REFUND_INITIATED', 'REFUND_COMPLETED');

CREATE INDEX IF NOT EXISTS idx_bookings_commission_status
  ON bookings(commission_status)
  WHERE commission_status IN ('PENDING', 'CONFIRMED', 'CANCELLED');

CREATE INDEX IF NOT EXISTS idx_notification_logs_booking
  ON notification_logs(booking_id, created_at DESC);

-- Add comments for documentation
COMMENT ON COLUMN bookings.qr_code IS 'Base64 encoded QR code data URL for the e-ticket';
COMMENT ON COLUMN bookings.ticket_generated_at IS 'Timestamp when the e-ticket was generated';
COMMENT ON COLUMN bookings.refund_reason IS 'Reason for refund request';
COMMENT ON COLUMN bookings.refund_id IS 'Payment gateway refund reference ID';
COMMENT ON COLUMN bookings.alerted_admin IS 'Whether admin has been alerted about this pending payment';
COMMENT ON COLUMN bookings.notified_customer IS 'Whether customer notification was sent successfully';
COMMENT ON COLUMN bookings.notified_owner IS 'Whether owner notification was sent successfully';
COMMENT ON COLUMN bookings.notified_admin IS 'Whether admin notification was sent successfully';

COMMENT ON TABLE notification_logs IS 'Logs all WhatsApp notification attempts with retry tracking';

-- Update existing bookings to have notification flags as NULL initially
-- This allows us to distinguish between old bookings and new ones
UPDATE bookings
SET notified_customer = NULL,
    notified_owner = NULL,
    notified_admin = NULL
WHERE created_at < CURRENT_TIMESTAMP;
