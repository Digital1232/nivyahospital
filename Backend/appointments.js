const express = require('express');
const appointmentController = require('../controllers/appointmentController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Book appointment
router.post('/book', verifyToken, appointmentController.bookAppointment);

// Get patient appointments
router.get('/patient', verifyToken, appointmentController.getAppointments);

// Get doctor appointments
router.get('/doctor', verifyToken, appointmentController.getDoctorAppointments);

// Update appointment status
router.put('/:id', verifyToken, appointmentController.updateAppointmentStatus);

// Cancel appointment
router.delete('/:id', verifyToken, appointmentController.cancelAppointment);

module.exports = router;