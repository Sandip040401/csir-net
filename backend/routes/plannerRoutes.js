import { Router } from 'express';
import {
  getPlanner,
  updatePlanner,
  generatePlannerSchedule,
} from '../controllers/plannerController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/', getPlanner);
router.put('/', updatePlanner);
router.post('/generate', generatePlannerSchedule);

export default router;
