import Connection from '../models/Connection.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// Note: io will be passed from server.js to avoid circular dependency
let io;

// @desc    Send connection request
export const setSocketIO = (socketInstance) => {
  io = socketInstance;
};

// @route   POST /api/connections/request
// @access  Private
export const sendConnectionRequest = asyncHandler(async (req, res) => {
  const { recipientId, type, message, template } = req.body;

  if (recipientId === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Cannot send connection request to yourself',
    });
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    return res.status(404).json({
      success: false,
      message: 'User not found',
    });
  }

  // Check if connection already exists
  const existingConnection = await Connection.findExistingConnection(
    req.user._id,
    recipientId
  );

  if (existingConnection) {
    return res.status(400).json({
      success: false,
      message: 'Connection request already exists',
      data: {
        status: existingConnection.status,
        type: existingConnection.type,
      },
    });
  }

  // Get template message if specified
  let finalMessage = message;
  if (template && template !== 'custom') {
    const templates = Connection.getTemplates();
    finalMessage = templates[template]?.replace('{name}', recipient.name) || message;
  }

  // Create connection request
  const connection = await Connection.create({
    requester: req.user._id,
    recipient: recipientId,
    type,
    message: finalMessage,
    template: template || 'custom',
    metadata: {
      requesterPhase: req.user.phase,
      recipientPhase: recipient.phase,
    },
  });

  await connection.populate('requester', 'name username avatar level phase');

  // Emit real-time notification if io is available
  if (io) {
    io.to(`user_${recipientId}`).emit('connection_request', {
      connection,
      requester: connection.requester,
    });
  }

  res.status(201).json({
    success: true,
    message: 'Connection request sent successfully',
    data: connection,
  });
});

// @desc    Respond to connection request
// @route   PUT /api/connections/:id/respond
// @access  Private
export const respondToConnectionRequest = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'accept' or 'decline'

  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be "accept" or "decline"',
    });
  }

  const connection = await Connection.findById(req.params.id)
    .populate('requester', 'name username avatar');

  if (!connection) {
    return res.status(404).json({
      success: false,
      message: 'Connection request not found',
    });
  }

  // Check if user is the recipient
  if (connection.recipient.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to respond to this request',
    });
  }

  // Check if already responded
  if (connection.status !== 'pending') {
    return res.status(400).json({
      success: false,
      message: 'Connection request already responded to',
    });
  }

  // Update connection status
  connection.status = action === 'accept' ? 'accepted' : 'declined';
  if (action === 'accept') {
    connection.connectionDate = new Date();
  }
  await connection.save();

  // Emit real-time notification to requester
  io.to(`user_${connection.requester._id}`).emit('connection_response', {
    connectionId: connection._id,
    status: connection.status,
    recipient: {
      name: req.user.name,
      username: req.user.username,
      avatar: req.user.avatar,
    },
  });

  res.status(200).json({
    success: true,
    message: `Connection request ${action}ed successfully`,
    data: connection,
  });
});

