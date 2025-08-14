import express from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { getAboutContent } from '../controllers/siteController.js';

const router = express.Router();

// Public site content endpoints
router.get('/about', optionalAuth, getAboutContent);

export default router;


