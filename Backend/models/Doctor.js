const pool = require('../Config/db');

class Doctor {
  static async findAll() {
    const [rows] = await pool.query(`
      SELECT d.*, u.name, u.email, u.phone, u.profile_image 
      FROM doctors d 
      JOIN users u ON d.user_id = u.id
      WHERE u.role = 'doctor'
    `);
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(`
      SELECT d.*, u.name, u.email, u.phone, u.profile_image 
      FROM doctors d 
      JOIN users u ON d.user_id = u.id 
      WHERE d.id = ?
    `, [id]);
    return rows[0];
  }

  static async searchDoctors(speciality, name) {
    let query = 'SELECT d.*, u.name, u.email, u.phone FROM doctors d JOIN users u ON d.user_id = u.id WHERE u.role = "doctor"';
    const params = [];
    
    if (speciality) {
      query += ' AND d.speciality LIKE ?';
      params.push(`%${speciality}%`);
    }
    if (name) {
      query += ' AND u.name LIKE ?';
      params.push(`%${name}%`);
    }
    
    const [rows] = await pool.query(query, params);
    return rows;
  }
}

module.exports = Doctor;