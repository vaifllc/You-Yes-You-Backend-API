import { Message, Conversation } from '../models/Message.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Note: io will be passed from server.js to avoid circular dependency
let io;

// @desc    Get user's conversations
export const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// @route   GET /api/messages/conversations
// @access  Private
export const getConversations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const conversations = await Conversation.find({
    'participants.user': req.user._id,
    'participants.isActive': true,
  })
    .populate('participants.user', 'name username avatar isOnline lastActive')
    .populate('lastMessage')
    .sort({ lastActivity: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Calculate unread count for each conversation
  for (const conversation of conversations) {
    const userParticipant = conversation.participants.find(
      p => p.user._id.toString() === req.user._id.toString()
    );

    if (userParticipant) {
      const unreadCount = await Message.countDocuments({
        conversation: conversation._id,
        createdAt: { $gt: userParticipant.lastRead },
        sender: { $ne: req.user._id },
      });

      conversation._unreadCount = unreadCount;
    }
  }

  const total = await Conversation.countDocuments({
    'participants.user': req.user._id,
    'participants.isActive': true,
  });

  res.status(200).json({
    success: true,
    data: conversations,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get conversation messages
// @route   GET /api/messages/conversations/:id
// @access  Private
export const getConversationMessages = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.user.toString() === req.user._id.toString() && p.isActive
  );

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this conversation',
    });
  }

  const messages = await Message.find({
    conversation: req.params.id,
    isDeleted: false,
  })
    .populate('sender', 'name username avatar')
    .populate('replyTo')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Mark conversation as read
  await conversation.markAsRead(req.user._id);

  const total = await Message.countDocuments({
    conversation: req.params.id,
    isDeleted: false,
  });

  res.status(200).json({
    success: true,
    data: {
      conversation,
      messages: messages.reverse(), // Reverse to show oldest first
    },
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Send message
// @route   POST /api/messages/conversations/:id
// @access  Private
export const sendMessage = asyncHandler(async (req, res) => {
  const { content, type = 'text', replyTo } = req.body;

  const conversation = await Conversation.findById(req.params.id)
    .populate('participants.user', 'name username');

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }

  // Check if user is participant
  const isParticipant = conversation.participants.some(
    p => p.user._id.toString() === req.user._id.toString() && p.isActive
  );

  if (!isParticipant) {
    return res.status(403).json({
      success: false,
      message: 'Access denied to this conversation',
    });
  }

  // Create message
  const message = await Message.create({
    conversation: req.params.id,
    sender: req.user._id,
    content,
    type,
    replyTo,
  });

  // Update conversation last activity and message
  conversation.lastActivity = new Date();
  conversation.lastMessage = message._id;
  await conversation.save();

  // Populate sender info
  await message.populate('sender', 'name username avatar');

  // Emit real-time message to conversation participants
  conversation.participants.forEach(participant => {
    if (participant.user._id.toString() !== req.user._id.toString()) {
      io.to(`user_${participant.user._id}`).emit('new_message', {
        conversationId: conversation._id,
        message,
      });
    }
  });

  res.status(201).json({
    success: true,
    message: req.contentModeration?.flagged
      ? 'Message sent (content filtered)'
      : 'Message sent successfully',
    data: message,
  });
});

// @desc    Start new conversation
// @route   POST /api/messages/conversations
// @access  Private
export const startConversation = asyncHandler(async (req, res) => {
  const { recipientId, initialMessage } = req.body;

  if (recipientId === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot start conversation with yourself',
    });
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    return res.status(404).json({
      success: false,
      message: 'Recipient not found',
    });
  }

  // Check if conversation already exists
  const existingConversation = await Conversation.findOne({
    type: 'direct',
    'participants.user': { $all: [req.user._id, recipientId] },
  });

  if (existingConversation) {
    return res.status(400).json({
      success: false,
      message: 'Conversation already exists',
      data: { conversationId: existingConversation._id },
    });
  }

  // Create new conversation
  const conversation = await Conversation.create({
    type: 'direct',
    participants: [
      { user: req.user._id },
      { user: recipientId },
    ],
    createdBy: req.user._id,
  });

  // Send initial message if provided
  if (initialMessage) {
    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      content: initialMessage,
    });

    conversation.lastMessage = message._id;
    await conversation.save();

    // Emit real-time notification
    io.to(`user_${recipientId}`).emit('new_conversation', {
      conversation,
      initialMessage: message,
    });
  }

  // Emit real-time notification if io is available and we're not already emitting from above
  if (io && !initialMessage) {
    io.to(`user_${recipientId}`).emit('new_conversation', {
      conversation,
      initialMessage: null,
    });
  }

  await conversation.populate('participants.user', 'name username avatar isOnline');

  res.status(201).json({
    success: true,
    message: 'Conversation started successfully',
    data: conversation,
  });
});

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found',
    });
  }

  // Check if user is sender or admin
  if (message.sender.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to delete this message',
    });
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  await message.save();

  res.status(200).json({
    success: true,
    message: 'Message deleted successfully',
  });
});

