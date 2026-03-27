const express = require('express');
const router = express.Router();
const ctrl = require('./comment.controller');
const { protect } = require('../../middleware/auth.middleware');
const { body } = require('express-validator');
const validate = require('../../middleware/validate.middleware');

router.use(protect);

router.post('/', [
    body('cardId').notEmpty().withMessage('Card ID is required'),
    body('text').trim().notEmpty().withMessage('Comment text is required')
        .isLength({ min: 1, max: 5000 }),
    body('parentCommentId').optional().isMongoId(),
], validate, ctrl.create);

router.get('/card/:cardId', ctrl.getCardComments);

router.get('/:id/replies', ctrl.getReplies);
router.patch('/:id', [
    body('text').trim().notEmpty().isLength({ min: 1, max: 5000 }),
], validate, ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/react', [
    body('emoji').notEmpty(),
], validate, ctrl.react);

module.exports = router;
