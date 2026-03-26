const Board = require('./board.model');
const Workspace = require('../workspace/workspace.model');
const AppError = require('../../utils/AppError');
const { createActivity } = require('../activity/activity.service');
const { createNotification, notifyMany } = require('../notification/notification.service');
const { emitToBoard, emitToWorkspace } = require('../../socket');

// ── Populate helper ───────────────────────────────────────────
const populateBoard = (query) =>
    query
        .populate('createdBy', 'name avatar initials color')
        .populate('members.user', 'name avatar email initials color')
        .populate('workspace', 'name slug');

// ── Create board ──────────────────────────────────────────────
const createBoard = async (userId, { workspaceId, title, description, background, visibility, isTemplate, templateName }) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (!workspace.isMember(userId)) throw new AppError('You are not a member of this workspace', 403);

    const board = await Board.create({
        title,
        description,
        workspace: workspaceId,
        createdBy: userId,
        background: background || { type: 'color', value: '#4F46E5' },
        visibility: visibility || 'workspace',
        isTemplate: isTemplate || false,
        templateName,
        members: [{ user: userId, role: 'admin' }],
    });

    // Update workspace board count
    await Workspace.findByIdAndUpdate(workspaceId, { $inc: { boardCount: 1 } });

    await createActivity({
        userId,
        workspaceId,
        boardId: board._id,
        action: 'board.created',
        description: `created board "${board.title}"`,
    });

    // Notify all workspace members
    const memberIds = workspace.members
        .map(m => m.user.toString())
        .filter(id => id !== userId.toString());

    await notifyMany(memberIds, {
        senderId: userId,
        type: 'board.activity',
        title: 'New board created',
        message: `A new board "${board.title}" was created in ${workspace.name}`,
        link: `/board/${board._id}`,
    });

    emitToWorkspace(workspaceId, 'board:created', { board });

    return populateBoard(Board.findById(board._id)).lean();
};

// ── Get boards for workspace ──────────────────────────────────
const getWorkspaceBoards = async (workspaceId, userId, { includeArchived = false } = {}) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (!workspace.isMember(userId)) throw new AppError('You are not a member of this workspace', 403);

    const filter = { workspace: workspaceId, isArchived: includeArchived ? { $in: [true, false] } : false };

    const boards = await populateBoard(Board.find(filter)).sort({ updatedAt: -1 }).lean();

    return boards.map(b => ({
        ...b,
        myRole: b.members.find(m => m.user._id.toString() === userId.toString())?.role || null,
        isMember: b.members.some(m => m.user._id.toString() === userId.toString()),
    }));
};

// ── Get single board (full detail) ────────────────────────────
const getBoard = async (boardId, userId) => {
    const board = await populateBoard(Board.findById(boardId)).lean();
    if (!board) throw new AppError('Board not found', 404);

    const workspace = await Workspace.findById(board.workspace._id || board.workspace);
    if (!workspace) throw new AppError('Workspace not found', 404);

    // Check access: board member OR workspace member (if visibility = workspace)
    const isBoardMember = board.members.some(m => m.user._id.toString() === userId.toString());
    const isWorkspaceMember = workspace.isMember(userId);

    if (board.visibility === 'private' && !isBoardMember) {
        throw new AppError('You do not have access to this board', 403);
    }
    if (!isWorkspaceMember) throw new AppError('You do not have access to this board', 403);

    // Get lists + cards
    const List = require('../list/list.model');
    const Card = require('../card/card.model');

    const lists = await List.find({ board: boardId, isArchived: false })
        .sort({ position: 1 })
        .lean();

    const cards = await Card.find({ board: boardId, isArchived: false })
        .populate('assignees', 'name avatar initials color')
        .populate('createdBy', 'name avatar initials color')
        .sort({ position: 1 })
        .lean();

    // Group cards by list
    const cardsByList = {};
    cards.forEach(card => {
        const listId = card.list.toString();
        if (!cardsByList[listId]) cardsByList[listId] = [];
        cardsByList[listId].push(card);
    });

    const listsWithCards = lists.map(list => ({
        ...list,
        cards: cardsByList[list._id.toString()] || [],
    }));

    return {
        ...board,
        lists: listsWithCards,
        myRole: board.members.find(m => m.user._id.toString() === userId.toString())?.role || null,
        isMember: isBoardMember,
    };
};

// ── Update board ──────────────────────────────────────────────
const updateBoard = async (boardId, userId, updates) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);
    if (!board.canEdit(userId)) throw new AppError('You do not have permission to edit this board', 403);

    const allowed = ['title', 'description', 'background', 'visibility'];
    allowed.forEach(f => { if (updates[f] !== undefined) board[f] = updates[f]; });
    await board.save();

    await createActivity({
        userId,
        workspaceId: board.workspace,
        boardId: board._id,
        action: 'board.updated',
        description: `updated board "${board.title}"`,
    });

    emitToBoard(boardId, 'board:updated', { board });
    return board;
};

