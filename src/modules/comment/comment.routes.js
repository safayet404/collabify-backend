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
        .isLength({ min: 1, max: 5000 }).withMessage('Comment must be 1–5000 characters'),
    body('parentCommentId').optional().isMongoId().withMessage('Invalid parent comment ID'),
], validate, ctrl.create);

router.get('/card/:cardId', ctrl.getCardComments);

router.get('/:id/replies', ctrl.getReplies);

router.patch('/:id', [
    body('text').trim().notEmpty().withMessage('Comment text is required')
        .isLength({ min: 1, max: 5000 }),
], validate, ctrl.update);

router.delete('/:id', ctrl.remove);

router.post('/:id/react', [
    body('emoji').notEmpty().withMessage('Emoji is required'),
], validate, ctrl.react);

module.exports = router;