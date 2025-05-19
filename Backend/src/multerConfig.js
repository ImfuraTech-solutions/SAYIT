// multerConfig.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinaryConfig');
const crypto = require('crypto');

const getCloudinaryStorage = (folderName) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      // Dynamically determine resource type based on file mimetype
      resource_type: (req, file) => {
        if (file.mimetype.startsWith('image/')) return 'image';
        if (file.mimetype.startsWith('video/')) return 'video';
        if (file.mimetype.startsWith('audio/')) return 'video'; // Cloudinary handles audio files as video resource type
        return 'raw'; // For documents and other files
      },
      // Determine format based on mimetype
      format: async (req, file) => {
        // Extract format from mimetype (e.g., 'image/png' -> 'png')
        const format = file.mimetype.split('/')[1];
        
        // If format is jpeg, return jpg (Cloudinary preference)
        if (format === 'jpeg') return 'jpg';
        
        // For other formats, use the extracted format or default to raw
        return format || 'raw';
      },
      // Generate unique public_id to prevent filename conflicts
      public_id: (req, file) => {
        const filename = file.originalname.split('.')[0];
        const uniqueSuffix = crypto.randomBytes(6).toString('hex');
        return `${filename}-${uniqueSuffix}`;
      },
      // Add transformation options for better performance
      transformation: [
        { quality: 'auto', fetch_format: 'auto' }
      ]
    },
  });
};

// Helper to create robust file upload middleware
const createUploadMiddleware = (folderName, fileLimit = 5) => {
  const storage = getCloudinaryStorage(folderName);
  
  return multer({
    storage,
    limits: { 
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: fileLimit 
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        // Images
        'image/jpeg', 'image/png', 'image/gif',
        // Videos
        'video/mp4', 'video/quicktime', 'video/x-msvideo',
        // Audio
        'audio/mpeg', 'audio/wav', 'audio/ogg',
        // Documents
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'), false);
      }
    }
  });
};

module.exports = {
  getCloudinaryStorage,
  createUploadMiddleware
};