// @desc    Edit message
// @route   PUT /api/messages/:id
// @access  Private
export const editMessage = asyncHandler(async (req, res) => {
  const { content } = req.body;

  const message = await Message.findById(req.params.id);

  if (!message) {
    return res.status(404).json({
      success: false,
      message: 'Message not found',
    });
  }

  // Check if user is sender
  if (message.sender.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to edit this message',
    });
  }

  // Check if message is too old to edit (5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  if (message.createdAt < fiveMinutesAgo) {
    return res.status(400).json({
      success: false,
      message: 'Cannot edit messages older than 5 minutes',
    });
  }

  message.edited.originalContent = message.content;
  message.content = content;
  message.edited.isEdited = true;
  message.edited.editedAt = new Date();
  await message.save();

  res.status(200).json({
    success: true,
    message: req.contentModeration?.flagged
      ? 'Message updated (content filtered)'
      : 'Message updated successfully',
    data: message,
  });
});

// @desc    Mark conversation as read
// @route   PUT /api/messages/conversations/:id/read
// @access  Private
export const markConversationAsRead = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found',
    });
  }

  await conversation.markAsRead(req.user._id);

  res.status(200).json({
    success: true,
    message: 'Conversation marked as read',
  });
});

// @desc    Add or toggle a message reaction
// @route   POST /api/messages/:id/reactions
// @access  Private
export const addReaction = asyncHandler(async (req, res) => {
  const { emoji } = req.body;

  if (!emoji || typeof emoji !== 'string') {
    return res.status(400).json({ success: false, message: 'Emoji is required' });
  }

  const message = await Message.findById(req.params.id).populate({
    path: 'conversation',
    select: 'participants',
  });

  if (!message) {
    return res.status(404).json({ success: false, message: 'Message not found' });
  }

  // Ensure user is participant of the conversation
  const conversation = message.conversation;
  const isParticipant = conversation.participants.some(
    (p) => p.user.toString() === req.user._id.toString() && p.isActive
  );

  if (!isParticipant) {
    return res.status(403).json({ success: false, message: 'Not authorized for this conversation' });
  }

  // Toggle reaction: if same emoji by same user exists, remove; else add
  const existingIndex = message.reactions.findIndex(
    (r) => r.user.toString() === req.user._id.toString() && r.emoji === emoji
  );

  if (existingIndex >= 0) {
    message.reactions.splice(existingIndex, 1);
  } else {
    message.reactions.push({ user: req.user._id, emoji, timestamp: new Date() });
  }

  await message.save();

  // Emit reaction event to other participants
  if (io) {
    conversation.participants.forEach((participant) => {
      if (participant.user.toString() !== req.user._id.toString()) {
        io.to(`user_${participant.user}`).emit('message_reaction', {
          messageId: message._id,
          emoji,
          userId: req.user._id,
          action: existingIndex >= 0 ? 'removed' : 'added',
        });
      }
    });
  }

  res.status(200).json({
    success: true,
    message: existingIndex >= 0 ? 'Reaction removed' : 'Reaction added',
  });
});

// @desc    Get older messages (history) before a timestamp
// @route   GET /api/messages/conversations/:id/history?before=ISO8601
// @access  Private
export const getMessageHistory = asyncHandler(async (req, res) => {
  const { before, limit = 50 } = req.query;

  const conversation = await Conversation.findById(req.params.id);

  if (!conversation) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  const isParticipant = conversation.participants.some(
    (p) => p.user.toString() === req.user._id.toString() && p.isActive
  );

  if (!isParticipant) {
    return res.status(403).json({ success: false, message: 'Access denied to this conversation' });
  }

  const beforeDate = before ? new Date(before) : new Date();

  const messages = await Message.find({
    conversation: req.params.id,
    isDeleted: false,
    createdAt: { $lt: beforeDate },
  })
    .populate('sender', 'name username avatar')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

  // Determine if there are older messages beyond this batch
  const oldest = messages[messages.length - 1];
  let hasMore = false;
  if (oldest) {
    const countOlder = await Message.countDocuments({
      conversation: req.params.id,
      isDeleted: false,
      createdAt: { $lt: oldest.createdAt },
    });
    hasMore = countOlder > 0;
  }

  res.status(200).json({
    success: true,
    data: messages.reverse(),
    pagination: {
      hasMore,
      nextBefore: oldest ? oldest.createdAt : null,
    },
  });
});