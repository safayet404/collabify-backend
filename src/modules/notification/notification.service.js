const Notification = require('./notification.model');
const { emitToUser } = require('../../socket');

const createNotification = async ({ recipientId, senderId, type, title, message, link, meta = {} }) => {
  if (recipientId?.toString() === senderId?.toString()) return; // Don't notify yourself

  try {
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type, title, message, link, meta,
    });

    await notification.populate('sender', 'name avatar');

    emitToUser(recipientId.toString(), 'notification:new', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      sender: notification.sender,
      isRead: false,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const notifyMany = async (recipientIds, payload) => {
  for (const id of recipientIds) {
    await createNotification({ ...payload, recipientId: id });
  }
};

module.exports = { createNotification, notifyMany };
