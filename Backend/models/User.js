const pool = require('../Config/db');

class User {
  static async create(data) {
    const { name, email, password, phone, role, profile_image } = data;
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, phone, role, profile_image) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, password, phone || null, role || 'patient', profile_image || null]
    );
    return result.insertId;
  }

  static async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  }

  static async update(id, data) {
    const { name, phone, profile_image } = data;
    await pool.query(
      'UPDATE users SET name = ?, phone = ?, profile_image = ? WHERE id = ?',
      [name, phone, profile_image, id]
    );
  }
}

module.exports = User;
