const Review = require('../models/Review');

exports.addReview = async (req, res) => {
  try {
    const { rating } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    await Review.create(req.body);
    res.status(201).json({ message: 'Review added successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDoctorReviews = async (req, res) => {
  try {
    const { doctor_id } = req.params;
    const reviews = await Review.findByDoctorId(doctor_id);
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};