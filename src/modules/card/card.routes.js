const express = require('express');
const router = express.Router();
const ctrl = require('./card.controller');
const { protect } = require('../../middleware/auth.middleware');
const { uploadAttachment } = require('../../middleware/upload.middleware');
const { body } = require('express-validator');
const validate = require('../../middleware/validate.middleware');

router.use(protect);

router.post('/', [
    body('listId').notEmpty().withMessage('List ID is required'),
    body('title').trim().notEmpty().withMessage('Card title is required')
        .isLength({ min: 1, max: 500 }),
], validate, ctrl.create);

router.get('/archived/:boardId', ctrl.getArchived);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

router.post('/:id/move', [
    body('listId').optional().notEmpty(),
    body('position').optional().isNumeric(),
], validate, ctrl.move);

router.patch('/reorder', [
    body('listId').notEmpty().withMessage('List ID is required'),
    body('orderedIds').isArray({ min: 1 }),
], validate, ctrl.reorder);

router.post('/:id/copy', ctrl.copy);
router.patch('/:id/archive', ctrl.archive);
router.patch('/:id/unarchive', ctrl.unarchive);

router.post('/:id/members', ctrl.assignMember);
router.delete('/:id/members/:userId', ctrl.unassignMember);

router.post('/:id/labels', ctrl.addLabel);
router.delete('/:id/labels/:labelId', ctrl.removeLabel);

router.post('/:id/watch', ctrl.watch);
router.delete('/:id/watch', ctrl.unwatch);

router.post('/:id/checklists', ctrl.addChecklist);
router.delete('/:id/checklists/:checklistId', ctrl.deleteChecklist);
router.post('/:id/checklists/:checklistId/items', ctrl.addChecklistItem);
router.patch('/:id/checklists/:checklistId/items/:itemId/toggle', ctrl.toggleChecklistItem);
router.patch('/:id/checklists/:checklistId/items/:itemId', ctrl.updateChecklistItem);

router.post('/:id/attachments', uploadAttachment, ctrl.addAttachment);
router.delete('/:id/attachments/:attachmentId', ctrl.removeAttachment);

module.exports = router;