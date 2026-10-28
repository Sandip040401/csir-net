import { Router } from 'express';
import {
  getChapters,
  getChapterTopics,
  getAllTopics,
  createChapter,
  updateChapter,
  deleteChapter,
  addCustomTopicToChapter,
  updateTopic,
  deleteTopic,
} from '../controllers/chapterController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/', getChapters);
router.post('/', createChapter);
router.patch('/:id', updateChapter);
router.delete('/:id', deleteChapter);

router.get('/all-topics', getAllTopics);
router.get('/:id/topics', getChapterTopics);
router.post('/:chapterId/topics', addCustomTopicToChapter);
router.patch('/topics/:id', updateTopic);
router.delete('/topics/:id', deleteTopic);

export default router;
