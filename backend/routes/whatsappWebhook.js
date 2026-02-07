const express = require('express');
const router = express.Router();
const whatsappWebhookController = require('../controllers/whatsappWebhookController');

router.get('/webhook', whatsappWebhookController.whatsappWebhookVerify);
router.post('/webhook', whatsappWebhookController.whatsappWebhookReceive);

module.exports = router;
