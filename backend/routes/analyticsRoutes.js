import { Router } from 'express';
import {
  getOverviewKPIs,
  getTopicAnalytics,
  getChapterAnalytics,
  getTrends,
} from '../controllers/analyticsController.js';
import {
  generateRecommendations,
  getAIAdvice,
} from '../controllers/recommendationController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/overview', getOverviewKPIs);
router.get('/topics', getTopicAnalytics);
router.get('/chapters', getChapterAnalytics);
router.get('/trends', getTrends);
router.get('/recommendations', generateRecommendations);
router.post('/ai-advice', getAIAdvice);

export default router;
