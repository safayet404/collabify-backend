const path = require('path');
const fs = require('fs');
const Card = require('./card.model');
const List = require('../list/list.model');
const Board = require('../board/board.model');
const AppError = require('../../utils/AppError');
const { createActivity } = require('../activity/activity.service');
const { createNotification, notifyMany } = require('../notification/notification.service');
const { emitToBoard } = require('../../socket');

const populateCard = (query) =>
    query
        .populate('assignees', 'name avatar initials color email')
        .populate('watchers', 'name avatar initials color')
        .populate('createdBy', 'name avatar initials color')
        .populate('checklists.items.completedBy', 'name avatar');

const verifyAccess = async (boardId, userId, requireEdit = false) => {
    const board = await Board.findById(boardId);
    if (!board) throw new AppError('Board not found', 404);

    const Workspace = require('../workspace/workspace.model');
    const workspace = await Workspace.findById(board.workspace);
    if (!workspace?.isMember(userId)) throw new AppError('Access denied', 403);

    if (requireEdit) {
        const boardRole = board.getMemberRole(userId);
        const wsRole = workspace.getMemberRole(userId);
        const canEdit = boardRole === 'admin' || boardRole === 'member' || wsRole === 'owner' || wsRole === 'admin';
        if (!canEdit) throw new AppError('You do not have permission to edit this board', 403);
    }

    return { board, workspace };
};

const getNextPosition = async (listId) => {
    const last = await Card.findOne({ list: listId, isArchived: false })
        .sort({ position: -1 }).select('position').lean();
    return (last?.position ?? -1) + 1;
};

const createCard = async (userId, { listId, title, description, position }) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);
    if (list.isArchived) throw new AppError('Cannot add cards to an archived list', 400);

    const { board, workspace } = await verifyAccess(list.board, userId, true);

    if (list.cardLimit) {
        const count = await Card.countDocuments({ list: listId, isArchived: false });
        if (count >= list.cardLimit) {
            throw new AppError(`List has reached its WIP limit of ${list.cardLimit} cards`, 400);
        }
    }

    const pos = position ?? await getNextPosition(listId);
    const card = await Card.create({
        title,
        description: description || '',
        list: listId,
        board: list.board,
        workspace: workspace._id,
        position: pos,
        createdBy: userId,
        watchers: [userId],
    });

    await List.findByIdAndUpdate(listId, { $inc: { cardCount: 1 } });
    await Board.findByIdAndUpdate(list.board, { $inc: { cardCount: 1 } });

    await createActivity({
        userId,
        workspaceId: workspace._id,
        boardId: list.board,
        cardId: card._id,
        action: 'card.created',
        description: `created card "${card.title}"`,
        meta: { cardId: card._id, listTitle: list.title },
    });

    const populated = await populateCard(Card.findById(card._id)).lean();
    emitToBoard(list.board.toString(), 'card:created', { card: populated, listId });
    return populated;
};

const getCard = async (cardId, userId) => {
    const card = await populateCard(Card.findById(cardId)).lean();
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId);
    return card;
};

