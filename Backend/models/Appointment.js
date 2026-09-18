const pool = require('../Config/db');

class Appointment {
  static async create(data) {
    const { patient_id, patient_name, patient_email, patient_phone, doctor_id, appointment_date, notes } = data;
    
    // Generate a unique readable Appointment ID
    const randomNum = Math.floor(100000 + Math.random() * 900000); // 6-digit random number
    const appointment_id = `NIVYA-${randomNum}`;

    const [result] = await pool.query(
      'INSERT INTO appointments (appointment_id, patient_id, patient_name, patient_email, patient_phone, doctor_id, appointment_date, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [appointment_id, patient_id || null, patient_name, patient_email, patient_phone, doctor_id, appointment_date, notes, 'pending']
    );
    
    return appointment_id; // Return the readable ID instead of auto-increment ID
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM appointments WHERE appointment_id = ?', [id]);
    return rows[0];
  }

  static async findByPatientId(patient_id) {
    const [rows] = await pool.query(
      'SELECT a.*, d.speciality, u.name as doctor_name FROM appointments a JOIN doctors d ON a.doctor_id = d.id JOIN users u ON d.user_id = u.id WHERE a.patient_id = ? ORDER BY a.appointment_date DESC',
      [patient_id]
    );
    return rows;
  }

  static async findByDoctorId(doctor_id) {
    const [rows] = await pool.query(
      'SELECT a.*, COALESCE(u.name, a.patient_name) as patient_name, COALESCE(u.phone, a.patient_phone) as patient_phone FROM appointments a LEFT JOIN users u ON a.patient_id = u.id WHERE a.doctor_id = ? ORDER BY a.appointment_date DESC',
      [doctor_id]
    );
    return rows;
  }

  static async updateStatus(id, status) {
    await pool.query('UPDATE appointments SET status = ? WHERE appointment_id = ?', [status, id]);
  }
}

module.exports = Appointment;