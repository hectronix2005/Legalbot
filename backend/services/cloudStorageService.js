/**
 * Cloud Storage Service for Template Files
 * Uses Cloudinary for persistent file storage
 *
 * This service handles upload, download, and deletion of Word template files
 * to ensure they persist across Heroku dyno restarts.
 */

const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Check if Cloudinary is properly configured
 */
function isCloudinaryConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

/**
 * Upload a file to Cloudinary
 * @param {string} localFilePath - Path to the local file
 * @param {string} fileName - Original filename for reference
 * @returns {Promise<{url: string, publicId: string, originalName: string}>}
 */
async function uploadFile(localFilePath, fileName) {
  if (!isCloudinaryConfigured()) {
    console.warn('⚠️ Cloudinary not configured - using local storage only');
    return null;
  }

  try {
    console.log('☁️  Uploading file to Cloudinary:', fileName);

    // Upload as raw file (not image) to preserve .docx format
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: 'raw',
      folder: 'legalbot/templates',
      public_id: `template_${Date.now()}_${path.parse(fileName).name}`,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
      tags: ['template', 'word', 'docx']
    });

    console.log('✅ File uploaded to Cloudinary:', result.public_id);
    console.log('📎 URL:', result.secure_url);

    return {
      url: result.secure_url,
      publicId: result.public_id,
      originalName: fileName,
      bytes: result.bytes,
      format: result.format || 'docx'
    };
  } catch (error) {
    console.error('❌ Error uploading to Cloudinary:', error.message);
    throw error;
  }
}

/**
 * Download a file from Cloudinary to local filesystem
 * @param {string} cloudinaryUrl - URL of the file in Cloudinary
 * @param {string} localDestPath - Local path to save the file
 * @returns {Promise<string>} - Local file path
 */
async function downloadFile(cloudinaryUrl, localDestPath) {
  return new Promise((resolve, reject) => {
    console.log('☁️  Downloading file from Cloudinary...');
    console.log('   URL:', cloudinaryUrl);
    console.log('   Dest:', localDestPath);

    // Ensure directory exists
    const dir = path.dirname(localDestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(localDestPath);
    const protocol = cloudinaryUrl.startsWith('https') ? https : http;

    const request = protocol.get(cloudinaryUrl, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        console.log('   Redirecting to:', redirectUrl);
        downloadFile(redirectUrl, localDestPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('✅ File downloaded successfully:', localDestPath);
        resolve(localDestPath);
      });
    });

    request.on('error', (err) => {
      fs.unlink(localDestPath, () => {}); // Delete partial file
      console.error('❌ Download error:', err.message);
      reject(err);
    });

    file.on('error', (err) => {
      fs.unlink(localDestPath, () => {}); // Delete partial file
      console.error('❌ File write error:', err.message);
      reject(err);
    });

    // Set timeout
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error('Download timeout'));
    });
  });
}

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID of the file
 * @returns {Promise<boolean>}
 */
async function deleteFile(publicId) {
  if (!isCloudinaryConfigured() || !publicId) {
    return false;
  }

  try {
    console.log('☁️  Deleting file from Cloudinary:', publicId);

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw'
    });

    console.log('✅ File deleted from Cloudinary:', result);
    return result.result === 'ok';
  } catch (error) {
    console.error('❌ Error deleting from Cloudinary:', error.message);
    return false;
  }
}

/**
 * Get a file buffer from Cloudinary (for processing)
 * Downloads to temp file and reads buffer
 * @param {string} cloudinaryUrl - URL of the file
 * @returns {Promise<Buffer>}
 */
async function getFileBuffer(cloudinaryUrl) {
  const tempDir = path.join(__dirname, '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const tempPath = path.join(tempDir, `temp_${Date.now()}.docx`);

  try {
    await downloadFile(cloudinaryUrl, tempPath);
    const buffer = fs.readFileSync(tempPath);

    // Clean up temp file
    fs.unlinkSync(tempPath);

    return buffer;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    throw error;
  }
}

/**
 * Ensure a template file is available locally
 * If file doesn't exist locally but has cloudinary_url, download it
 * @param {Object} template - Template document from MongoDB
 * @returns {Promise<string>} - Local file path
 */
async function ensureTemplateFileAvailable(template) {
  // Check if local file exists
  if (template.word_file_path && fs.existsSync(template.word_file_path)) {
    console.log('✅ Template file exists locally:', template.word_file_path);
    return template.word_file_path;
  }

  // If we have a Cloudinary URL, download it
  if (template.cloudinary_url) {
    console.log('☁️  Local file missing, downloading from Cloudinary...');

    const tempDir = path.join(__dirname, '../uploads/templates');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const localPath = path.join(tempDir, `template_${template._id}.docx`);
    await downloadFile(template.cloudinary_url, localPath);

    return localPath;
  }

  throw new Error('Template file not available - no local file and no cloud URL');
}

/**
 * Get template file buffer (handles both local and cloud storage)
 * @param {Object} template - Template document from MongoDB
 * @returns {Promise<Buffer>}
 */
async function getTemplateFileBuffer(template) {
  // If local file exists, use it
  if (template.word_file_path && fs.existsSync(template.word_file_path)) {
    console.log('📄 Reading template from local file:', template.word_file_path);
    return fs.readFileSync(template.word_file_path);
  }

  // If Cloudinary URL exists, download and return buffer
  if (template.cloudinary_url) {
    console.log('☁️  Fetching template from Cloudinary:', template.cloudinary_url);
    return await getFileBuffer(template.cloudinary_url);
  }

  throw new Error('Template file not available - no local file and no cloud URL');
}

module.exports = {
  isCloudinaryConfigured,
  uploadFile,
  downloadFile,
  deleteFile,
  getFileBuffer,
  ensureTemplateFileAvailable,
  getTemplateFileBuffer
};
