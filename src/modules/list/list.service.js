const List = require('./list.model');
const Board = require('../board/board.model');
const AppError = require('../../utils/AppError');
const { createActivity } = require('../activity/activity.service');
const { emitToBoard } = require('../../socket');

const verifyBoardAccess = async (boardId, userId, requireEdit = false) => {
    const board = await Board.findById(boardId).populate('workspace');
    if (!board) throw new AppError('Board not found', 404);
    if (board.isArchived) throw new AppError('Board is archived', 403);

    const Workspace = require('../workspace/workspace.model');
    const workspace = await Workspace.findById(board.workspace._id || board.workspace);
    if (!workspace?.isMember(userId)) throw new AppError('You do not have access to this board', 403);

    if (requireEdit && board.getMemberRole(userId) === 'viewer') {
        const wsRole = workspace.getMemberRole(userId);
        if (wsRole !== 'owner' && wsRole !== 'admin') {
            throw new AppError('You do not have permission to edit this board', 403);
        }
    }

    return { board, workspace };
};

const getNextPosition = async (boardId) => {
    const last = await List.findOne({ board: boardId, isArchived: false })
        .sort({ position: -1 })
        .select('position')
        .lean();
    return (last?.position ?? -1) + 1;
};

const createList = async (userId, { boardId, title, color }) => {
    const { board, workspace } = await verifyBoardAccess(boardId, userId, true);

    const position = await getNextPosition(boardId);

    const list = await List.create({
        title,
        board: boardId,
        workspace: workspace._id,
        position,
        color: color || null,
    });

    await Board.findByIdAndUpdate(boardId, { $inc: { listCount: 1 } });

    await createActivity({
        userId,
        workspaceId: workspace._id,
        boardId,
        action: 'list.created',
        description: `created list "${list.title}"`,
        meta: { listId: list._id, listTitle: list.title },
    });

    emitToBoard(boardId, 'list:created', { list });
    return list;
};

const getBoardLists = async (boardId, userId) => {
    await verifyBoardAccess(boardId, userId);
    return List.find({ board: boardId, isArchived: false })
        .sort({ position: 1 })
        .lean();
};

const updateList = async (listId, userId, { title, color, cardLimit }) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);

    await verifyBoardAccess(list.board, userId, true);

    const old = { title: list.title };
    if (title !== undefined) list.title = title;
    if (color !== undefined) list.color = color;
    if (cardLimit !== undefined) list.cardLimit = cardLimit;
    await list.save();

    await createActivity({
        userId,
        boardId: list.board,
        action: 'list.updated',
        description: `renamed list "${old.title}" to "${list.title}"`,
        meta: { listId: list._id, oldTitle: old.title, newTitle: list.title },
    });

    emitToBoard(list.board.toString(), 'list:updated', { list });
    return list;
};

const reorderLists = async (boardId, userId, orderedIds) => {
    await verifyBoardAccess(boardId, userId, true);

    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id, board: boardId },
            update: { $set: { position: index } },
        },
    }));

    await List.bulkWrite(bulkOps);

    const lists = await List.find({ board: boardId, isArchived: false })
        .sort({ position: 1 })
        .lean();

    emitToBoard(boardId, 'list:reordered', { lists });
    return lists;
};

const moveList = async (listId, userId, { targetBoardId }) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);

    await verifyBoardAccess(list.board.toString(), userId, true);
    await verifyBoardAccess(targetBoardId, userId, true);

    const oldBoardId = list.board.toString();
    const position = await getNextPosition(targetBoardId);

    list.board = targetBoardId;
    list.position = position;
    await list.save();

    await Board.findByIdAndUpdate(oldBoardId, { $inc: { listCount: -1 } });
    await Board.findByIdAndUpdate(targetBoardId, { $inc: { listCount: 1 } });

    await createActivity({
        userId,
        boardId: targetBoardId,
        action: 'list.moved',
        description: `moved list "${list.title}" to another board`,
    });

    emitToBoard(oldBoardId, 'list:deleted', { listId });
    emitToBoard(targetBoardId, 'list:created', { list });
    return list;
};

const archiveList = async (listId, userId, archive = true) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);
    await verifyBoardAccess(list.board, userId, true);

    list.isArchived = archive;
    list.archivedAt = archive ? new Date() : null;
    await list.save();

    if (archive) {
        const Card = require('../card/card.model');
        await Card.updateMany({ list: listId }, { isArchived: true, archivedAt: new Date() });
        await Board.findByIdAndUpdate(list.board, { $inc: { listCount: -1 } });
    } else {
        await Board.findByIdAndUpdate(list.board, { $inc: { listCount: 1 } });
    }

    await createActivity({
        userId,
        boardId: list.board,
        action: 'list.deleted',
        description: `${archive ? 'archived' : 'unarchived'} list "${list.title}"`,
    });

    emitToBoard(list.board.toString(), archive ? 'list:archived' : 'list:unarchived', { listId, list });
    return list;
};

const deleteList = async (listId, userId) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);
    await verifyBoardAccess(list.board, userId, true);

    const Card = require('../card/card.model');
    await Card.deleteMany({ list: listId });
    await Board.findByIdAndUpdate(list.board, { $inc: { listCount: -1 } });
    await list.deleteOne();

    emitToBoard(list.board.toString(), 'list:deleted', { listId });
};

const copyList = async (listId, userId, { title }) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);
    await verifyBoardAccess(list.board, userId, true);

    const Card = require('../card/card.model');
    const position = await getNextPosition(list.board);

    const newList = await List.create({
        title: title || `${list.title} (copy)`,
        board: list.board,
        workspace: list.workspace,
        position,
        color: list.color,
    });

    const cards = await Card.find({ list: listId, isArchived: false }).sort({ position: 1 });
    for (const card of cards) {
        await Card.create({
            title: card.title,
            description: card.description,
            list: newList._id,
            board: card.board,
            position: card.position,
            labels: card.labels,
            checklists: card.checklists.map(cl => ({
                title: cl.title,
                items: cl.items.map(i => ({ text: i.text, isCompleted: false })),
            })),
            createdBy: userId,
        });
    }

    await Board.findByIdAndUpdate(list.board, { $inc: { listCount: 1 } });
    emitToBoard(list.board.toString(), 'list:created', { list: newList });
    return newList;
};

module.exports = {
    createList, getBoardLists, updateList,
    reorderLists, moveList,
    archiveList, deleteList, copyList,
};