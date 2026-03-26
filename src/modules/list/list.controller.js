const service = require('./list.service');
const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/response');

exports.create = catchAsync(async (req, res) => {
    const list = await service.createList(req.user._id, {
        boardId: req.body.boardId,
        title: req.body.title,
        color: req.body.color,
    });
    sendSuccess(res, 201, 'List created', { list });
});

exports.getBoardLists = catchAsync(async (req, res) => {
    const lists = await service.getBoardLists(req.params.boardId, req.user._id);
    sendSuccess(res, 200, 'OK', { lists });
});

exports.update = catchAsync(async (req, res) => {
    const list = await service.updateList(req.params.id, req.user._id, req.body);
    sendSuccess(res, 200, 'List updated', { list });
});

exports.reorder = catchAsync(async (req, res) => {
    const lists = await service.reorderLists(req.body.boardId, req.user._id, req.body.orderedIds);
    sendSuccess(res, 200, 'Lists reordered', { lists });
});

exports.move = catchAsync(async (req, res) => {
    const list = await service.moveList(req.params.id, req.user._id, { targetBoardId: req.body.targetBoardId });
    sendSuccess(res, 200, 'List moved', { list });
});

exports.archive = catchAsync(async (req, res) => {
    const list = await service.archiveList(req.params.id, req.user._id, true);
    sendSuccess(res, 200, 'List archived', { list });
});

exports.unarchive = catchAsync(async (req, res) => {
    const list = await service.archiveList(req.params.id, req.user._id, false);
    sendSuccess(res, 200, 'List unarchived', { list });
});

exports.remove = catchAsync(async (req, res) => {
    await service.deleteList(req.params.id, req.user._id);
    sendSuccess(res, 200, 'List deleted');
});

exports.copy = catchAsync(async (req, res) => {
    const list = await service.copyList(req.params.id, req.user._id, { title: req.body.title });
    sendSuccess(res, 201, 'List copied', { list });
});