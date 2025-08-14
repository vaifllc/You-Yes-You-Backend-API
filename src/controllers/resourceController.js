import Resource from '../models/Resource.js';
import { asyncHandler } from '../middleware/errorHandler.js';

// @desc    Get all resources
// @route   GET /api/resources
// @access  Private
export const getResources = asyncHandler(async (req, res) => {
  const { 
    page = 1, 
    limit = 12, 
    category, 
    type,
    location,
    state,
    city,
    search,
    featured,
    verified,
    sortBy = 'rating'
  } = req.query;

  // Build query
  const query = { status: 'approved' };
  
  if (category && category !== 'all') {
    query.category = category;
  }
  
  if (type && type !== 'all') {
    query.type = type;
  }
  
  if (location && location !== 'all') {
    query.location = location;
  }
  
  if (state) {
    query.state = state;
  }
  
  if (city) {
    query.city = new RegExp(city, 'i');
  }
  
  if (featured === 'true') {
    query.featured = true;
  }
  
  if (verified === 'true') {
    query.verified = true;
  }
  
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $in: [new RegExp(search, 'i')] } },
    ];
  }

  // Check phase access
  if (req.user) {
    query.$or = [
      { 'eligibility.phaseAccess': { $in: ['All Phases'] } },
      { 'eligibility.phaseAccess': { $in: [req.user.phase] } },
    ];
  }

  // Build sort object
  let sort = {};
  switch (sortBy) {
    case 'rating':
      sort = { featured: -1, 'rating.average': -1, views: -1 };
      break;
    case 'newest':
      sort = { featured: -1, createdAt: -1 };
      break;
    case 'popular':
      sort = { featured: -1, views: -1 };
      break;
    case 'alphabetical':
      sort = { featured: -1, title: 1 };
      break;
    default:
      sort = { featured: -1, 'rating.average': -1 };
  }

  // Execute query with pagination
  const resources = await Resource.find(query)
    .populate('submittedBy', 'name username')
    .sort(sort)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .lean();

  // Get total count for pagination
  const total = await Resource.countDocuments(query);

  res.status(200).json({
    success: true,
    data: resources,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Get single resource
// @route   GET /api/resources/:id
// @access  Private
export const getResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id)
    .populate('submittedBy', 'name username avatar')
    .populate('reviews.user', 'name username avatar');

  if (!resource || resource.status !== 'approved') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  // Check phase access
  const hasAccess = resource.eligibility.phaseAccess.includes('All Phases') ||
                   resource.eligibility.phaseAccess.includes(req.user.phase);

  if (!hasAccess) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted for your current phase',
    });
  }

  // Increment view count
  resource.views += 1;
  await resource.save();

  res.status(200).json({
    success: true,
    data: resource,
  });
});

// @desc    Submit new resource
// @route   POST /api/resources
// @access  Private
export const submitResource = asyncHandler(async (req, res) => {
  const resourceData = {
    ...req.body,
    submittedBy: req.user._id,
    status: 'pending',
  };

  const resource = await Resource.create(resourceData);

  res.status(201).json({
    success: true,
    message: 'Resource submitted for review',
    data: resource,
  });
});

// @desc    Add review to resource
// @route   POST /api/resources/:id/reviews
// @access  Private
export const addResourceReview = asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;

  const resource = await Resource.findById(req.params.id);

  if (!resource || resource.status !== 'approved') {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  // Check if user already reviewed
  const existingReview = resource.reviews.find(
    review => review.user.toString() === req.user._id.toString()
  );

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: 'You have already reviewed this resource',
    });
  }

  // Add review
  resource.reviews.push({
    user: req.user._id,
    rating,
    comment,
  });

  await resource.save();

  res.status(201).json({
    success: true,
    message: 'Review added successfully',
  });
});

// @desc    Get resource categories
// @route   GET /api/resources/categories
// @access  Private
export const getResourceCategories = asyncHandler(async (req, res) => {
  const categories = [
    'Housing',
    'Employment',
    'Legal Aid',
    'Mental Health',
    'Financial Services',
    'Education',
    'Healthcare',
    'Transportation',
    'Food Assistance',
    'Childcare',
    'Substance Abuse',
    'Emergency Services',
    'Technology',
    'Other',
  ];

  // Get resource count for each category
  const categoriesWithCounts = await Promise.all(
    categories.map(async (category) => {
      const count = await Resource.countDocuments({ 
        category, 
        status: 'approved' 
      });
      return {
        name: category,
        count,
        slug: category.toLowerCase().replace(/\s+/g, '-'),
      };
    })
  );

  res.status(200).json({
    success: true,
    data: categoriesWithCounts,
  });
});

// Admin functions

// @desc    Get pending resources
// @route   GET /api/resources/admin/pending
// @access  Private (Admin)
export const getPendingResources = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const resources = await Resource.find({ status: 'pending' })
    .populate('submittedBy', 'name username avatar')
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  const total = await Resource.countDocuments({ status: 'pending' });

  res.status(200).json({
    success: true,
    data: resources,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / limit),
      total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    },
  });
});

// @desc    Approve/reject resource
// @route   PUT /api/resources/:id/moderate
// @access  Private (Admin)
export const moderateResource = asyncHandler(async (req, res) => {
  const { action, reason } = req.body;

  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid action. Must be "approve" or "reject"',
    });
  }

  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  if (action === 'approve') {
    resource.status = 'approved';
    resource.approvedBy = req.user._id;
  } else {
    resource.status = 'rejected';
  }

  await resource.save();

  res.status(200).json({
    success: true,
    message: `Resource ${action}d successfully`,
  });
});

// @desc    Update resource
// @route   PUT /api/resources/:id
// @access  Private (Admin)
export const updateResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Resource updated successfully',
    data: resource,
  });
});

// @desc    Delete resource
// @route   DELETE /api/resources/:id
// @access  Private (Admin)
export const deleteResource = asyncHandler(async (req, res) => {
  const resource = await Resource.findById(req.params.id);

  if (!resource) {
    return res.status(404).json({
      success: false,
      message: 'Resource not found',
    });
  }

  await Resource.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Resource deleted successfully',
  });
});