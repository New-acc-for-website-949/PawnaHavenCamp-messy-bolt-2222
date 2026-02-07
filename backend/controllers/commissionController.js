const commissionService = require('../services/commissionService');

const getCommissionSummary = async (req, res) => {
  try {
    const result = await commissionService.getCommissionSummary();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get commission summary error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getCommissionsByStatus = async (req, res) => {
  try {
    const status = req.query.status || 'CONFIRMED';
    const result = await commissionService.getCommissionsByStatus(status);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get commissions by status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getReferrerCommissions = async (req, res) => {
  try {
    const { referral_user_id } = req.params;

    if (!referral_user_id) {
      return res.status(400).json({
        success: false,
        error: 'referral_user_id is required',
      });
    }

    const result = await commissionService.getReferrerCommissions(referral_user_id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get referrer commissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getPayableCommissions = async (req, res) => {
  try {
    const result = await commissionService.getPayableCommissions();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get payable commissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

const getCommissionReport = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const result = await commissionService.getCommissionReport(start_date, end_date);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Get commission report error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  getCommissionSummary,
  getCommissionsByStatus,
  getReferrerCommissions,
  getPayableCommissions,
  getCommissionReport,
};
