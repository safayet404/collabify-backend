const Activity = require('./activity.model');
const { emitToBoard } = require('../../socket');

const createActivity = async ({ userId, workspaceId, boardId, cardId, action, description, meta = {} }) => {
  try {
    const activity = await Activity.create({
      user: userId,
      workspace: workspaceId,
      board: boardId,
      card: cardId,
      action,
      description,
      meta,
    });

    await activity.populate('user', 'name avatar');

    if (boardId) {
      emitToBoard(boardId.toString(), 'activity:new', {
        id: activity._id,
        user: activity.user,
        action: activity.action,
        description: activity.description,
        meta: activity.meta,
        createdAt: activity.createdAt,
      });
    }

    return activity;
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
};

const getBoardActivity = async (boardId, { page = 1, limit = 20 } = {}) => {
  const skip = (page - 1) * limit;
  const total = await Activity.countDocuments({ board: boardId });
  const items = await Activity.find({ board: boardId })
    .populate('user', 'name avatar email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { items, total, page, limit };
};

const getCardActivity = async (cardId) => {
  return Activity.find({ card: cardId })
    .populate('user', 'name avatar')
    .sort({ createdAt: -1 })
    .lean();
};

const getWorkspaceActivity = async (workspaceId, { page = 1, limit = 30 } = {}) => {
  const skip = (page - 1) * limit;
  const total = await Activity.countDocuments({ workspace: workspaceId });
  const items = await Activity.find({ workspace: workspaceId })
    .populate('user', 'name avatar email')
    .populate('board', 'title')
    .populate('card', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { items, total, page, limit };
};

module.exports = { createActivity, getBoardActivity, getCardActivity, getWorkspaceActivity };
