const ReferralService = require('../services/referralService');

const ReferralController = {
  async getTopEarners(req, res) {
    try {
      const { period } = req.query;
      const earners = await ReferralService.getTopEarners(period);
      res.json(earners);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getStats(req, res) {
    try {
      const stats = await ReferralService.getUserStats(req.user.id);
      res.json(stats);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getTransactions(req, res) {
    try {
      const transactions = await ReferralService.getUserTransactions(req.user.id);
      res.json(transactions);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async getShareInfo(req, res) {
    try {
      const shareInfo = await ReferralService.getShareInfo(req.user.id);
      res.json(shareInfo);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async validateCode(req, res) {
    try {
      const { code, guestPhone } = req.body;

      if (!code) {
        return res.status(400).json({ valid: false, error: 'Referral code is required' });
      }

      const validation = await ReferralService.validateReferralCode(code, guestPhone || null);

      if (!validation.valid) {
        return res.status(200).json(validation);
      }

      return res.status(200).json({
        valid: true,
        referralCode: validation.referralCode,
        referralType: validation.referralType,
        username: validation.username,
        discountPercentage: validation.discountPercentage,
        message: validation.referralType === 'STANDARD'
          ? `Valid code! You'll get 5% discount`
          : `Valid code! Applied by ${validation.username}`,
      });
    } catch (error) {
      console.error('Error validating referral code:', error);
      res.status(500).json({ valid: false, error: 'Failed to validate referral code' });
    }
  }
};

module.exports = ReferralController;