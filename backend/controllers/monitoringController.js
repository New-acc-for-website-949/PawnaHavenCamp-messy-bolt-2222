const monitoringService = require('../services/monitoringService');

const checkPendingPayments = async (req, res) => {
  try {
    const result = await monitoringService.checkPendingPayments();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Check pending payments error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getStuckBookings = async (req, res) => {
  try {
    const result = await monitoringService.getStuckBookings();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get stuck bookings error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const checkFailedNotifications = async (req, res) => {
  try {
    const result = await monitoringService.checkFailedNotifications();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Check failed notifications error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  checkPendingPayments,
  getStuckBookings,
  checkFailedNotifications,
};
