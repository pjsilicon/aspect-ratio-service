import sharp from 'sharp';

/**
 * Image Processing Utilities using Sharp
 * Handles aspect ratio processing with black padding for CharFlow Studio
 */

/**
 * Target dimensions for each aspect ratio
 * Optimized for nano-banana and video generation
 */
const ASPECT_RATIO_DIMENSIONS = {
  '1:1': { width: 1024, height: 1024 },
  '16:9': { width: 1024, height: 576 },
  '9:16': { width: 576, height: 1024 }
};

/**
 * Detect the aspect ratio of an image from its dimensions
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {string} Detected aspect ratio ('1:1', '16:9', '9:16', or 'other')
 */
export function detectAspectRatio(width, height) {
  const ratio = width / height;
  const tolerance = 0.05; // 5% tolerance
  
  // Check for 1:1 (square)
  if (Math.abs(ratio - 1) < tolerance) {
    return '1:1';
  }
  
  // Check for 16:9 (landscape)
  if (Math.abs(ratio - (16/9)) < tolerance) {
    return '16:9';
  }
  
  // Check for 9:16 (portrait)
  if (Math.abs(ratio - (9/16)) < tolerance) {
    return '9:16';
  }
  
  return 'other';
}

/**
 * Create a padded image with black background to fit target dimensions
 * @param {Buffer} imageBuffer - Original image buffer
 * @param {number} targetWidth - Target width
 * @param {number} targetHeight - Target height
 * @returns {Promise<Buffer>} Processed image buffer
 */
export async function createPaddedImage(imageBuffer, targetWidth, targetHeight) {
  try {
    console.log(`[ImageProcessor] Creating padded image: ${targetWidth}x${targetHeight}`);
    
    // Get original image metadata
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    
    console.log(`[ImageProcessor] Original dimensions: ${originalWidth}x${originalHeight}`);
    
    // Calculate scaling to fit within target dimensions while preserving aspect ratio
    const scaleWidth = targetWidth / originalWidth;
    const scaleHeight = targetHeight / originalHeight;
    const scale = Math.min(scaleWidth, scaleHeight);
    
    const newWidth = Math.round(originalWidth * scale);
    const newHeight = Math.round(originalHeight * scale);
    
    console.log(`[ImageProcessor] Scaled dimensions: ${newWidth}x${newHeight} (scale: ${scale.toFixed(3)})`);
    
    // Resize the image
    const resizedImage = await image
      .resize(newWidth, newHeight, {
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: false
      })
      .jpeg({
        quality: 85,
        progressive: true,
        mozjpeg: true
      })
      .toBuffer();
    
    // Create a black background and composite the resized image
    const paddedImage = await sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 } // Black background
      }
    })
    .jpeg({
      quality: 85,
      progressive: true,
      mozjpeg: true
    })
    .composite([{
      input: resizedImage,
      top: Math.round((targetHeight - newHeight) / 2),
      left: Math.round((targetWidth - newWidth) / 2)
    }])
    .toBuffer();
    
    console.log(`[ImageProcessor] Padded image created successfully, size: ${paddedImage.length} bytes`);
    
    return paddedImage;
  } catch (error) {
    console.error('[ImageProcessor] Error creating padded image:', error);
    throw new Error(`Image processing failed: ${error.message}`);
  }
}

/**
 * Process image to create all aspect ratio versions
 * @param {Buffer} originalImageBuffer - Original image buffer
 * @param {string} characterId - Character ID for file naming
 * @returns {Promise<Object>} Object containing all processed aspect ratio buffers
 */
