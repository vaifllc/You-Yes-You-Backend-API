import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { toggleBookmark, getUserBookmarks, getBookmarkStatus } from '../controllers/bookmarkController.js';

const router = express.Router();

router.use(authenticate);

router.post('/toggle', toggleBookmark);
router.get('/', getUserBookmarks);
router.get('/status', getBookmarkStatus);

export default router;
