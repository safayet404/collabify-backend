const service = require('./card.service');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const { sendSuccess } = require('../../utils/response');

exports.create = catchAsync(async (req, res) => {
    const card = await service.createCard(req.user._id, {
        listId: req.body.listId,
        title: req.body.title,
        description: req.body.description,
        position: req.body.position,
    });
    sendSuccess(res, 201, 'Card created', { card });
});

exports.getOne = catchAsync(async (req, res) => {
    const card = await service.getCard(req.params.id, req.user._id);
    sendSuccess(res, 200, 'OK', { card });
});

exports.update = catchAsync(async (req, res) => {
    const card = await service.updateCard(req.params.id, req.user._id, req.body);
    sendSuccess(res, 200, 'Card updated', { card });
});

exports.move = catchAsync(async (req, res) => {
    const card = await service.moveCard(req.params.id, req.user._id, {
        listId: req.body.listId,
        position: req.body.position,
        boardId: req.body.boardId,
    });
    sendSuccess(res, 200, 'Card moved', { card });
});

exports.reorder = catchAsync(async (req, res) => {
    const cards = await service.reorderCards(req.body.listId, req.user._id, req.body.orderedIds);
    sendSuccess(res, 200, 'Cards reordered', { cards });
});

exports.archive = catchAsync(async (req, res) => {
    const card = await service.archiveCard(req.params.id, req.user._id, true);
    sendSuccess(res, 200, 'Card archived', { card });
});

exports.unarchive = catchAsync(async (req, res) => {
    const card = await service.archiveCard(req.params.id, req.user._id, false);
    sendSuccess(res, 200, 'Card unarchived', { card });
});

exports.remove = catchAsync(async (req, res) => {
    await service.deleteCard(req.params.id, req.user._id);
    sendSuccess(res, 200, 'Card deleted');
});

exports.copy = catchAsync(async (req, res) => {
    const card = await service.copyCard(req.params.id, req.user._id, {
        listId: req.body.listId,
        title: req.body.title,
    });
    sendSuccess(res, 201, 'Card copied', { card });
});

exports.getArchived = catchAsync(async (req, res) => {
    const cards = await service.getArchivedCards(req.params.boardId, req.user._id);
    sendSuccess(res, 200, 'OK', { cards });
});

exports.assignMember = catchAsync(async (req, res) => {
    const card = await service.assignMember(req.params.id, req.user._id, req.body.userId, true);
    sendSuccess(res, 200, 'Member assigned', { card });
});

exports.unassignMember = catchAsync(async (req, res) => {
    const card = await service.assignMember(req.params.id, req.user._id, req.params.userId, false);
    sendSuccess(res, 200, 'Member unassigned', { card });
});

exports.addLabel = catchAsync(async (req, res) => {
    const card = await service.updateLabel(req.params.id, req.user._id, req.body, true);
    sendSuccess(res, 200, 'Label added', { card });
});

exports.removeLabel = catchAsync(async (req, res) => {
    const card = await service.updateLabel(req.params.id, req.user._id, { labelId: req.params.labelId }, false);
    sendSuccess(res, 200, 'Label removed', { card });
});

exports.watch = catchAsync(async (req, res) => {
    await service.watchCard(req.params.id, req.user._id, true);
    sendSuccess(res, 200, 'Watching card');
});

exports.unwatch = catchAsync(async (req, res) => {
    await service.watchCard(req.params.id, req.user._id, false);
    sendSuccess(res, 200, 'Unwatched card');
});

exports.addChecklist = catchAsync(async (req, res) => {
    if (!req.body.title) throw new AppError('Checklist title is required', 400);
    const card = await service.addChecklist(req.params.id, req.user._id, { title: req.body.title });
    sendSuccess(res, 201, 'Checklist added', { card });
});

exports.deleteChecklist = catchAsync(async (req, res) => {
    const card = await service.deleteChecklist(req.params.id, req.user._id, req.params.checklistId);
    sendSuccess(res, 200, 'Checklist deleted', { card });
});

exports.addChecklistItem = catchAsync(async (req, res) => {
    if (!req.body.text) throw new AppError('Item text is required', 400);
    const card = await service.addChecklistItem(req.params.id, req.user._id, req.params.checklistId, { text: req.body.text });
    sendSuccess(res, 201, 'Item added', { card });
});

exports.toggleChecklistItem = catchAsync(async (req, res) => {
    const card = await service.toggleChecklistItem(req.params.id, req.user._id, req.params.checklistId, req.params.itemId);
    sendSuccess(res, 200, 'Item toggled', { card });
});

exports.updateChecklistItem = catchAsync(async (req, res) => {
    const card = await service.updateChecklistItem(req.params.id, req.user._id, req.params.checklistId, req.params.itemId, { text: req.body.text });
    sendSuccess(res, 200, 'Item updated', { card });
});

exports.addAttachment = catchAsync(async (req, res) => {
    if (!req.file) throw new AppError('Please upload a file', 400);
    const card = await service.addAttachment(req.params.id, req.user._id, {
        name: req.file.originalname,
        url: `/uploads/attachments/${req.file.filename}`,
        mimeType: req.file.mimetype,
        size: req.file.size,
    });
    sendSuccess(res, 201, 'Attachment added', { card });
});

exports.removeAttachment = catchAsync(async (req, res) => {
    const card = await service.removeAttachment(req.params.id, req.user._id, req.params.attachmentId);
    sendSuccess(res, 200, 'Attachment removed', { card });
});