const service = require('./comment.service');
const catchAsync = require('../../utils/catchAsync');
const { sendSuccess, sendPaginated } = require('../../utils/response');

exports.create = catchAsync(async (req, res) => {
    const comment = await service.createComment(req.user._id, {
        cardId: req.body.cardId,
        text: req.body.text,
        parentCommentId: req.body.parentCommentId,
    });
    sendSuccess(res, 201, 'Comment added', { comment });
});

exports.getCardComments = catchAsync(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { comments, total } = await service.getCardComments(
        req.params.cardId, req.user._id, { page, limit }
    );
    sendPaginated(res, comments, { total, page, limit });
});

exports.update = catchAsync(async (req, res) => {
    const comment = await service.updateComment(req.params.id, req.user._id, { text: req.body.text });
    sendSuccess(res, 200, 'Comment updated', { comment });
});

exports.remove = catchAsync(async (req, res) => {
    await service.deleteComment(req.params.id, req.user._id);
    sendSuccess(res, 200, 'Comment deleted');
});

exports.react = catchAsync(async (req, res) => {
    const comment = await service.reactToComment(req.params.id, req.user._id, req.body.emoji);
    sendSuccess(res, 200, 'Reaction updated', { comment });
});

exports.getReplies = catchAsync(async (req, res) => {
    const replies = await service.getReplies(req.params.id, req.user._id);
    sendSuccess(res, 200, 'OK', { replies });
});