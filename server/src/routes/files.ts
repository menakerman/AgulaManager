import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDatabase } from '../db/database';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'data', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

const router = Router();

// POST /api/files/upload - Upload attachment
router.post('/upload', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const cartId = req.body.cart_id;
    if (!cartId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: 'cart_id is required' });
      return;
    }

    const db = getDatabase();
    const result = db.prepare(
      'INSERT INTO attachments (cart_id, filename, filepath) VALUES (?, ?, ?)'
    ).run(cartId, req.file.originalname, req.file.filename);

    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?')
      .get(result.lastInsertRowid);

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Error uploading file:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// GET /api/files/:cartId - List cart attachments
router.get('/:cartId', (req: Request, res: Response) => {
  try {
    const { cartId } = req.params;
    const db = getDatabase();

    const attachments = db.prepare(
      'SELECT * FROM attachments WHERE cart_id = ? ORDER BY uploaded_at DESC'
    ).all(cartId);

    res.json(attachments);
  } catch (err) {
    console.error('Error fetching attachments:', err);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// GET /api/files/download/:filename - Download file
router.get('/download/:filename', (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(UPLOAD_DIR, filename);

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.download(filePath);
  } catch (err) {
    console.error('Error downloading file:', err);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

export default router;
