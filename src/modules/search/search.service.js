const Card = require('../card/card.model');
const Board = require('../board/board.model');
const Workspace = require('../workspace/workspace.model');
const Comment = require('../comment/comment.model');
const User = require('../auth/user.model');
const AppError = require('../../utils/AppError');

const getUserWorkspaceIds = async (userId) => {
    const workspaces = await Workspace.find({ 'members.user': userId }).select('_id').lean();
    return workspaces.map(w => w._id);
};

const getAccessibleBoardIds = async (userId, workspaceIds) => {
    const boards = await Board.find({
        workspace: { $in: workspaceIds },
        isArchived: false,
        $or: [
            { visibility: 'workspace' },
            { 'members.user': userId },
        ],
    }).select('_id').lean();
    return boards.map(b => b._id);
};

const globalSearch = async (userId, { query, type, workspaceId, page = 1, limit = 20 }) => {
    if (!query?.trim()) throw new AppError('Search query is required', 400);

    const q = query.trim();
    const skip = (page - 1) * limit;

    const workspaceIds = workspaceId
        ? [workspaceId]
        : await getUserWorkspaceIds(userId);

    const boardIds = await getAccessibleBoardIds(userId, workspaceIds);

    const results = {};

    if (!type || type === 'cards') {
        const cardFilter = {
            board: { $in: boardIds },
            isArchived: false,
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
            ],
        };

        const [cards, cardsTotal] = await Promise.all([
            Card.find(cardFilter)
                .populate('assignees', 'name avatar initials color')
                .populate('board', 'title background')
                .sort({ updatedAt: -1 })
                .skip(type ? skip : 0)
                .limit(type ? limit : 5)
                .lean(),
            Card.countDocuments(cardFilter),
        ]);

        results.cards = { items: cards, total: cardsTotal };
    }

    if (!type || type === 'boards') {
        const boardFilter = {
            _id: { $in: boardIds },
            isArchived: false,
            $or: [
                { title: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
            ],
        };

        const [boards, boardsTotal] = await Promise.all([
            Board.find(boardFilter)
                .populate('workspace', 'name slug')
                .populate('createdBy', 'name avatar')
                .sort({ updatedAt: -1 })
                .skip(type ? skip : 0)
                .limit(type ? limit : 5)
                .lean(),
            Board.countDocuments(boardFilter),
        ]);

        results.boards = { items: boards, total: boardsTotal };
    }

    if (!type || type === 'workspaces') {
        const wsFilter = {
            _id: { $in: workspaceIds },
            $or: [
                { name: { $regex: q, $options: 'i' } },
                { description: { $regex: q, $options: 'i' } },
            ],
        };

        const [workspaces, wsTotal] = await Promise.all([
            Workspace.find(wsFilter)
                .populate('owner', 'name avatar')
                .sort({ updatedAt: -1 })
                .skip(type ? skip : 0)
                .limit(type ? limit : 5)
                .lean(),
            Workspace.countDocuments(wsFilter),
        ]);

        results.workspaces = { items: workspaces, total: wsTotal };
    }

    if (!type || type === 'comments') {
        const commentFilter = {
            board: { $in: boardIds },
            isDeleted: false,
            text: { $regex: q, $options: 'i' },
        };

        const [comments, commentsTotal] = await Promise.all([
            Comment.find(commentFilter)
                .populate('author', 'name avatar initials')
                .populate('card', 'title board')
                .sort({ createdAt: -1 })
                .skip(type ? skip : 0)
                .limit(type ? limit : 3)
                .lean(),
            Comment.countDocuments(commentFilter),
        ]);

        results.comments = { items: comments, total: commentsTotal };
    }

    if (!type || type === 'members') {
        const wsWithMembers = await Workspace.find({ _id: { $in: workspaceIds } })
            .populate('members.user', 'name email avatar initials color')
            .lean();

        const memberMap = new Map();
        wsWithMembers.forEach(ws => {
            ws.members.forEach(m => {
                if (m.user) memberMap.set(m.user._id.toString(), m.user);
            });
        });

        const allMembers = Array.from(memberMap.values());
        const filtered = allMembers.filter(m =>
            m.name?.toLowerCase().includes(q.toLowerCase()) ||
            m.email?.toLowerCase().includes(q.toLowerCase())
        );

        results.members = { items: filtered.slice(0, type ? limit : 5), total: filtered.length };
    }

    const totalResults = Object.values(results).reduce((sum, r) => sum + (r?.total || 0), 0);

    return { query: q, results, totalResults, page, limit };
};

const searchBoardCards = async (boardId, userId, { query, labels, assignee, dueDate, priority, page = 1, limit = 20 }) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);

    const Workspace = require('../workspace/workspace.model');
    const workspace = await Workspace.findById(board.workspace);
    if (!workspace?.isMember(userId)) throw new AppError('Access denied', 403);

    const filter = { board: boardId, isArchived: false };

    if (query?.trim()) {
        filter.$or = [
            { title: { $regex: query.trim(), $options: 'i' } },
            { description: { $regex: query.trim(), $options: 'i' } },
        ];
    }

    if (labels?.length) filter['labels.labelId'] = { $in: labels };
    if (assignee) filter.assignees = assignee;
    if (priority) filter.priority = priority;

    if (dueDate === 'overdue') {
        filter.dueDate = { $lt: new Date() };
        filter.isCompleted = false;
    } else if (dueDate === 'due_today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        filter.dueDate = { $gte: today, $lt: tomorrow };
    } else if (dueDate === 'due_week') {
        const today = new Date();
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        filter.dueDate = { $gte: today, $lte: weekEnd };
    } else if (dueDate === 'no_due_date') {
        filter.dueDate = { $exists: false };
    }

    const skip = (page - 1) * limit;
    const total = await Card.countDocuments(filter);
    const cards = await Card.find(filter)
        .populate('assignees', 'name avatar initials color')
        .populate('createdBy', 'name avatar initials')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return { cards, total, page, limit };
};

const getRecentItems = async (userId) => {
    const workspaceIds = await getUserWorkspaceIds(userId);
    const boardIds = await getAccessibleBoardIds(userId, workspaceIds);

    const [recentCards, recentBoards] = await Promise.all([
        Card.find({ board: { $in: boardIds }, isArchived: false, assignees: userId })
            .populate('board', 'title background')
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean(),
        Board.find({ _id: { $in: boardIds }, isArchived: false })
            .populate('workspace', 'name')
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean(),
    ]);

    return { recentCards, recentBoards };
};

const suggestMentions = async (workspaceId, userId, query) => {
    const workspace = await Workspace.findById(workspaceId)
        .populate('members.user', 'name email avatar initials color');
    if (!workspace) throw new AppError('Workspace not found', 404);
    if (!workspace.isMember(userId)) throw new AppError('Access denied', 403);

    const q = query?.toLowerCase() || '';
    return workspace.members
        .filter(m => m.user && (
            m.user.name?.toLowerCase().includes(q) ||
            m.user.email?.toLowerCase().includes(q)
        ))
        .slice(0, 8)
        .map(m => ({
            _id: m.user._id,
            name: m.user.name,
            email: m.user.email,
            avatar: m.user.avatar,
            initials: m.user.initials,
            color: m.user.color,
        }));
};

module.exports = { globalSearch, searchBoardCards, getRecentItems, suggestMentions };