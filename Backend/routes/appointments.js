const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');

router.post('/', appointmentController.bookAppointment);
router.get('/', appointmentController.getAppointments);
router.put('/:id/cancel', appointmentController.cancelAppointment);
router.get('/doctor', appointmentController.getDoctorAppointments);
router.put('/:id/status', appointmentController.updateAppointmentStatus);

module.exports = router;