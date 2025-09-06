import crypto from 'crypto';

/**
 * Webhook Security Utilities
 * Handles secure webhook verification for the aspect ratio processing service
 */

/**
 * Verify webhook signature using HMAC-SHA256
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from request headers
 * @param {string} secret - Webhook secret
 * @returns {boolean} True if signature is valid
 */
export function verifyWebhookSignature(payload, signature, secret) {
  try {
    if (!payload || !signature || !secret) {
      console.log('[WebhookSecurity] Missing required parameters for signature verification');
      return false;
    }

    // Remove 'sha256=' prefix if present
    const cleanSignature = signature.replace(/^sha256=/, '');
    
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');

    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error('[WebhookSecurity] Error verifying signature:', error);
    return false;
  }
}

/**
 * Generate a webhook signature for testing
 * @param {string} payload - Payload to sign
 * @param {string} secret - Secret to use for signing
 * @returns {string} Signed payload signature with sha256= prefix
 */
export function generateWebhookSignature(payload, secret) {
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');
  
  return `sha256=${signature}`;
}

/**
 * Validate required webhook headers
 * @param {Object} headers - Request headers
 * @returns {Object} Validation result with success flag and errors
 */
export function validateWebhookHeaders(headers) {
  const errors = [];
  
  if (!headers['content-type']?.includes('application/json')) {
    errors.push('Missing or invalid Content-Type header');
  }
  
  if (!headers['x-webhook-signature']) {
    errors.push('Missing X-Webhook-Signature header');
  }
  
  return {
    success: errors.length === 0,
    errors
  };
}

/**
 * Extract and validate webhook payload
 * @param {string} body - Raw request body
 * @returns {Object} Parsed payload or null if invalid
 */
export function parseWebhookPayload(body) {
  try {
    if (!body) {
      throw new Error('Empty request body');
    }
    
    const payload = JSON.parse(body);
    
    // Validate required fields
    if (!payload.characterId) {
      throw new Error('Missing characterId in payload');
    }
    
    if (!payload.imageUrl) {
      throw new Error('Missing imageUrl in payload');
    }
    
    return {
      success: true,
      data: payload
    };
  } catch (error) {
    console.error('[WebhookSecurity] Error parsing payload:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create a standardized error response
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @returns {Object} Error response object
 */
export function createErrorResponse(message, statusCode = 400) {
  return {
    success: false,
    error: message,
    statusCode,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a standardized success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Success response object
 */
export function createSuccessResponse(data = {}, message = 'Success') {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  };
}