const express = require('express');
const router = express.Router();
const ctrl = require('./workspace.controller');
const { protect } = require('../../middleware/auth.middleware');
const { body } = require('express-validator');
const validate = require('../../middleware/validate.middleware');

router.use(protect);

// CRUD
router.post('/', [
    body('name').trim().notEmpty().withMessage('Workspace name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
    body('description').optional().isLength({ max: 500 }),
], validate, ctrl.create);

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getOne);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

// Members
router.post('/:id/invite', [
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('role').optional().isIn(['admin', 'member', 'viewer']).withMessage('Invalid role'),
], validate, ctrl.invite);

router.post('/invite/:token/accept', ctrl.acceptInvite);
router.delete('/:id/members/:userId', ctrl.removeMember);
router.patch('/:id/members/:userId/role', [
    body('role').isIn(['admin', 'member', 'viewer']).withMessage('Invalid role'),
], validate, ctrl.updateMemberRole);

module.exports = router;