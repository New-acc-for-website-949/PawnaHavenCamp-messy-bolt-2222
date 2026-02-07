const express = require('express');
const router = express.Router();
const commissionController = require('../controllers/commissionController');

router.get('/summary', commissionController.getCommissionSummary);
router.get('/by-status', commissionController.getCommissionsByStatus);
router.get('/referrer/:referral_user_id', commissionController.getReferrerCommissions);
router.get('/payable', commissionController.getPayableCommissions);
router.get('/report', commissionController.getCommissionReport);

module.exports = router;
