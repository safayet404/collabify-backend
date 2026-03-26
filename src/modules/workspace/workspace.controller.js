const service = require('./workspace.service');
const catchAsync = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/response');

exports.create = catchAsync(async (req, res) => {
    const { name, description, color } = req.body;
    const workspace = await service.createWorkspace(req.user._id, { name, description, color });
    sendSuccess(res, 201, 'Workspace created', { workspace });
});

exports.getAll = catchAsync(async (req, res) => {
    const workspaces = await service.getUserWorkspaces(req.user._id);
    sendSuccess(res, 200, 'OK', { workspaces });
});

exports.getOne = catchAsync(async (req, res) => {
    const workspace = await service.getWorkspace(req.params.id, req.user._id);
    sendSuccess(res, 200, 'OK', { workspace });
});

exports.update = catchAsync(async (req, res) => {
    const workspace = await service.updateWorkspace(req.params.id, req.user._id, req.body);
    sendSuccess(res, 200, 'Workspace updated', { workspace });
});

exports.remove = catchAsync(async (req, res) => {
    await service.deleteWorkspace(req.params.id, req.user._id);
    sendSuccess(res, 200, 'Workspace deleted');
});

exports.invite = catchAsync(async (req, res) => {
    const result = await service.inviteMember(req.params.id, req.user._id, req.body);
    sendSuccess(res, 200, result.message);
});

exports.acceptInvite = catchAsync(async (req, res) => {
    const workspace = await service.acceptInvite(req.params.token, req.user._id);
    sendSuccess(res, 200, 'Invitation accepted', { workspace });
});

exports.removeMember = catchAsync(async (req, res) => {
    const result = await service.removeMember(req.params.id, req.user._id, req.params.userId);
    sendSuccess(res, 200, result.message);
});

exports.updateMemberRole = catchAsync(async (req, res) => {
    const result = await service.updateMemberRole(req.params.id, req.user._id, req.params.userId, req.body.role);
    sendSuccess(res, 200, result.message);
});