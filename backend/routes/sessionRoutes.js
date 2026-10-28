import { Router } from 'express';
import {
  getSessions,
  getSessionsByDate,
  upsertSession,
  deleteSession,
  getRecentTopicsForChapter,
} from '../controllers/sessionController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/', getSessions);
router.get('/by-date/:date', getSessionsByDate);
router.get('/recent-topics/:chapterId', getRecentTopicsForChapter);
router.put('/', upsertSession);
router.delete('/:id', deleteSession);

export default router;
