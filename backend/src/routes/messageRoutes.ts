import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import siteMessageService from '../services/siteMessageService';

const router = Router();

router.use(authMiddleware);

// Get messages for current user
router.get('/', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const messages = await siteMessageService.getMessages(String(user.userId));
    res.json({ success: true, data: messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to fetch messages' });
  }
});

// Mark message as read
router.put('/:id/read', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const success = await siteMessageService.markAsRead(req.params.id, String(user.userId));
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to mark message as read' });
  }
});

// Mark all messages as read
router.put('/read-all', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const success = await siteMessageService.markAllAsRead(String(user.userId));
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to mark all messages as read' });
  }
});

// Delete message
router.delete('/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    
    const success = await siteMessageService.deleteMessage(req.params.id, String(user.userId));
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to delete message' });
  }
});

export default router;
