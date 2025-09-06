import { createSuccessResponse, createErrorResponse } from '../lib/auth.js';
import { getSupabaseClient } from '../lib/supabase.js';

/**
 * Health Check Endpoint
 * Verifies service status and dependencies
 */

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    const errorResponse = createErrorResponse('Method not allowed', 405);
    return res.status(405).json(errorResponse);
  }

  try {
    console.log('[Health] Starting health check');
    
    const healthStatus = {
      service: 'aspect-ratio-service',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: {}
    };

    // Check environment variables
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'WEBHOOK_SECRET'
    ];

    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    healthStatus.checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      message: missingEnvVars.length === 0 
        ? 'All required environment variables are set'
        : `Missing environment variables: ${missingEnvVars.join(', ')}`,
      requiredVars: requiredEnvVars,
      missingVars: missingEnvVars
    };

    // Check Supabase connection
    try {
      const supabase = getSupabaseClient();
      
      // Simple query to test connection
      const { data, error } = await supabase
        .from('characters')
        .select('count')
        .limit(1);
      
      if (error && !error.message.includes('column "count" does not exist')) {
        throw error;
      }
      
      healthStatus.checks.supabase = {
        status: 'healthy',
        message: 'Supabase connection successful',
        url: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : 'not configured'
      };
    } catch (error) {
      console.error('[Health] Supabase check failed:', error);
      healthStatus.checks.supabase = {
        status: 'unhealthy',
        message: `Supabase connection failed: ${error.message}`,
        url: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/+$/, '') : 'not configured'
      };
      healthStatus.status = 'unhealthy';
    }

    // Check Sharp library
    try {
      const sharp = await import('sharp');
      const sharpVersion = sharp.default().constructor.version || 'unknown';
      
      // Test Sharp with a simple operation
      await sharp.default({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 0, g: 0, b: 0 }
        }
      })
      .jpeg()
      .toBuffer();
      
      healthStatus.checks.sharp = {
        status: 'healthy',
        message: 'Sharp image processing library working correctly',
        version: sharpVersion
      };
    } catch (error) {
      console.error('[Health] Sharp check failed:', error);
      healthStatus.checks.sharp = {
        status: 'unhealthy',
        message: `Sharp library error: ${error.message}`,
        version: 'unknown'
      };
      healthStatus.status = 'unhealthy';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryMB = {
      rss: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round(memoryUsage.external / 1024 / 1024)
    };
    
    healthStatus.checks.memory = {
      status: memoryMB.heapUsed < 900 ? 'healthy' : 'warning', // Warning if using more than 900MB
      message: `Memory usage: ${memoryMB.heapUsed}MB of ${memoryMB.heapTotal}MB heap`,
      usage: memoryMB
    };

    // Overall status
    const hasUnhealthy = Object.values(healthStatus.checks).some(check => check.status === 'unhealthy');
    if (hasUnhealthy) {
      healthStatus.status = 'unhealthy';
    } else {
      const hasWarning = Object.values(healthStatus.checks).some(check => check.status === 'warning');
      if (hasWarning) {
        healthStatus.status = 'warning';
      }
    }

    console.log(`[Health] Health check completed with status: ${healthStatus.status}`);

    // Return appropriate HTTP status
    const httpStatus = healthStatus.status === 'healthy' ? 200 : 
                      healthStatus.status === 'warning' ? 200 : 503;

    return res.status(httpStatus).json(createSuccessResponse(healthStatus, 'Health check completed'));

  } catch (error) {
    console.error('[Health] Health check failed:', error);
    
    const errorResponse = createErrorResponse(
      `Health check failed: ${error.message}`,
      503
    );
    
    return res.status(503).json(errorResponse);
  }
}