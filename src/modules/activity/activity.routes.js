const express  = require('express');
const router   = express.Router();
const { protect } = require('../../middleware/auth.middleware');
const { getBoardActivity, getWorkspaceActivity } = require('./activity.service');
const { sendSuccess, sendPaginated } = require('../../utils/response');
const catchAsync = require('../../utils/catchAsync');

// GET /api/activity/board/:boardId
router.get('/board/:boardId', protect, catchAsync(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;
  const { items, total } = await getBoardActivity(req.params.boardId, { page, limit });
  sendPaginated(res, items, { total, page, limit });
}));

// GET /api/activity/workspace/:workspaceId
router.get('/workspace/:workspaceId', protect, catchAsync(async (req, res) => {
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 30;
  const { items, total } = await getWorkspaceActivity(req.params.workspaceId, { page, limit });
  sendPaginated(res, items, { total, page, limit });
}));

module.exports = router;
