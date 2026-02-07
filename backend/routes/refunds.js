const express = require('express');
const router = express.Router();
const refundController = require('../controllers/refundController');

router.post('/initiate', refundController.initiateRefund);
router.post('/process', refundController.processRefund);
router.post('/complete', refundController.completeRefund);
router.get('/pending', refundController.getPendingRefunds);
router.get('/history', refundController.getRefundHistory);

module.exports = router;
