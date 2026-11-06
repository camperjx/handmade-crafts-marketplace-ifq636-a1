const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { optionalProtect } = require('../middleware/optionalAuthMiddleware');
const { listProducts, listMyProducts, getProduct, createProduct, updateProduct } = require('../controllers/productController');
const router = express.Router();

router.get('/', optionalProtect, listProducts);
router.get('/mine', protect, authorize('seller'), listMyProducts);
router.post('/', protect, authorize('seller'), createProduct);
router.get('/:id', optionalProtect, getProduct);
router.patch('/:id', protect, authorize('seller'), updateProduct);

module.exports = router;
