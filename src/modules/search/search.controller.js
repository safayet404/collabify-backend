const service = require('./search.service');
const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendPaginated } = require('../../utils/response');

exports.globalSearch = catchAsync(async (req, res) => {
    const { q, type, workspaceId, page, limit } = req.query;
    const result = await service.globalSearch(req.user._id, {
        query: q,
        type,
        workspaceId,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
    });
    sendSuccess(res, 200, 'OK', result);
});

exports.searchBoard = catchAsync(async (req, res) => {
    const { q, labels, assignee, dueDate, priority, page, limit } = req.query;
    const { cards, total } = await service.searchBoardCards(req.params.boardId, req.user._id, {
        query: q,
        labels: labels ? labels.split(',') : [],
        assignee,
        dueDate,
        priority,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
    });
    sendPaginated(res, cards, { total, page: parseInt(page) || 1, limit: parseInt(limit) || 20 });
});

exports.getRecent = catchAsync(async (req, res) => {
    const result = await service.getRecentItems(req.user._id);
    sendSuccess(res, 200, 'OK', result);
});

exports.suggestMentions = catchAsync(async (req, res) => {
    const { workspaceId, q } = req.query;
    const users = await service.suggestMentions(workspaceId, req.user._id, q);
    sendSuccess(res, 200, 'OK', { users });
});