import { 
  verifyWebhookSignature, 
  validateWebhookHeaders,
  parseWebhookPayload,
  createErrorResponse,
  createSuccessResponse 
} from '../lib/auth.js';
import { 
  downloadImage,
  uploadImageToStorage,
  updateCharacterAspectRatios,
  updateAspectRatioStatus,
  getCharacterById,
  cleanupOldAspectRatioFiles
} from '../lib/supabase.js';
import { 
  processAllAspectRatios,
  validateImageBuffer,
  getImageMetadata 
} from '../lib/imageProcessor.js';

/**
 * Process Aspect Ratios Webhook Endpoint
 * Main endpoint for processing character images into multiple aspect ratios
 */

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Signature');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    const errorResponse = createErrorResponse('Method not allowed', 405);
    return res.status(405).json(errorResponse);
  }

  let characterId = null;
  
  try {
    console.log('[AspectRatio] Received webhook request');
    
    // Validate headers
    const headerValidation = validateWebhookHeaders(req.headers);
    if (!headerValidation.success) {
      console.log('[AspectRatio] Header validation failed:', headerValidation.errors);
      return res.status(400).json(createErrorResponse(
        `Invalid headers: ${headerValidation.errors.join(', ')}`
      ));
    }

    // Get raw body for signature verification
    let rawBody = '';
    if (typeof req.body === 'string') {
      rawBody = req.body;
    } else if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString();
    } else if (req.body && typeof req.body === 'object') {
      rawBody = JSON.stringify(req.body);
    } else {
      return res.status(400).json(createErrorResponse('Invalid request body format'));
    }

    // Verify webhook signature
    const signature = req.headers['x-webhook-signature'];
    const webhookSecret = process.env.WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('[AspectRatio] WEBHOOK_SECRET environment variable not set');
      return res.status(500).json(createErrorResponse('Server configuration error'));
    }

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      console.log('[AspectRatio] Webhook signature verification failed');
      return res.status(401).json(createErrorResponse('Invalid webhook signature'));
    }

    console.log('[AspectRatio] Webhook signature verified');

    // Parse payload
    const payloadResult = parseWebhookPayload(rawBody);
    if (!payloadResult.success) {
      return res.status(400).json(createErrorResponse(payloadResult.error));
    }

    const { characterId: parsedCharacterId, imageUrl, options = {} } = payloadResult.data;
    characterId = parsedCharacterId;
    
    console.log(`[AspectRatio] Processing aspect ratios for character: ${characterId}`);
    console.log(`[AspectRatio] Image URL: ${imageUrl}`);

    // Update status to processing
    await updateAspectRatioStatus(characterId, 'processing');
    console.log('[AspectRatio] Updated character status to processing');

    // Verify character exists
    try {
      await getCharacterById(characterId);
    } catch (error) {
      console.error('[AspectRatio] Character not found:', error);
      await updateAspectRatioStatus(characterId, 'failed', 'Character not found');
      return res.status(404).json(createErrorResponse('Character not found'));
    }

    // Download original image
    console.log('[AspectRatio] Downloading original image...');
    const imageBuffer = await downloadImage(imageUrl, options.timeout || 30000);
    
    // Validate image buffer
    const validation = validateImageBuffer(imageBuffer);
    if (!validation.valid) {
      const errorMsg = `Invalid image: ${validation.error}`;
      console.error('[AspectRatio]', errorMsg);
      await updateAspectRatioStatus(characterId, 'failed', errorMsg);
      return res.status(400).json(createErrorResponse(errorMsg));
    }

    console.log(`[AspectRatio] Image downloaded and validated: ${validation.format}, ${validation.size} bytes`);

    // Get image metadata
    const metadata = await getImageMetadata(imageBuffer);
    console.log(`[AspectRatio] Image metadata:`, {
      dimensions: `${metadata.width}x${metadata.height}`,
      format: metadata.format,
      aspectRatio: metadata.aspectRatio,
      size: metadata.size
    });

    // Process all aspect ratios
    console.log('[AspectRatio] Processing all aspect ratios...');
    const processingResult = await processAllAspectRatios(imageBuffer, characterId);
    
    const { originalAspectRatio, processedImages } = processingResult;
    console.log(`[AspectRatio] Processed ${Object.keys(processedImages).length} aspect ratios`);

    // Upload all processed images
    console.log('[AspectRatio] Uploading processed images...');
    const aspectRatioUrls = {};
    const uploadPromises = [];

    for (const [ratioKey, imageData] of Object.entries(processedImages)) {
      const uploadPromise = uploadImageToStorage(
        imageData.buffer,
        imageData.filename,
        'image/jpeg'
      ).then(result => {
        aspectRatioUrls[ratioKey] = result.publicUrl;
        console.log(`[AspectRatio] Uploaded ${ratioKey}: ${result.publicUrl}`);
      });
      
      uploadPromises.push(uploadPromise);
    }

    await Promise.all(uploadPromises);
    console.log('[AspectRatio] All images uploaded successfully');

    // Update character record with aspect ratio URLs
    console.log('[AspectRatio] Updating character record...');
    await updateCharacterAspectRatios(characterId, aspectRatioUrls, originalAspectRatio);

    // Cleanup old files (non-blocking)
    cleanupOldAspectRatioFiles(characterId).catch(error => {
      console.warn('[AspectRatio] Cleanup warning:', error.message);
    });

    // Prepare response
    const responseData = {
      characterId,
      originalAspectRatio,
      aspectRatioUrls,
      metadata: {
        originalDimensions: `${metadata.width}x${metadata.height}`,
        originalFormat: metadata.format,
        originalSize: metadata.size,
        processedCount: Object.keys(processedImages).length
      },
      processingTime: Date.now() - new Date(req.headers['x-request-start'] || Date.now())
    };

    console.log(`[AspectRatio] Successfully processed aspect ratios for character ${characterId}`);
    
    return res.status(200).json(createSuccessResponse(
      responseData,
      'Aspect ratios processed successfully'
    ));

  } catch (error) {
    console.error('[AspectRatio] Processing error:', error);
    
    // Update character status to failed if we have a characterId
    if (characterId) {
      try {
        await updateAspectRatioStatus(characterId, 'failed', error.message);
      } catch (statusError) {
        console.error('[AspectRatio] Failed to update error status:', statusError);
      }
    }

    // Determine appropriate HTTP status code
    let statusCode = 500;
    if (error.message.includes('not found') || error.message.includes('404')) {
      statusCode = 404;
    } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
      statusCode = 408;
    } else if (error.message.includes('too large') || error.message.includes('limit')) {
      statusCode = 413;
    } else if (error.message.includes('invalid') || error.message.includes('malformed')) {
      statusCode = 400;
    }

    const errorResponse = createErrorResponse(
      `Processing failed: ${error.message}`,
      statusCode
    );
    
    return res.status(statusCode).json(errorResponse);
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}