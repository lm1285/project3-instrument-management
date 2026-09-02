import express from 'express';
import fingerprintService from '../services/fingerprintService';

const router = express.Router();

// Get fingerprint content
router.get('/:fingerprint', async (req, res) => {
  try {
    const { fingerprint } = req.params;
    const result = await fingerprintService.getByFingerprint(fingerprint);
    if (result) {
      res.json({ success: true, content: result.content });
    } else {
      res.status(404).json({ success: false, message: 'Fingerprint not found' });
    }
  } catch (error) {
    console.error('Error fetching fingerprint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Save fingerprint
router.post('/', async (req, res) => {
  try {
    const { fingerprint, content } = req.body;
    if (!fingerprint || !content) {
      return res.status(400).json({ success: false, message: 'Missing fingerprint or content' });
    }
    
    await fingerprintService.saveFingerprint(fingerprint, content);
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving fingerprint:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;
