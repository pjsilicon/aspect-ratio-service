import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Database and Storage Utilities
 * Handles all Supabase interactions for the aspect ratio processing service
 */

// Initialize Supabase client
let supabaseClient = null;

/**
 * Get or create Supabase client instance
 * @returns {Object} Supabase client
 */
export function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase environment variables');
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  
  return supabaseClient;
}

/**
 * Upload processed image to Supabase storage
 * @param {Buffer} imageBuffer - Processed image buffer
 * @param {string} fileName - File name for storage
 * @param {string} contentType - MIME type
 * @returns {Promise<Object>} Upload result with public URL
 */
export async function uploadImageToStorage(imageBuffer, fileName, contentType = 'image/jpeg') {
  try {
    const supabase = getSupabaseClient();
    
    console.log(`[Supabase] Uploading image: ${fileName}`);
    
    const { data, error } = await supabase.storage
      .from('uploads')
      .upload(fileName, imageBuffer, {
        contentType,
        upsert: false
      });
    
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);
    
    console.log(`[Supabase] Image uploaded successfully: ${urlData.publicUrl}`);
    
    return {
      success: true,
      path: data.path,
      publicUrl: urlData.publicUrl
    };
  } catch (error) {
    console.error('[Supabase] Upload error:', error);
    throw error;
  }
}

/**
 * Update character record with aspect ratio URLs
 * @param {string} characterId - Character ID
 * @param {Object} aspectRatioUrls - URLs for different aspect ratios
 * @param {string} originalAspectRatio - Original detected aspect ratio
 * @returns {Promise<Object>} Update result
 */
export async function updateCharacterAspectRatios(characterId, aspectRatioUrls, originalAspectRatio) {
  try {
    const supabase = getSupabaseClient();
    
    console.log(`[Supabase] Updating character ${characterId} with aspect ratio URLs`);
    
    const updateData = {
      aspect_ratio_1x1_url: aspectRatioUrls['1x1'],
      aspect_ratio_16x9_url: aspectRatioUrls['16x9'],
      aspect_ratio_9x16_url: aspectRatioUrls['9x16'],
      original_aspect_ratio: originalAspectRatio,
      aspect_ratio_status: 'completed',
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('characters')
      .update(updateData)
      .eq('id', characterId)
      .select();
    
    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }
    
    console.log(`[Supabase] Character updated successfully`);
    
    return {
      success: true,
      data: data[0]
    };
  } catch (error) {
    console.error('[Supabase] Update error:', error);
    throw error;
  }
}

/**
 * Get character data by ID
 * @param {string} characterId - Character ID
 * @returns {Promise<Object>} Character data
 */
export async function getCharacterById(characterId) {
  try {
    const supabase = getSupabaseClient();
    
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .eq('id', characterId)
      .single();
    
    if (error) {
      throw new Error(`Failed to get character: ${error.message}`);
    }
    
    return {
      success: true,
      data
    };
  } catch (error) {
    console.error('[Supabase] Get character error:', error);
    throw error;
  }
}

/**
 * Update character aspect ratio status
 * @param {string} characterId - Character ID
 * @param {string} status - Status (processing, completed, failed)
 * @param {string} errorMessage - Optional error message
 * @returns {Promise<Object>} Update result
 */
export async function updateAspectRatioStatus(characterId, status, errorMessage = null) {
  try {
    const supabase = getSupabaseClient();
    
    const updateData = {
      aspect_ratio_status: status,
      updated_at: new Date().toISOString()
    };
    
    if (errorMessage) {
      updateData.aspect_ratio_error = errorMessage;
    }
    
    const { data, error } = await supabase
      .from('characters')
      .update(updateData)
      .eq('id', characterId)
      .select();
    
    if (error) {
      throw new Error(`Status update failed: ${error.message}`);
    }
    
    console.log(`[Supabase] Updated character ${characterId} status to ${status}`);
    
    return {
      success: true,
      data: data[0]
    };
  } catch (error) {
    console.error('[Supabase] Status update error:', error);
    throw error;
  }
}

/**
 * Download image from URL with timeout
 * @param {string} imageUrl - Image URL to download
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Buffer>} Image buffer
 */
export async function downloadImage(imageUrl, timeout = 30000) {
  try {
    console.log(`[Supabase] Downloading image from: ${imageUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'image/*'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    console.log(`[Supabase] Image downloaded successfully, size: ${buffer.length} bytes`);
    
    return buffer;
  } catch (error) {
    console.error('[Supabase] Download error:', error);
    throw error;
  }
}

/**
 * Cleanup old aspect ratio files for a character
 * @param {string} characterId - Character ID
 * @returns {Promise<void>}
 */
export async function cleanupOldAspectRatioFiles(characterId) {
  try {
    const supabase = getSupabaseClient();
    
    // List files in the character's aspect-ratios folder
    const { data: files, error } = await supabase.storage
      .from('uploads')
      .list(`characters/${characterId}/aspect-ratios`);
    
    if (error) {
      console.warn(`[Supabase] Could not list files for cleanup: ${error.message}`);
      return;
    }
    
    if (!files || files.length === 0) {
      return;
    }
    
    // Remove old files (keep only the most recent ones)
    const filesToRemove = files
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(3) // Keep latest 3 files
      .map(file => `characters/${characterId}/aspect-ratios/${file.name}`);
    
    if (filesToRemove.length > 0) {
      const { error: removeError } = await supabase.storage
        .from('uploads')
        .remove(filesToRemove);
      
      if (removeError) {
        console.warn(`[Supabase] Cleanup warning: ${removeError.message}`);
      } else {
        console.log(`[Supabase] Cleaned up ${filesToRemove.length} old files`);
      }
    }
  } catch (error) {
    console.warn('[Supabase] Cleanup error:', error);
    // Don't throw - cleanup is not critical
  }
}