const express = require('express');
const router = express.Router();
const ctrl = require('./board.controller');
const { protect } = require('../../middleware/auth.middleware');
const { body } = require('express-validator');
const validate = require('../../middleware/validate.middleware');

router.use(protect);

router.post('/', [
  body('workspaceId').notEmpty().withMessage('Workspace ID is required'),
  body('title').trim().notEmpty().withMessage('Board title is required')
    .isLength({ min: 1, max: 100 }),
  body('visibility').optional().isIn(['workspace', 'private']),
], validate, ctrl.create);

router.get('/workspace/:workspaceId', ctrl.getWorkspaceBoards);
router.get('/workspace/:workspaceId/templates', ctrl.getTemplates);

router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

router.patch('/:id/archive', ctrl.archive);
router.patch('/:id/unarchive', ctrl.unarchive);
router.patch('/:id/star', ctrl.star);
router.patch('/:id/unstar', ctrl.unstar);

router.post('/:id/members', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('role').optional().isIn(['admin', 'member', 'viewer']),
], validate, ctrl.addMember);

router.delete('/:id/members/:userId', ctrl.removeMember);

router.patch('/:id/labels/:labelId', [
  body('color').optional().matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).withMessage('Invalid color hex'),
], validate, ctrl.updateLabel);

router.post('/:id/use-template', [
  body('workspaceId').notEmpty().withMessage('Workspace ID is required'),
], validate, ctrl.createFromTemplate);

module.exports = router;