// @desc    Get user's connections
// @route   GET /api/connections
// @access  Private
export const getUserConnections = asyncHandler(async (req, res) => {
  const { status = 'accepted', type, page = 1, limit = 20 } = req.query;

  const query = {
    $or: [
      { requester: req.user._id },
      { recipient: req.user._id },
    ],
    status,
  };

  if (type && type !== 'all') {
    query.type = type;
  }

  const connections = await Connection.find(query)
    .populate('requester', 'name username avatar level phase isOnline lastActive')
    .populate('recipient', 'name username avatar level phase isOnline lastActive')
    .sort({ connectionDate: -1, createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  // Format connections to show the other user
  const formattedConnections = connections.map(connection => {
    const isRequester = connection.requester._id.toString() === req.user._id.toString();
    const otherUser = isRequester ? connection.recipient : connection.requester;

    return {
      _id: connection._id,
      type: connection.type,
      status: connection.status,
      connectionDate: connection.connectionDate,
      lastInteraction: connection.lastInteraction,
      connectedUser: otherUser,
      isRequester,
      createdAt: connection.createdAt,
    };
  });

  const total = await Connection.countDocuments(query);

  res.status(200).json({
    success: true,
    data: formattedConnections,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get pending connection requests
// @route   GET /api/connections/pending
// @access  Private
export const getPendingConnectionRequests = asyncHandler(async (req, res) => {
  const { type = 'received' } = req.query; // 'sent' or 'received'

  const query = {
    status: 'pending',
  };

  if (type === 'sent') {
    query.requester = req.user._id;
  } else {
    query.recipient = req.user._id;
  }

  const connections = await Connection.find(query)
    .populate('requester', 'name username avatar level phase bio')
    .populate('recipient', 'name username avatar level phase bio')
    .sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: connections,
  });
});

// @desc    Cancel connection request
// @route   DELETE /api/connections/:id
// @access  Private
export const cancelConnectionRequest = asyncHandler(async (req, res) => {
  const connection = await Connection.findById(req.params.id);

  if (!connection) {
    return res.status(404).json({
      success: false,
      message: 'Connection request not found',
    });
  }

  // Check if user is requester or recipient
  const canCancel = connection.requester.toString() === req.user._id.toString() ||
                   connection.recipient.toString() === req.user._id.toString();

  if (!canCancel) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this request',
    });
  }

  await Connection.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Connection request cancelled successfully',
  });
});

// @desc    Block user
// @route   PUT /api/connections/:id/block
// @access  Private
export const blockConnection = asyncHandler(async (req, res) => {
  const connection = await Connection.findById(req.params.id);

  if (!connection) {
    return res.status(404).json({
      success: false,
      message: 'Connection not found',
    });
  }

  // Check if user is part of connection
  const isInConnection = connection.requester.toString() === req.user._id.toString() ||
                        connection.recipient.toString() === req.user._id.toString();

  if (!isInConnection) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to block this connection',
    });
  }

  connection.status = 'blocked';
  connection.blockedBy = req.user._id;
  connection.blockedAt = new Date();
  await connection.save();

  // Emit real-time notification to requester if io is available
  if (io) {
    io.to(`user_${connection.requester._id}`).emit('connection_response', {
      connectionId: connection._id,
      status: connection.status,
      recipient: {
        name: req.user.name,
        username: req.user.username,
        avatar: req.user.avatar,
      },
    });
  }

  res.status(200).json({
    success: true,
    message: 'Connection blocked successfully',
  });
});

// @desc    Get connection templates
// @route   GET /api/connections/templates
// @access  Private
export const getConnectionTemplates = asyncHandler(async (req, res) => {
  const templates = Connection.getTemplates();

  res.status(200).json({
    success: true,
    data: {
      templates,
      types: [
        {
          id: 'brotherhood',
          name: 'Brotherhood Connection',
          description: 'Connect as brothers supporting each other',
          icon: '🤝',
        },
        {
          id: 'mentorship',
          name: 'Mentorship & Guidance',
          description: 'Seek or offer guidance and mentorship',
          icon: '🎯',
        },
        {
          id: 'accountability',
          name: 'Accountability Partner',
          description: 'Partner for mutual accountability',
          icon: '⚡',
        },
      ],
    },
  });
});

// @desc    Get connection stats
// @route   GET /api/connections/stats
// @access  Private
export const getConnectionStats = asyncHandler(async (req, res) => {
  const [
    totalConnections,
    brotherhoodConnections,
    mentorshipConnections,
    accountabilityConnections,
    pendingRequests,
  ] = await Promise.all([
    Connection.countDocuments({
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id },
      ],
      status: 'accepted',
    }),
    Connection.countDocuments({
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id },
      ],
      status: 'accepted',
      type: 'brotherhood',
    }),
    Connection.countDocuments({
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id },
      ],
      status: 'accepted',
      type: 'mentorship',
    }),
    Connection.countDocuments({
      $or: [
        { requester: req.user._id },
        { recipient: req.user._id },
      ],
      status: 'accepted',
      type: 'accountability',
    }),
    Connection.countDocuments({
      recipient: req.user._id,
      status: 'pending',
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      totalConnections,
      connectionsByType: {
        brotherhood: brotherhoodConnections,
        mentorship: mentorshipConnections,
        accountability: accountabilityConnections,
      },
      pendingRequests,
    },
  });
});