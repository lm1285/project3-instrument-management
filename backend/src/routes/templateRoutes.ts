import express from 'express';
import templateController from '../controllers/templateController';
import { authMiddleware, requireTemplatePermission } from '../middleware/templateAuth';

const router = express.Router();

router.post('/match', authMiddleware, requireTemplatePermission('system:template:view'), templateController.matchTemplate);
router.post('/analyze', authMiddleware, requireTemplatePermission('system:template:add'), templateController.analyzeTemplate);
router.post('/save', authMiddleware, requireTemplatePermission('system:template:add'), templateController.saveTemplate);
router.post('/update', authMiddleware, requireTemplatePermission('system:template:edit'), templateController.updateTemplate);
router.get('/:id/versions', authMiddleware, requireTemplatePermission('system:template:view'), templateController.getTemplateVersions);
router.post('/:id/generation-records', authMiddleware, requireTemplatePermission('system:template:view'), templateController.createGenerationRecord);
router.get('/list', authMiddleware, requireTemplatePermission('system:template:view'), templateController.listTemplates);
router.get('/extracted', authMiddleware, requireTemplatePermission('system:template:view'), templateController.getExtractedTemplate);
router.post('/delete', authMiddleware, requireTemplatePermission('system:template:delete'), templateController.deleteTemplate);

export default router;
