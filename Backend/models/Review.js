const pool = require('../Config/db');

class Review {
  static async create(data) {
    const { patient_id, doctor_id, rating, comment } = data;
    const [result] = await pool.query(
      'INSERT INTO reviews (patient_id, doctor_id, rating, comment) VALUES (?, ?, ?, ?)',
      [patient_id, doctor_id, rating, comment]
    );
    return result.insertId;
  }

  static async findByDoctorId(doctor_id) {
    const [rows] = await pool.query(`
      SELECT r.*, u.name as patient_name 
      FROM reviews r 
      JOIN users u ON r.patient_id = u.id 
      WHERE r.doctor_id = ? 
      ORDER BY r.created_at DESC
    `, [doctor_id]);
    return rows;
  }
}

module.exports = Review;