const updateCard = async (cardId, userId, updates) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const allowed = ['title', 'description', 'dueDate', 'startDate', 'dueDateReminder', 'priority', 'storyPoints', 'cover'];
    allowed.forEach(f => { if (updates[f] !== undefined) card[f] = updates[f]; });

    if (updates.isCompleted !== undefined) {
        card.isCompleted = updates.isCompleted;
        card.completedAt = updates.isCompleted ? new Date() : null;
    }

    await card.save();

    await createActivity({
        userId,
        workspaceId: card.workspace,
        boardId: card.board,
        cardId: card._id,
        action: 'card.updated',
        description: `updated card "${card.title}"`,
        meta: { field: Object.keys(updates)[0] },
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const moveCard = async (cardId, userId, { listId, position, boardId }) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const oldListId = card.list.toString();
    const oldBoardId = card.board.toString();

    if (boardId && boardId !== oldBoardId) {
        await verifyAccess(boardId, userId, true);
        const targetList = await List.findById(listId);
        if (!targetList) throw new AppError('Target list not found', 404);

        await List.findByIdAndUpdate(oldListId, { $inc: { cardCount: -1 } });
        await Board.findByIdAndUpdate(oldBoardId, { $inc: { cardCount: -1 } });

        card.board = boardId;
        card.list = listId;
        card.position = position ?? await getNextPosition(listId);
        card.workspace = targetList.workspace;

        await List.findByIdAndUpdate(listId, { $inc: { cardCount: 1 } });
        await Board.findByIdAndUpdate(boardId, { $inc: { cardCount: 1 } });
    } else {
        if (listId && listId !== oldListId) {
            await List.findByIdAndUpdate(oldListId, { $inc: { cardCount: -1 } });
            await List.findByIdAndUpdate(listId, { $inc: { cardCount: 1 } });
            card.list = listId;
        }
        card.position = position ?? card.position;
    }

    await card.save();

    await createActivity({
        userId,
        workspaceId: card.workspace,
        boardId: card.board,
        cardId: card._id,
        action: 'card.moved',
        description: `moved card "${card.title}"`,
        meta: { fromList: oldListId, toList: listId },
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(oldBoardId, 'card:moved', {
        card: populated,
        fromListId: oldListId,
        toListId: listId || oldListId,
    });

    return populated;
};

const reorderCards = async (listId, userId, orderedIds) => {
    const list = await List.findById(listId);
    if (!list) throw new AppError('List not found', 404);
    await verifyAccess(list.board, userId, true);

    const bulkOps = orderedIds.map((id, index) => ({
        updateOne: {
            filter: { _id: id, list: listId },
            update: { $set: { position: index } },
        },
    }));

    await Card.bulkWrite(bulkOps);

    const cards = await populateCard(Card.find({ list: listId, isArchived: false }).sort({ position: 1 })).lean();
    emitToBoard(list.board.toString(), 'card:reordered', { listId, cards });
    return cards;
};

const archiveCard = async (cardId, userId, archive = true) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    card.isArchived = archive;
    card.archivedAt = archive ? new Date() : null;
    await card.save();

    const delta = archive ? -1 : 1;
    await List.findByIdAndUpdate(card.list, { $inc: { cardCount: delta } });
    await Board.findByIdAndUpdate(card.board, { $inc: { cardCount: delta } });

    await createActivity({
        userId,
        workspaceId: card.workspace,
        boardId: card.board,
        cardId: card._id,
        action: archive ? 'card.archived' : 'card.restored',
        description: `${archive ? 'archived' : 'restored'} card "${card.title}"`,
    });

    emitToBoard(card.board.toString(), archive ? 'card:archived' : 'card:unarchived', { cardId, listId: card.list });
    return card;
};

const deleteCard = async (cardId, userId) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    for (const att of card.attachments) {
        if (att.url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '../../../..', att.url);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    }

    await List.findByIdAndUpdate(card.list, { $inc: { cardCount: -1 } });
    await Board.findByIdAndUpdate(card.board, { $inc: { cardCount: -1 } });
    await card.deleteOne();

    emitToBoard(card.board.toString(), 'card:deleted', { cardId, listId: card.list });
};

const copyCard = async (cardId, userId, { listId, title }) => {
    const card = await Card.findById(cardId).lean();
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const targetListId = listId || card.list;
    const position = await getNextPosition(targetListId);

    const newCard = await Card.create({
        title: title || `${card.title} (copy)`,
        description: card.description,
        list: targetListId,
        board: card.board,
        workspace: card.workspace,
        position,
        createdBy: userId,
        labels: card.labels,
        priority: card.priority,
        storyPoints: card.storyPoints,
        cover: card.cover,
        checklists: card.checklists.map(cl => ({
            title: cl.title,
            items: cl.items.map(i => ({ text: i.text, isCompleted: false })),
        })),
        watchers: [userId],
    });

    await List.findByIdAndUpdate(targetListId, { $inc: { cardCount: 1 } });
    await Board.findByIdAndUpdate(card.board, { $inc: { cardCount: 1 } });

    const populated = await populateCard(Card.findById(newCard._id)).lean();
    emitToBoard(card.board.toString(), 'card:created', { card: populated, listId: targetListId });
    return populated;
};

const assignMember = async (cardId, userId, targetUserId, assign = true) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    if (assign) {
        if (!card.assignees.map(a => a.toString()).includes(targetUserId.toString())) {
            card.assignees.push(targetUserId);
            if (!card.watchers.map(w => w.toString()).includes(targetUserId.toString())) {
                card.watchers.push(targetUserId);
            }
        }
    } else {
        card.assignees = card.assignees.filter(a => a.toString() !== targetUserId.toString());
    }

    await card.save();

    if (assign) {
        await createActivity({
            userId,
            workspaceId: card.workspace,
            boardId: card.board,
            cardId: card._id,
            action: 'card.member_added',
            description: `assigned a member to "${card.title}"`,
        });

        await createNotification({
            recipientId: targetUserId,
            senderId: userId,
            type: 'card.assigned',
            title: `Assigned to "${card.title}"`,
            message: `You were assigned to card "${card.title}"`,
            link: `/board/${card.board}?card=${card._id}`,
        });
    }

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const updateLabel = async (cardId, userId, label, add = true) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    if (add) {
        const exists = card.labels.find(l => l.labelId?.toString() === label.labelId?.toString());
        if (!exists) card.labels.push(label);
    } else {
        card.labels = card.labels.filter(l => l.labelId?.toString() !== label.labelId?.toString());
    }

    await card.save();

    await createActivity({
        userId,
        workspaceId: card.workspace,
        boardId: card.board,
        cardId: card._id,
        action: add ? 'card.label_added' : 'card.label_removed',
        description: `${add ? 'added' : 'removed'} label "${label.name}" ${add ? 'to' : 'from'} "${card.title}"`,
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const watchCard = async (cardId, userId, watch = true) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId);

    if (watch) {
        if (!card.watchers.map(w => w.toString()).includes(userId.toString())) {
            card.watchers.push(userId);
        }
    } else {
        card.watchers = card.watchers.filter(w => w.toString() !== userId.toString());
    }

    await card.save();
    return card;
};

const addChecklist = async (cardId, userId, { title }) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    card.checklists.push({ title, items: [] });
    await card.save();

    await createActivity({
        userId, workspaceId: card.workspace, boardId: card.board, cardId: card._id,
        action: 'card.checklist_added', description: `added checklist "${title}" to "${card.title}"`,
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const deleteChecklist = async (cardId, userId, checklistId) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    card.checklists = card.checklists.filter(cl => cl._id.toString() !== checklistId);
    await card.save();

    await createActivity({
        userId, workspaceId: card.workspace, boardId: card.board, cardId: card._id,
        action: 'card.checklist_removed', description: `removed a checklist from "${card.title}"`,
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const addChecklistItem = async (cardId, userId, checklistId, { text }) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const checklist = card.checklists.id(checklistId);
    if (!checklist) throw new AppError('Checklist not found', 404);

    checklist.items.push({ text, isCompleted: false });
    await card.save();

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const toggleChecklistItem = async (cardId, userId, checklistId, itemId) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const checklist = card.checklists.id(checklistId);
    if (!checklist) throw new AppError('Checklist not found', 404);

    const item = checklist.items.id(itemId);
    if (!item) throw new AppError('Item not found', 404);

    item.isCompleted = !item.isCompleted;
    item.completedAt = item.isCompleted ? new Date() : null;
    item.completedBy = item.isCompleted ? userId : null;
    await card.save();

    await createActivity({
        userId, workspaceId: card.workspace, boardId: card.board, cardId: card._id,
        action: item.isCompleted ? 'card.checklist_item_checked' : 'card.checklist_item_unchecked',
        description: `${item.isCompleted ? 'checked' : 'unchecked'} "${item.text}" in "${card.title}"`,
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const updateChecklistItem = async (cardId, userId, checklistId, itemId, { text }) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const item = card.checklists.id(checklistId)?.items.id(itemId);
    if (!item) throw new AppError('Item not found', 404);

    item.text = text;
    await card.save();

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const addAttachment = async (cardId, userId, { name, url, mimeType, size }) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    card.attachments.push({ name, url, mimeType, size, uploadedBy: userId });
    await card.save();

    await createActivity({
        userId, workspaceId: card.workspace, boardId: card.board, cardId: card._id,
        action: 'card.attachment_added', description: `attached "${name}" to "${card.title}"`,
    });

    const watcherIds = card.watchers.map(w => w.toString()).filter(id => id !== userId.toString());
    await notifyMany(watcherIds, {
        senderId: userId,
        type: 'card.comment',
        title: `New attachment on "${card.title}"`,
        message: `${name} was attached to "${card.title}"`,
        link: `/board/${card.board}?card=${card._id}`,
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const removeAttachment = async (cardId, userId, attachmentId) => {
    const card = await Card.findById(cardId);
    if (!card) throw new AppError('Card not found', 404);
    await verifyAccess(card.board, userId, true);

    const att = card.attachments.id(attachmentId);
    if (!att) throw new AppError('Attachment not found', 404);

    if (att.url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '../../../..', att.url);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    card.attachments = card.attachments.filter(a => a._id.toString() !== attachmentId);
    await card.save();

    await createActivity({
        userId, workspaceId: card.workspace, boardId: card.board, cardId: card._id,
        action: 'card.attachment_removed', description: `removed attachment "${att.name}" from "${card.title}"`,
    });

    const populated = await populateCard(Card.findById(cardId)).lean();
    emitToBoard(card.board.toString(), 'card:updated', { card: populated });
    return populated;
};

const getArchivedCards = async (boardId, userId) => {
    await verifyAccess(boardId, userId);
    return populateCard(Card.find({ board: boardId, isArchived: true }).sort({ archivedAt: -1 })).lean();
};

module.exports = {
    createCard, getCard, updateCard,
    moveCard, reorderCards,
    archiveCard, deleteCard, copyCard,
    assignMember, updateLabel, watchCard,
    addChecklist, deleteChecklist,
    addChecklistItem, toggleChecklistItem, updateChecklistItem,
    addAttachment, removeAttachment,
    getArchivedCards,
};