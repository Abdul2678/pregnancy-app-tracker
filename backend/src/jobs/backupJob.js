// jobs/backupJob.js
// Daily PostgreSQL backup — pg_dump → gzip → upload to S3/R2.
// Runs at 03:00 UTC every day in production.

'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const { createGzip } = require('zlib');
const { PassThrough } = require('stream');
const cron   = require('node-cron');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

const execFileAsync = promisify(execFile);

let s3;
function getS3() {
  if (!s3) {
    s3 = new S3Client({
      endpoint:    config.backup.s3Endpoint || undefined,
      region:      config.backup.s3Region,
      credentials: {
        accessKeyId:     config.backup.s3AccessKey,
        secretAccessKey: config.backup.s3SecretKey,
      },
    });
  }
  return s3;
}

async function runBackup() {
  if (!config.backup.s3AccessKey) {
    // eslint-disable-next-line no-console
    console.warn('[backup] S3 not configured — skipping backup');
    return;
  }

  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key  = `backups/bloom-${date}.sql.gz`;

  // eslint-disable-next-line no-console
  console.log(`[backup] starting → s3://${config.backup.s3Bucket}/${key}`);

  // Parse DATABASE_URL for pg_dump
  let dbUrl = config.db.url;

  // Stream: pg_dump | gzip | S3 PutObject
  const { stdout } = await execFileAsync('pg_dump', [
    '--no-owner', '--no-acl', '--clean', '--if-exists', dbUrl,
  ], { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 });

  const gz = await new Promise((resolve, reject) => {
    const chunks = [];
    const gzip = createGzip({ level: 6 });
    const pass = new PassThrough();
    pass.end(stdout);
    pass.pipe(gzip);
    gzip.on('data', (c) => chunks.push(c));
    gzip.on('end', () => resolve(Buffer.concat(chunks)));
    gzip.on('error', reject);
  });

  await getS3().send(new PutObjectCommand({
    Bucket:      config.backup.s3Bucket,
    Key:         key,
    Body:        gz,
    ContentType: 'application/gzip',
    Metadata:    { source: 'bloom-backup-job', date },
  }));

  // eslint-disable-next-line no-console
  console.log(`[backup] done — ${(gz.length / 1024).toFixed(0)} KB uploaded`);
}

function scheduleBackupJob() {
  if (!config.isProd) {
    // eslint-disable-next-line no-console
    console.log('[backup] skipping scheduler (not production)');
    return null;
  }

  // 03:00 UTC daily
  const task = cron.schedule('0 3 * * *', async () => {
    try {
      await runBackup();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[backup] failed', err.message);
    }
  });

  // eslint-disable-next-line no-console
  console.log('[backup] scheduled daily at 03:00 UTC');
  return task;
}

module.exports = { scheduleBackupJob, runBackup };
