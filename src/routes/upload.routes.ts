import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import cloudinary from '../utils/cloudinary';
import { authenticate } from '../middleware/auth';

const router = Router();

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Admin: list existing images from Cloudinary
router.get('/images', authenticate, async (_req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'arabesque/products',
      max_results: 500,
    });

    const images = (result.resources || []).map((r: any) => ({
      url: r.secure_url,
      publicId: r.public_id,
    }));

    res.json({ success: true, data: images });
  } catch (err: any) {
    console.error('[Cloudinary List Error]', err);
    res.status(500).json({ success: false, error: { code: 'LIST_ERROR', message: err?.message || 'Failed to list images' } });
  }
});

router.post('/', authenticate, uploadLimiter, upload.single('image'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: { code: 'NO_FILE', message: 'No image provided' } });
    return;
  }

  try {
    const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'arabesque/products', resource_type: 'image' },
        (error, result) => {
          if (error || !result) reject(error || new Error('Upload failed'));
          else resolve(result as any);
        }
      );
      stream.end(req.file!.buffer);
    });

    res.json({ success: true, data: { url: result.secure_url, publicId: result.public_id } });
  } catch (err: any) {
    console.error('[Upload Error]', err);
    res.status(500).json({ success: false, error: { code: 'UPLOAD_ERROR', message: err?.message || 'Failed to upload image' } });
  }
});

export default router;
