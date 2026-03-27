const Comment = require('./comment.model');
const Card = require('../card/card.model');
const User = require('../auth/user.model');
const AppError = require('../../utils/AppError');
const { createActivity } = require('../activity/activity.service');
const { createNotification } = require('../notification/notification.service');
const { emitToBoard } = require('../../socket');

const populateComment = (query) =>
    query
        .populate('author', 'name avatar initials color')
        .populate('mentions', 'name avatar initials')
        .populate('reactions.users', 'name avatar initials');


const extractMentions = async (text, workspaceId) => {
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    const matches = [...text.matchAll(mentionRegex)].map(m => m[1]);
    if (!matches.length) return [];

    const Workspace = require('../workspace/workspace.model');
    const workspace = await Workspace.findById(workspaceId).populate('members.user', 'name email');

    const mentionedUsers = [];
    for (const match of matches) {
        const member = workspace?.members.find(m => {
            const name = m.user?.name?.toLowerCase().replace(/\s+/g, '');
            return name === match.toLowerCase() || m.user?.email?.startsWith(match.toLowerCase());
        });
        if (member && !mentionedUsers.find(u => u.toString() === member.user._id.toString())) {
            mentionedUsers.push(member.user._id);
        }
    }

    return mentionedUsers;
};

const createComment = async (userId, { cardId, text, parentCommentId }) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    if (card.isArchived) throw new AppError('Cannot comment on archived card', 400);

    const Workspace = require('../workspace/workspace.model');
    const workspace = await Workspace.findById(card.workspace);
    if (!workspace?.isMember(userId)) throw new AppError('Access denied', 403);

    if (parentCommentId) {
        const parent = await Comment.findById(parentCommentId);
        if (!parent || parent.card.toString() !== cardId) throw new AppError('Parent comment not found', 404);
        if (parent.parentComment) throw new AppError('Cannot reply to a reply', 400);
    }

    const mentions = await extractMentions(text, card.workspace);

    const comment = await Comment.create({
        card: cardId,
        board: card.board,
        workspace: card.workspace,
        author: userId,
        text,
        mentions,
        parentComment: parentCommentId || null,
    });

    if (parentCommentId) {
        await Comment.findByIdAndUpdate(parentCommentId, { $inc: { repliesCount: 1 } });
    }

    await Card.findByIdAndUpdate(cardId, { $inc: { commentsCount: 1 } });

    await createActivity({
        userId,
        workspaceId: card.workspace,
        boardId: card.board,
        cardId: card._id,
        action: 'comment.created',
        description: `commented on "${card.title}"`,
        meta: { commentId: comment._id, text: text.slice(0, 100) },
    });

    const author = await User.findById(userId).select('name');
    const notified = new Set([userId.toString()]);

    for (const watcherId of card.watchers) {
        const id = watcherId.toString();
        if (notified.has(id)) continue;
        notified.add(id);

        await createNotification({
            recipientId: watcherId,
            senderId: userId,
            type: 'card.comment',
            title: `New comment on "${card.title}"`,
            message: `${author.name}: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`,
            link: `/board/${card.board}?card=${card._id}`,
            meta: { cardId: card._id, commentId: comment._id },
        });
    }

    for (const mentionedId of mentions) {
        const id = mentionedId.toString();
        if (notified.has(id)) continue;
        notified.add(id);

        await createNotification({
            recipientId: mentionedId,
            senderId: userId,
            type: 'card.mention',
            title: `You were mentioned in "${card.title}"`,
            message: `${author.name} mentioned you: ${text.slice(0, 80)}`,
            link: `/board/${card.board}?card=${card._id}`,
            meta: { cardId: card._id, commentId: comment._id },
        });
    }

    if (parentCommentId) {
        const parent = await Comment.findById(parentCommentId);
        const parentAuthorId = parent?.author?.toString();
        if (parentAuthorId && !notified.has(parentAuthorId)) {
            await createNotification({
                recipientId: parent.author,
                senderId: userId,
                type: 'card.comment',
                title: `${author.name} replied to your comment`,
                message: text.slice(0, 100),
                link: `/board/${card.board}?card=${card._id}`,
            });
        }
    }

    const populated = await populateComment(Comment.findById(comment._id)).lean();
    emitToBoard(card.board.toString(), 'comment:created', { comment: populated, cardId });
    return populated;
};

