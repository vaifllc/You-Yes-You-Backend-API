import { asyncHandler } from '../middleware/errorHandler.js';
import { generateAccessToken, verifyRefreshToken } from '../utils/generateToken.js';

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public (requires refresh token)
export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(401).json({ success: false, message: 'No refresh token provided' });
  }
  try {
    const decoded = verifyRefreshToken(refreshToken);
    const newAccess = generateAccessToken(decoded.id);
    return res.status(200).json({ success: true, token: newAccess });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});