// ── Archive / Unarchive board ─────────────────────────────────
const archiveBoard = async (boardId, userId, archive = true) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);
    if (!board.canEdit(userId)) throw new AppError('Permission denied', 403);

    board.isArchived = archive;
    board.archivedAt = archive ? new Date() : null;
    await board.save();

    await createActivity({
        userId,
        workspaceId: board.workspace,
        boardId: board._id,
        action: 'board.archived',
        description: `${archive ? 'archived' : 'unarchived'} board "${board.title}"`,
    });

    emitToWorkspace(board.workspace.toString(), archive ? 'board:archived' : 'board:unarchived', { boardId });
    return board;
};

// ── Delete board ──────────────────────────────────────────────
const deleteBoard = async (boardId, userId) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);

    const workspace = await Workspace.findById(board.workspace);
    const isOwner = workspace?.owner.toString() === userId.toString();
    const isAdmin = board.getMemberRole(userId) === 'admin';

    if (!isOwner && !isAdmin) throw new AppError('Only board admins or workspace owners can delete boards', 403);

    // Delete lists and cards
    const List = require('../list/list.model');
    const Card = require('../card/card.model');
    await Card.deleteMany({ board: boardId });
    await List.deleteMany({ board: boardId });
    await board.deleteOne();

    await Workspace.findByIdAndUpdate(board.workspace, { $inc: { boardCount: -1 } });

    emitToWorkspace(board.workspace.toString(), 'board:deleted', { boardId });
};

// ── Add member to board ───────────────────────────────────────
const addMember = async (boardId, userId, { targetUserId, role }) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);
    if (!board.canEdit(userId)) throw new AppError('Permission denied', 403);

    if (board.isMember(targetUserId)) throw new AppError('User is already a board member', 400);

    board.members.push({ user: targetUserId, role: role || 'member' });
    await board.save();

    await createActivity({
        userId,
        workspaceId: board.workspace,
        boardId: board._id,
        action: 'board.member_added',
        description: `added a member to "${board.title}"`,
    });

    await createNotification({
        recipientId: targetUserId,
        senderId: userId,
        type: 'board.invited',
        title: `Added to board "${board.title}"`,
        message: `You were added to the board "${board.title}"`,
        link: `/board/${board._id}`,
    });

    emitToBoard(boardId, 'board:member-added', { userId: targetUserId, role });
    return board;
};

// ── Remove member from board ──────────────────────────────────
const removeMember = async (boardId, userId, targetUserId) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);

    const isSelf = userId.toString() === targetUserId.toString();
    if (!isSelf && !board.canEdit(userId)) throw new AppError('Permission denied', 403);

    board.members = board.members.filter(m => m.user.toString() !== targetUserId.toString());
    await board.save();

    emitToBoard(boardId, 'board:member-removed', { userId: targetUserId });
    return board;
};

// ── Star / Unstar board ───────────────────────────────────────
const starBoard = async (boardId, userId, star) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);

    board.isStarred = star;
    await board.save();
    return board;
};

// ── Update label ──────────────────────────────────────────────
const updateLabel = async (boardId, userId, labelId, { name, color }) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);
    if (!board.canEdit(userId)) throw new AppError('Permission denied', 403);

    const label = board.labels.id(labelId);
    if (!label) throw new AppError('Label not found', 404);

    if (name !== undefined) label.name = name;
    if (color !== undefined) label.color = color;
    await board.save();

    emitToBoard(boardId, 'board:label-updated', { label });
    return board;
};

// ── Get templates ─────────────────────────────────────────────
const getTemplates = async (workspaceId, userId) => {
    return Board.find({ workspace: workspaceId, isTemplate: true })
        .populate('createdBy', 'name avatar')
        .sort({ updatedAt: -1 })
        .lean();
};

// ── Create from template ──────────────────────────────────────
const createFromTemplate = async (userId, { templateId, workspaceId, title }) => {
    const template = await Board.findById(templateId);
    if (!template || !template.isTemplate) throw new AppError('Template not found', 404);

    const List = require('../list/list.model');
    const Card = require('../card/card.model');

    // Create new board from template
    const board = await createBoard(userId, {
        workspaceId,
        title: title || `${template.title} (copy)`,
        description: template.description,
        background: template.background,
        visibility: template.visibility,
    });

    // Copy lists
    const templateLists = await List.find({ board: templateId }).sort({ position: 1 });
    for (const tList of templateLists) {
        const newList = await List.create({
            title: tList.title,
            board: board._id,
            position: tList.position,
        });

        // Copy cards
        const templateCards = await Card.find({ list: tList._id }).sort({ position: 1 });
        for (const tCard of templateCards) {
            await Card.create({
                title: tCard.title,
                description: tCard.description,
                list: newList._id,
                board: board._id,
                position: tCard.position,
                labels: tCard.labels,
                checklists: tCard.checklists,
                createdBy: userId,
            });
        }
    }

    return board;
};

module.exports = {
    createBoard, getWorkspaceBoards, getBoard,
    updateBoard, archiveBoard, deleteBoard,
    addMember, removeMember, starBoard,
    updateLabel, getTemplates, createFromTemplate,
};