const getCardComments = async (cardId, userId, { page = 1, limit = 20 } = {}) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);

    const Workspace = require('../workspace/workspace.model');
    const workspace = await Workspace.findById(card.workspace);
    if (!workspace?.isMember(userId)) throw new AppError('Access denied', 403);

    const skip = (page - 1) * limit;
    const total = await Comment.countDocuments({ card: cardId, parentComment: null, isDeleted: false });

    const comments = await populateComment(
        Comment.find({ card: cardId, parentComment: null, isDeleted: false })
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
    ).lean();

    const commentIds = comments.map(c => c._id);
    const replies = await populateComment(
        Comment.find({ parentComment: { $in: commentIds }, isDeleted: false })
            .sort({ createdAt: 1 })
    ).lean();

    const commentsWithReplies = comments.map(comment => ({
        ...comment,
        replies: replies.filter(r => r.parentComment?.toString() === comment._id.toString()),
    }));

    return { comments: commentsWithReplies, total, page, limit };
};

const updateComment = async (commentId, userId, { text }) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.isDeleted) throw new AppError('Comment has been deleted', 400);
    if (comment.author.toString() !== userId.toString()) {
        throw new AppError('You can only edit your own comments', 403);
    }

    const mentions = await extractMentions(text, comment.workspace);

    comment.text = text;
    comment.mentions = mentions;
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await createActivity({
        userId,
        workspaceId: comment.workspace,
        boardId: comment.board,
        cardId: comment.card,
        action: 'comment.updated',
        description: 'edited a comment',
    });

    const populated = await populateComment(Comment.findById(commentId)).lean();
    emitToBoard(comment.board.toString(), 'comment:updated', { comment: populated, cardId: comment.card });
    return populated;
};

const deleteComment = async (commentId, userId) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);

    const Board = require('../board/board.model');
    const board = await Board.findById(comment.board);
    const isAdmin = board?.getMemberRole(userId) === 'admin';
    const isAuthor = comment.author.toString() === userId.toString();

    if (!isAuthor && !isAdmin) throw new AppError('You cannot delete this comment', 403);

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    comment.text = '[deleted]';
    await comment.save();

    if (comment.parentComment) {
        await Comment.findByIdAndUpdate(comment.parentComment, { $inc: { repliesCount: -1 } });
    }

    await Card.findByIdAndUpdate(comment.card, { $inc: { commentsCount: -1 } });

    await createActivity({
        userId,
        workspaceId: comment.workspace,
        boardId: comment.board,
        cardId: comment.card,
        action: 'comment.deleted',
        description: 'deleted a comment',
    });

    emitToBoard(comment.board.toString(), 'comment:deleted', { commentId, cardId: comment.card });
};

const reactToComment = async (commentId, userId, emoji) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);
    if (comment.isDeleted) throw new AppError('Comment has been deleted', 400);

    const existing = comment.reactions.find(r => r.emoji === emoji);

    if (existing) {
        const userIndex = existing.users.findIndex(u => u.toString() === userId.toString());
        if (userIndex > -1) {
            existing.users.splice(userIndex, 1);
            if (existing.users.length === 0) {
                comment.reactions = comment.reactions.filter(r => r.emoji !== emoji);
            }
        } else {
            existing.users.push(userId);
        }
    } else {
        comment.reactions.push({ emoji, users: [userId] });
    }

    await comment.save();

    const populated = await populateComment(Comment.findById(commentId)).lean();
    emitToBoard(comment.board.toString(), 'comment:reacted', { comment: populated, cardId: comment.card });
    return populated;
};

const getReplies = async (commentId, userId) => {
    const comment = await Comment.findById(commentId);
    if (!comment) throw new AppError('Comment not found', 404);

    return populateComment(
        Comment.find({ parentComment: commentId, isDeleted: false }).sort({ createdAt: 1 })
    ).lean();
};

module.exports = {
    createComment, getCardComments, updateComment,
    deleteComment, reactToComment, getReplies,
};