export async function processAllAspectRatios(originalImageBuffer, characterId) {
  try {
    console.log(`[ImageProcessor] Processing all aspect ratios for character: ${characterId}`);
    
    // Get original image metadata
    const metadata = await sharp(originalImageBuffer).metadata();
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    const originalRatio = detectAspectRatio(originalWidth, originalHeight);
    
    console.log(`[ImageProcessor] Original: ${originalWidth}x${originalHeight}, ratio: ${originalRatio}`);
    
    const timestamp = Date.now();
    const results = {
      originalAspectRatio: originalRatio,
      processedImages: {}
    };
    
    // Process each target aspect ratio
    for (const [ratioKey, dimensions] of Object.entries(ASPECT_RATIO_DIMENSIONS)) {
      const outputKey = ratioKey.replace(':', 'x'); // Convert '1:1' to '1x1'
      
      if (originalRatio === ratioKey) {
        // Image is already the correct ratio - just optimize
        console.log(`[ImageProcessor] Using original for ${ratioKey} (already correct ratio)`);
        
        const optimizedImage = await sharp(originalImageBuffer)
          .resize(dimensions.width, dimensions.height, {
            fit: 'inside',
            withoutEnlargement: false
          })
          .jpeg({
            quality: 85,
            progressive: true,
            mozjpeg: true
          })
          .toBuffer();
        
        results.processedImages[outputKey] = {
          buffer: optimizedImage,
          filename: `characters/${characterId}/aspect-ratios/${outputKey}-${timestamp}.jpg`
        };
      } else {
        // Create padded version
        console.log(`[ImageProcessor] Creating padded version for ${ratioKey}`);
        
        const paddedImage = await createPaddedImage(
          originalImageBuffer,
          dimensions.width,
          dimensions.height
        );
        
        results.processedImages[outputKey] = {
          buffer: paddedImage,
          filename: `characters/${characterId}/aspect-ratios/${outputKey}-${timestamp}.jpg`
        };
      }
    }
    
    console.log(`[ImageProcessor] Successfully processed all aspect ratios for character ${characterId}`);
    
    return results;
  } catch (error) {
    console.error('[ImageProcessor] Error processing aspect ratios:', error);
    throw error;
  }
}

/**
 * Optimize image for web delivery
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Object} options - Optimization options
 * @returns {Promise<Buffer>} Optimized image buffer
 */
export async function optimizeImage(imageBuffer, options = {}) {
  try {
    const {
      width = null,
      height = null,
      quality = 85,
      format = 'jpeg',
      progressive = true
    } = options;
    
    let pipeline = sharp(imageBuffer);
    
    // Resize if dimensions provided
    if (width || height) {
      pipeline = pipeline.resize(width, height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Apply format-specific optimizations
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({
        quality,
        progressive,
        mozjpeg: true
      });
    } else if (format === 'png') {
      pipeline = pipeline.png({
        quality,
        progressive,
        compressionLevel: 9
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({
        quality,
        effort: 6
      });
    }
    
    return await pipeline.toBuffer();
  } catch (error) {
    console.error('[ImageProcessor] Error optimizing image:', error);
    throw error;
  }
}

/**
 * Get image metadata
 * @param {Buffer} imageBuffer - Image buffer
 * @returns {Promise<Object>} Image metadata
 */
export async function getImageMetadata(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: imageBuffer.length,
      aspectRatio: detectAspectRatio(metadata.width, metadata.height),
      hasAlpha: metadata.hasAlpha || false,
      orientation: metadata.orientation || 1
    };
  } catch (error) {
    console.error('[ImageProcessor] Error getting metadata:', error);
    throw error;
  }
}

/**
 * Validate image buffer
 * @param {Buffer} imageBuffer - Image buffer to validate
 * @returns {Object} Validation result
 */
export function validateImageBuffer(imageBuffer) {
  if (!Buffer.isBuffer(imageBuffer)) {
    return {
      valid: false,
      error: 'Input is not a valid buffer'
    };
  }
  
  if (imageBuffer.length === 0) {
    return {
      valid: false,
      error: 'Image buffer is empty'
    };
  }
  
  // Check for common image format signatures
  const signatures = {
    jpeg: [0xFF, 0xD8],
    png: [0x89, 0x50, 0x4E, 0x47],
    webp: [0x52, 0x49, 0x46, 0x46],
    gif: [0x47, 0x49, 0x46]
  };
  
  let detectedFormat = 'unknown';
  for (const [format, sig] of Object.entries(signatures)) {
    if (imageBuffer.length >= sig.length) {
      const match = sig.every((byte, index) => imageBuffer[index] === byte);
      if (match) {
        detectedFormat = format;
        break;
      }
    }
  }
  
  if (detectedFormat === 'unknown') {
    return {
      valid: false,
      error: 'Unrecognized image format'
    };
  }
  
  return {
    valid: true,
    format: detectedFormat,
    size: imageBuffer.length
  };
}