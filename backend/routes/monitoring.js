const express = require('express');
const router = express.Router();
const monitoringController = require('../controllers/monitoringController');

router.get('/pending-payments', monitoringController.checkPendingPayments);
router.get('/stuck-bookings', monitoringController.getStuckBookings);
router.get('/failed-notifications', monitoringController.checkFailedNotifications);

module.exports = router;
