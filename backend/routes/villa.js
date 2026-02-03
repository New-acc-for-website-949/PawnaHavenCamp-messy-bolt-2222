const express = require('express');
const router = express.Router();
const villaController = require('../controllers/villa/villaController');
const authMiddleware = require('../middleware/auth');
const { validatePropertyId, validateCalendarData, validatePropertyUpdate } = require('../middleware/validation');

router.get('/public/:slug', villaController.getPublicVillaBySlug);

router.get('/:id', authMiddleware, validatePropertyId, villaController.getVillaById);
router.put('/update/:id', authMiddleware, validatePropertyId, validatePropertyUpdate, villaController.updateVilla);
router.put('/:id', authMiddleware, validatePropertyId, validatePropertyUpdate, villaController.updateVilla);

router.get('/:id/calendar', validatePropertyId, villaController.getVillaCalendarData);
router.put('/:id/calendar', authMiddleware, validatePropertyId, validateCalendarData, villaController.updateVillaCalendarData);
router.post('/:id/calendar', authMiddleware, validatePropertyId, validateCalendarData, villaController.updateVillaCalendarData);

module.exports = router;
