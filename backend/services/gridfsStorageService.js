/**
 * GridFS Storage Service for Template Files
 * Uses MongoDB GridFS for persistent file storage
 *
 * This service handles upload, download, and deletion of Word template files
 * directly in MongoDB, ensuring persistence across Heroku dyno restarts.
 */

const mongoose = require('mongoose');
const { GridFSBucket, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

let bucket = null;

/**
 * Initialize GridFS bucket
 */
function initBucket() {
  if (!bucket && mongoose.connection.db) {
    bucket = new GridFSBucket(mongoose.connection.db, {
      bucketName: 'templates'
    });
    console.log('✅ GridFS bucket initialized: templates');
  }
  return bucket;
}

/**
 * Wait for MongoDB connection and initialize bucket
 */
async function ensureBucket() {
  if (bucket) return bucket;

  // Wait for connection if not ready
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      mongoose.connection.once('connected', resolve);
    });
  }

  return initBucket();
}

/**
 * Upload a file to GridFS
 * @param {string} localFilePath - Path to the local file
 * @param {string} fileName - Original filename for reference
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise<{fileId: string, fileName: string, size: number}>}
 */
async function uploadFile(localFilePath, fileName, metadata = {}) {
  const gridBucket = await ensureBucket();

  return new Promise((resolve, reject) => {
    console.log('📦 Uploading file to GridFS:', fileName);

    const uploadStream = gridBucket.openUploadStream(fileName, {
      metadata: {
        ...metadata,
        originalName: fileName,
        uploadedAt: new Date(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    const readStream = fs.createReadStream(localFilePath);

    readStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      console.error('❌ GridFS upload error:', error.message);
      reject(error);
    });

    uploadStream.on('finish', () => {
      console.log('✅ File uploaded to GridFS:', uploadStream.id.toString());
      resolve({
        fileId: uploadStream.id.toString(),
        fileName: fileName,
        size: uploadStream.length
      });
    });
  });
}

/**
 * Upload a buffer to GridFS
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - Original filename for reference
 * @param {Object} metadata - Additional metadata to store
 * @returns {Promise<{fileId: string, fileName: string, size: number}>}
 */
async function uploadBuffer(buffer, fileName, metadata = {}) {
  const gridBucket = await ensureBucket();

  return new Promise((resolve, reject) => {
    console.log('📦 Uploading buffer to GridFS:', fileName);

    const uploadStream = gridBucket.openUploadStream(fileName, {
      metadata: {
        ...metadata,
        originalName: fileName,
        uploadedAt: new Date(),
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
    });

    const bufferStream = new stream.PassThrough();
    bufferStream.end(buffer);

    bufferStream.pipe(uploadStream);

    uploadStream.on('error', (error) => {
      console.error('❌ GridFS upload error:', error.message);
      reject(error);
    });

    uploadStream.on('finish', () => {
      console.log('✅ Buffer uploaded to GridFS:', uploadStream.id.toString());
      resolve({
        fileId: uploadStream.id.toString(),
        fileName: fileName,
        size: uploadStream.length
      });
    });
  });
}

/**
 * Download a file from GridFS to buffer
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<Buffer>}
 */
async function downloadToBuffer(fileId) {
  const gridBucket = await ensureBucket();

  return new Promise((resolve, reject) => {
    console.log('📥 Downloading from GridFS:', fileId);

    const chunks = [];
    const downloadStream = gridBucket.openDownloadStream(new ObjectId(fileId));

    downloadStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    downloadStream.on('error', (error) => {
      console.error('❌ GridFS download error:', error.message);
      reject(error);
    });

    downloadStream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log('✅ Downloaded from GridFS:', buffer.length, 'bytes');
      resolve(buffer);
    });
  });
}

/**
 * Download a file from GridFS to local file
 * @param {string} fileId - GridFS file ID
 * @param {string} localDestPath - Local path to save the file
 * @returns {Promise<string>} - Local file path
 */
async function downloadToFile(fileId, localDestPath) {
  const gridBucket = await ensureBucket();

  return new Promise((resolve, reject) => {
    console.log('📥 Downloading from GridFS to file:', localDestPath);

    // Ensure directory exists
    const dir = path.dirname(localDestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const downloadStream = gridBucket.openDownloadStream(new ObjectId(fileId));
    const writeStream = fs.createWriteStream(localDestPath);

    downloadStream.pipe(writeStream);

    downloadStream.on('error', (error) => {
      console.error('❌ GridFS download error:', error.message);
      fs.unlink(localDestPath, () => {}); // Clean up partial file
      reject(error);
    });

    writeStream.on('error', (error) => {
      console.error('❌ File write error:', error.message);
      fs.unlink(localDestPath, () => {}); // Clean up partial file
      reject(error);
    });

    writeStream.on('finish', () => {
      console.log('✅ File downloaded to:', localDestPath);
      resolve(localDestPath);
    });
  });
}

/**
 * Delete a file from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<boolean>}
 */
async function deleteFile(fileId) {
  if (!fileId) return false;

  const gridBucket = await ensureBucket();

  try {
    console.log('🗑️  Deleting from GridFS:', fileId);
    await gridBucket.delete(new ObjectId(fileId));
    console.log('✅ File deleted from GridFS');
    return true;
  } catch (error) {
    console.error('❌ GridFS delete error:', error.message);
    return false;
  }
}

/**
 * Get file info from GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<Object|null>}
 */
async function getFileInfo(fileId) {
  const gridBucket = await ensureBucket();

  try {
    const cursor = gridBucket.find({ _id: new ObjectId(fileId) });
    const files = await cursor.toArray();
    return files.length > 0 ? files[0] : null;
  } catch (error) {
    console.error('❌ GridFS getFileInfo error:', error.message);
    return null;
  }
}

/**
 * Check if file exists in GridFS
 * @param {string} fileId - GridFS file ID
 * @returns {Promise<boolean>}
 */
async function fileExists(fileId) {
  if (!fileId) return false;
  const info = await getFileInfo(fileId);
  return info !== null;
}

/**
 * Get download stream for streaming file directly to response
 * @param {string} fileId - GridFS file ID
 * @returns {ReadableStream}
 */
async function getDownloadStream(fileId) {
  const gridBucket = await ensureBucket();
  return gridBucket.openDownloadStream(new ObjectId(fileId));
}

/**
 * Get template file buffer (handles both local and GridFS storage)
 * @param {Object} template - Template document from MongoDB
 * @returns {Promise<Buffer>}
 */
async function getTemplateFileBuffer(template) {
  // First try GridFS if we have a fileId
  if (template.gridfs_file_id) {
    console.log('📦 Reading template from GridFS:', template.gridfs_file_id);
    try {
      return await downloadToBuffer(template.gridfs_file_id);
    } catch (error) {
      console.error('⚠️ GridFS download failed:', error.message);
      // Fall through to try local file
    }
  }

  // Try Cloudinary if available (backward compatibility)
  if (template.cloudinary_url) {
    console.log('☁️  Cloudinary URL found but GridFS preferred - skipping');
  }

  // Try local file as last resort
  if (template.word_file_path && fs.existsSync(template.word_file_path)) {
    console.log('📄 Reading template from local file:', template.word_file_path);
    return fs.readFileSync(template.word_file_path);
  }

  throw new Error('Template file not available - no GridFS file and no local file');
}

/**
 * Ensure a template file is available (for operations that need a local file)
 * @param {Object} template - Template document from MongoDB
 * @returns {Promise<string>} - Local file path
 */
async function ensureTemplateFileAvailable(template) {
  // Check if local file exists
  if (template.word_file_path && fs.existsSync(template.word_file_path)) {
    console.log('✅ Template file exists locally:', template.word_file_path);
    return template.word_file_path;
  }

  // If we have a GridFS file, download it
  if (template.gridfs_file_id) {
    console.log('📦 Local file missing, downloading from GridFS...');

    const tempDir = path.join(__dirname, '../uploads/templates');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const localPath = path.join(tempDir, `template_${template._id}.docx`);
    await downloadToFile(template.gridfs_file_id, localPath);

    return localPath;
  }

  throw new Error('Template file not available - no GridFS file and no local file');
}

// Initialize bucket when mongoose connects
mongoose.connection.on('connected', () => {
  initBucket();
});

module.exports = {
  uploadFile,
  uploadBuffer,
  downloadToBuffer,
  downloadToFile,
  deleteFile,
  getFileInfo,
  fileExists,
  getDownloadStream,
  getTemplateFileBuffer,
  ensureTemplateFileAvailable,
  ensureBucket
};
