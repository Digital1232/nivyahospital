const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

router.post('/', reviewController.addReview);
router.get('/doctor/:doctor_id', reviewController.getDoctorReviews);

module.exports = router;
