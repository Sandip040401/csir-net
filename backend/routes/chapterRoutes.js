import { Router } from 'express';
import {
  getChapters,
  getChapterTopics,
  getAllTopics,
  createChapter,
  updateChapter,
  deleteChapter,
  createTopic,
  updateTopic,
  deleteTopic,
} from '../controllers/chapterController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

// Protect all routes
router.use(protect);

router.get('/', getChapters);
router.post('/', createChapter);
router.patch('/:id', updateChapter);
router.delete('/:id', deleteChapter);

router.get('/all-topics', getAllTopics);
router.get('/:id/topics', getChapterTopics);
router.post('/topics', createTopic);
router.patch('/topics/:id', updateTopic);
router.delete('/topics/:id', deleteTopic);

export default router;
