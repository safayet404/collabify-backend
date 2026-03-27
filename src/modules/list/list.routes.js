const express = require('express');
const router = express.Router();
const ctrl = require('./list.controller');
const { protect } = require('../../middleware/auth.middleware');
const { body } = require('express-validator');
const validate = require('../../middleware/validate.middleware');

router.use(protect);

router.post('/', [
  body('boardId').notEmpty().withMessage('Board ID is required'),
  body('title').trim().notEmpty().withMessage('List title is required')
    .isLength({ min: 1, max: 100 }),
], validate, ctrl.create);

router.get('/board/:boardId', ctrl.getBoardLists);

router.patch('/reorder', [
  body('boardId').notEmpty().withMessage('Board ID is required'),
  body('orderedIds').isArray({ min: 1 }).withMessage('orderedIds must be a non-empty array'),
], validate, ctrl.reorder);

router.patch('/:id', ctrl.update);
router.patch('/:id/archive', ctrl.archive);
router.patch('/:id/unarchive', ctrl.unarchive);
router.post('/:id/move', ctrl.move);
router.post('/:id/copy', ctrl.copy);
router.delete('/:id', ctrl.remove);

module.exports = router;
