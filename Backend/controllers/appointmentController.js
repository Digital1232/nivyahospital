const Appointment = require('../models/Appointment');

exports.bookAppointment = async (req, res) => {
  try {
    const appointment_id = await Appointment.create(req.body);
    res.status(201).json({ 
      message: 'Appointment booked successfully',
      appointment_id 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const { patient_id } = req.query;
    const appointments = await Appointment.findByPatientId(patient_id);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    await Appointment.updateStatus(id, 'cancelled');
    res.json({ message: 'Appointment cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDoctorAppointments = async (req, res) => {
  try {
    const { doctor_id } = req.query;
    const appointments = await Appointment.findByDoctorId(doctor_id);
    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await Appointment.updateStatus(id, status);
    res.json({ message: 'Appointment status updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};