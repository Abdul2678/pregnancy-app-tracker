// routes/upload.js
// POST /api/upload — resize image with sharp, store on Cloudflare R2, return CDN URL.

'use strict';

const { Router } = require('express');
let multer, sharp, S3Client, PutObjectCommand;
try {
  multer = require('multer');
  sharp  = require('sharp');
  ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
} catch (_) { /* deps not installed — endpoint returns 503 */ }
const { v4: uuidv4 }  = require('uuid');
const { authRequired } = require('../middleware/auth');
const { respond }      = require('../middleware/respond');
const config           = require('../../config');

const router = Router();

// Memory storage — we never write the raw file to disk
// If multer isn't installed the POST handler returns 503
const upload = multer ? multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxUploadBytes },
  fileFilter: (_, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(Object.assign(new Error('Only image files are accepted'), { status: 400 }));
    }
    cb(null, true);
  },
}) : null;

// Lazy-init R2 client so the app still boots without storage config
let r2;
function getR2() {
  if (!r2) {
    if (!config.storage.r2AccessKey) {
      throw Object.assign(new Error('Storage not configured'), { status: 503 });
    }
    r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${config.storage.r2AccountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     config.storage.r2AccessKey,
        secretAccessKey: config.storage.r2SecretKey,
      },
    });
  }
  return r2;
}

/**
 * POST /api/upload
 * Multipart field: "image"
 * Returns: { url: "https://media.bloompregnancy.app/uploads/uuid.webp" }
 */
router.post('/', authRequired, (req, res, next) => {
  if (!upload) return res.status(503).json({ success: false, error: 'Storage not available' });
  upload.single('image')(req, res, next);
}, async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    // Resize + convert to webp — target ≤1 MB stored
    const resized = await sharp(req.file.buffer)
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    const key = `uploads/${uuidv4()}.webp`;

    await getR2().send(new PutObjectCommand({
      Bucket:      config.storage.r2Bucket,
      Key:         key,
      Body:        resized,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        uploadedBy: req.user.id,
        originalName: req.file.originalname.slice(0, 100),
      },
    }));

    const url = `${config.storage.r2PublicUrl}/${key}`;
    respond(res, { url });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
