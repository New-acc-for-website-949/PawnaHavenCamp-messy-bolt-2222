const refundService = require('../services/refundService');

const initiateRefund = async (req, res) => {
  try {
    const { booking_id, reason } = req.body;

    if (!booking_id) {
      return res.status(400).json({
        success: false,
        error: 'booking_id is required',
      });
    }

    const result = await refundService.initiateRefundRequest(booking_id, reason);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Initiate refund error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const processRefund = async (req, res) => {
  try {
    const { booking_id, refund_id, processed_by } = req.body;

    if (!booking_id || !refund_id || !processed_by) {
      return res.status(400).json({
        success: false,
        error: 'booking_id, refund_id, and processed_by are required',
      });
    }

    const result = await refundService.processRefund(booking_id, refund_id, processed_by);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Process refund error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const completeRefund = async (req, res) => {
  try {
    const { booking_id } = req.body;

    if (!booking_id) {
      return res.status(400).json({
        success: false,
        error: 'booking_id is required',
      });
    }

    const result = await refundService.completeRefund(booking_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Complete refund error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getPendingRefunds = async (req, res) => {
  try {
    const result = await refundService.getPendingRefunds();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get pending refunds error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getRefundHistory = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const result = await refundService.getRefundHistory(limit);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get refund history error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  initiateRefund,
  processRefund,
  completeRefund,
  getPendingRefunds,
  getRefundHistory,
};
