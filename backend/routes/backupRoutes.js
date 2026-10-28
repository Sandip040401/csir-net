import { Router } from 'express';
import { exportData, importData } from '../controllers/backupController.js';
import { protect } from '../middlewares/auth.js';

const router = Router();

router.use(protect);

router.get('/export', exportData);
router.post('/import', importData);

export default router;
