const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/paytm/initiate', paymentController.initiatePaytmPayment);
router.post('/paytm/callback', paymentController.paytmCallback);

module.exports = router;
