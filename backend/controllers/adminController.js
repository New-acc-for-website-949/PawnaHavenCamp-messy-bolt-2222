const AdminService = require('../services/adminService');

const AdminController = {
  async getAllReferrals(req, res) {
    try {
      const referrals = await AdminService.getAllReferralUsers();
      res.json(referrals);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  async updateReferralStatus(req, res) {
    try {
      const { userId, status } = req.body;
      const updated = await AdminService.updateReferralStatus(userId, status);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
};

module.exports = AdminController;