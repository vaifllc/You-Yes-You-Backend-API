import { v2 as cloudinary } from 'cloudinary';
import { asyncHandler } from '../middleware/errorHandler.js';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// @desc    Upload single file to Cloudinary
// @route   POST /api/files/upload
// @access  Private
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded',
    });
  }

  try {
    // Convert buffer to base64
    const base64File = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64File, {
      folder: 'youyesyou/general',
      public_id: `file_${req.user._id}_${Date.now()}`,
      resource_type: 'auto', // Automatically detect file type
    });

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: result.secure_url,
        publicId: result.public_id,
        fileType: result.resource_type,
        fileSize: result.bytes,
        format: result.format,
      },
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message,
    });
  }
});

// @desc    Upload multiple files
// @route   POST /api/files/upload-multiple
// @access  Private
export const uploadMultipleFiles = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded',
    });
  }

  try {
    const uploadPromises = req.files.map(async (file) => {
      const base64File = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      return await cloudinary.uploader.upload(base64File, {
        folder: 'youyesyou/general',
        public_id: `file_${req.user._id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        resource_type: 'auto',
      });
    });

    const results = await Promise.all(uploadPromises);

    const files = results.map(result => ({
      url: result.secure_url,
      publicId: result.public_id,
      fileType: result.resource_type,
      fileSize: result.bytes,
      format: result.format,
    }));

    res.status(200).json({
      success: true,
      message: 'Files uploaded successfully',
      data: files,
    });
  } catch (error) {
    console.error('Multiple file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message,
    });
  }
});

// @desc    Delete file from Cloudinary
// @route   DELETE /api/files/:publicId
// @access  Private
export const deleteFile = asyncHandler(async (req, res) => {
  const { publicId } = req.params;

  try {
    const result = await cloudinary.uploader.destroy(publicId);

    if (result.result === 'ok') {
      res.status(200).json({
        success: true,
        message: 'File deleted successfully',
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to delete file',
        details: result,
      });
    }
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message,
    });
  }
});

// @desc    Get user's uploaded files
// @route   GET /api/files/my-files
// @access  Private
export const getUserFiles = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, type = 'all' } = req.query;

  try {
    // Search Cloudinary for user's files
    const searchQuery = `folder:youyesyou/* AND public_id:*${req.user._id}*`;
    
    const result = await cloudinary.search
      .expression(searchQuery)
      .sort_by([['created_at', 'desc']])
      .max_results(limit)
      .execute();

    const files = result.resources.map(resource => ({
      publicId: resource.public_id,
      url: resource.secure_url,
      fileType: resource.resource_type,
      format: resource.format,
      fileSize: resource.bytes,
      createdAt: resource.created_at,
      tags: resource.tags,
    }));

    res.status(200).json({
      success: true,
      data: files,
      pagination: {
        current: parseInt(page),
        total: result.total_count,
        hasMore: result.total_count > (page * limit),
      },
    });
  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve files',
      error: error.message,
    });
  }
});

// @desc    Generate signed upload URL for direct uploads
// @route   POST /api/files/signed-url
// @access  Private
export const generateSignedUploadUrl = asyncHandler(async (req, res) => {
  const { fileName, fileType } = req.body;

  if (!fileName || !fileType) {
    return res.status(400).json({
      success: false,
      message: 'File name and type are required',
    });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const publicId = `youyesyou/direct/${req.user._id}_${timestamp}_${fileName}`;

    // Generate signature for secure upload
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp,
        public_id: publicId,
        folder: 'youyesyou/direct',
      },
      process.env.CLOUDINARY_API_SECRET
    );

    res.status(200).json({
      success: true,
      data: {
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
        publicId,
        signature,
        timestamp,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder: 'youyesyou/direct',
      },
    });
  } catch (error) {
    console.error('Signed URL generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate signed URL',
      error: error.message,
    });
  }
});

export default {
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getUserFiles,
  generateSignedUploadUrl,
};