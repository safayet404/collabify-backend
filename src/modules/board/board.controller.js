const service = require('./board.service');
const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/response');

exports.create = catchAsync(async (req, res) => {
    const board = await service.createBoard(req.user._id, {
        workspaceId: req.body.workspaceId,
        title: req.body.title,
        description: req.body.description,
        background: req.body.background,
        visibility: req.body.visibility,
        isTemplate: req.body.isTemplate,
        templateName: req.body.templateName,
    });
    sendSuccess(res, 201, 'Board created', { board });
});

exports.getWorkspaceBoards = catchAsync(async (req, res) => {
    const boards = await service.getWorkspaceBoards(
        req.params.workspaceId,
        req.user._id,
        { includeArchived: req.query.archived === 'true' }
    );
    sendSuccess(res, 200, 'OK', { boards });
});

exports.getOne = catchAsync(async (req, res) => {
    const board = await service.getBoard(req.params.id, req.user._id);
    sendSuccess(res, 200, 'OK', { board });
});

exports.update = catchAsync(async (req, res) => {
    const board = await service.updateBoard(req.params.id, req.user._id, req.body);
    sendSuccess(res, 200, 'Board updated', { board });
});

exports.archive = catchAsync(async (req, res) => {
    const board = await service.archiveBoard(req.params.id, req.user._id, true);
    sendSuccess(res, 200, 'Board archived', { board });
});

exports.unarchive = catchAsync(async (req, res) => {
    const board = await service.archiveBoard(req.params.id, req.user._id, false);
    sendSuccess(res, 200, 'Board unarchived', { board });
});

exports.remove = catchAsync(async (req, res) => {
    await service.deleteBoard(req.params.id, req.user._id);
    sendSuccess(res, 200, 'Board deleted');
});

exports.addMember = catchAsync(async (req, res) => {
    const board = await service.addMember(req.params.id, req.user._id, {
        targetUserId: req.body.userId,
        role: req.body.role,
    });
    sendSuccess(res, 200, 'Member added', { board });
});

exports.removeMember = catchAsync(async (req, res) => {
    await service.removeMember(req.params.id, req.user._id, req.params.userId);
    sendSuccess(res, 200, 'Member removed');
});

exports.star = catchAsync(async (req, res) => {
    const board = await service.starBoard(req.params.id, req.user._id, true);
    sendSuccess(res, 200, 'Board starred', { board });
});

exports.unstar = catchAsync(async (req, res) => {
    const board = await service.starBoard(req.params.id, req.user._id, false);
    sendSuccess(res, 200, 'Board unstarred', { board });
});

exports.updateLabel = catchAsync(async (req, res) => {
    const board = await service.updateLabel(req.params.id, req.user._id, req.params.labelId, req.body);
    sendSuccess(res, 200, 'Label updated', { board });
});

exports.getTemplates = catchAsync(async (req, res) => {
    const templates = await service.getTemplates(req.params.workspaceId, req.user._id);
    sendSuccess(res, 200, 'OK', { templates });
});

exports.createFromTemplate = catchAsync(async (req, res) => {
    const board = await service.createFromTemplate(req.user._id, {
        templateId: req.params.id,
        workspaceId: req.body.workspaceId,
        title: req.body.title,
    });
    sendSuccess(res, 201, 'Board created from template', { board });
});