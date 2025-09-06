# Aspect Ratio Processing Service

A Node.js microservice for processing character images into multiple aspect ratios with black padding, designed for deployment on Vercel. This service creates 1:1, 16:9, and 9:16 versions of images for the CharFlow Studio application.

## Features

- **Multi-Aspect Ratio Processing**: Creates 1:1, 16:9, and 9:16 versions with black padding
- **Sharp Image Processing**: High-quality image processing using the Sharp library
- **Webhook Security**: HMAC-SHA256 signature verification for secure webhooks
- **Supabase Integration**: Seamless integration with Supabase storage and database
- **Health Monitoring**: Built-in health check endpoint for monitoring
- **Error Handling**: Comprehensive error handling with detailed logging
- **Vercel Optimized**: Configured for optimal deployment on Vercel

## Architecture

```
aspect-ratio-service/
├── api/                          # Vercel serverless functions
│   ├── health.js                 # Health check endpoint
│   └── process.js               # Main webhook processor
├── lib/                          # Shared utilities
│   ├── imageProcessor.js        # Sharp-based image processing
│   ├── supabase.js              # Database and storage utilities
│   └── auth.js                  # Security and validation utilities
├── package.json                  # Dependencies and scripts
├── vercel.json                  # Vercel deployment configuration
├── .env.example                 # Environment variable template
└── README.md                    # This file
```

## Quick Start

### 1. Environment Setup

Copy the environment template and configure your variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
WEBHOOK_SECRET=your_webhook_secret_here
NODE_ENV=development
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Local Development

```bash
npm run dev
```

The service will be available at `http://localhost:3000`

### 4. Test Health Check

```bash
curl http://localhost:3000/api/health
```

## Deployment

### Vercel Deployment

1. **Connect Repository**: Link your GitHub repository to Vercel

2. **Configure Environment Variables**:
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add the following variables:
     ```
     SUPABASE_URL=https://your-project.supabase.co
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
     WEBHOOK_SECRET=your_webhook_secret_here
     NODE_ENV=production
     ```

3. **Deploy**:
   ```bash
   npm run deploy
   ```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for database access | Yes |
| `WEBHOOK_SECRET` | Secret for webhook signature verification | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## API Endpoints

### Health Check
- **Endpoint**: `GET /api/health`
- **Description**: Service health and dependency status
- **Response**: Health status with detailed checks

```bash
curl https://your-app.vercel.app/api/health
```

### Process Aspect Ratios
- **Endpoint**: `POST /api/process-aspect-ratios`
- **Description**: Process image into multiple aspect ratios
- **Headers**: 
  - `Content-Type: application/json`
  - `X-Webhook-Signature: sha256=signature`

**Request Body**:
```json
{
  "characterId": "uuid-of-character",
  "imageUrl": "https://example.com/image.jpg",
  "options": {
    "timeout": 30000
  }
}
```

**Response**:
```json
{
  "success": true,
  "message": "Aspect ratios processed successfully",
  "data": {
    "characterId": "uuid-of-character",
    "originalAspectRatio": "16:9",
    "aspectRatioUrls": {
      "1x1": "https://supabase.co/storage/v1/object/public/uploads/...",
      "16x9": "https://supabase.co/storage/v1/object/public/uploads/...",
      "9x16": "https://supabase.co/storage/v1/object/public/uploads/..."
    },
    "metadata": {
      "originalDimensions": "1024x576",
      "originalFormat": "jpeg",
      "originalSize": 245760,
      "processedCount": 3
    }
  }
}
```

## Webhook Integration

### Signature Verification

The service uses HMAC-SHA256 for webhook signature verification:

```javascript
const crypto = require('crypto');

const payload = JSON.stringify(requestBody);
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payload)
  .digest('hex');

const header = `sha256=${signature}`;
```

### Example Webhook Call

```bash
curl -X POST https://your-app.vercel.app/api/process-aspect-ratios \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: sha256=calculated_signature" \
  -d '{
    "characterId": "12345678-1234-1234-1234-123456789abc",
    "imageUrl": "https://example.com/character-image.jpg"
  }'
```

## Image Processing Details

### Aspect Ratios

The service processes images into three standard aspect ratios:

- **1:1 (Square)**: 1024x1024px - Optimal for social media and profile images
- **16:9 (Landscape)**: 1024x576px - Standard video/presentation format  
- **9:16 (Portrait)**: 576x1024px - Mobile-optimized vertical format

### Processing Logic

1. **Download**: Fetch original image from provided URL
2. **Validate**: Verify image format and integrity
3. **Detect**: Determine original aspect ratio
4. **Process**: For each target aspect ratio:
   - If already correct ratio: Optimize and resize
   - If different ratio: Scale to fit and add black padding
5. **Upload**: Store processed images in Supabase storage
6. **Update**: Update character record with new URLs

### Quality Settings

- **Format**: JPEG with mozjpeg optimization
- **Quality**: 85% (balance of size vs quality)
- **Progressive**: Enabled for faster loading
- **Background**: Pure black (#000000) for padding

## Error Handling

The service provides detailed error responses:

```json
{
  "success": false,
  "error": "Processing failed: Invalid image format",
  "statusCode": 400,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Error Codes

- `400`: Bad Request (invalid payload, image format, etc.)
- `401`: Unauthorized (invalid webhook signature)
- `404`: Not Found (character doesn't exist)
- `408`: Request Timeout (image download timeout)
- `413`: Payload Too Large (image size limit exceeded)
- `500`: Internal Server Error (processing failure)

## Monitoring

### Health Checks

The health endpoint monitors:
- Environment variable configuration
- Supabase database connectivity  
- Sharp library functionality
- Memory usage
- Overall service status

### Logging

All operations are logged with structured messages:
- `[Health]`: Health check operations
- `[AspectRatio]`: Main processing workflow
- `[ImageProcessor]`: Image processing operations  
- `[Supabase]`: Database and storage operations
- `[WebhookSecurity]`: Security validation

## Development

### Local Testing

1. **Start the service**:
   ```bash
   npm run dev
   ```

2. **Test health check**:
   ```bash
   curl http://localhost:3000/api/health
   ```

3. **Generate webhook signature** (Node.js):
   ```javascript
   const crypto = require('crypto');
   const payload = JSON.stringify({
     characterId: 'test-id',
     imageUrl: 'https://example.com/image.jpg'
   });
   const signature = crypto
     .createHmac('sha256', 'your_webhook_secret')
     .update(payload)
     .digest('hex');
   console.log(`sha256=${signature}`);
   ```

### Testing with CharFlow Studio

1. Update your CharFlow Studio application to call this service
2. Configure the webhook URL in your application settings
3. Ensure the webhook secret matches between both services
4. Monitor logs for successful processing

## Security Considerations

- **Webhook Signatures**: Always verify webhook signatures
- **Environment Variables**: Store sensitive data as environment variables
- **Input Validation**: All inputs are validated before processing
- **Error Information**: Error messages don't expose sensitive details
- **Resource Limits**: Processing includes timeout and size limits

## Performance

- **Memory**: Optimized for Vercel's 1GB memory limit
- **Timeout**: 60-second function timeout for processing
- **Concurrent Processing**: Sharp operations run efficiently
- **Cleanup**: Automatic cleanup of old aspect ratio files

## Troubleshooting

### Common Issues

1. **"Missing environment variables"**
   - Ensure all required environment variables are set
   - Check Vercel project settings for production deployment

2. **"Invalid webhook signature"**
   - Verify webhook secret matches between services
   - Check signature generation algorithm

3. **"Image download failed"**
   - Verify image URL is accessible
   - Check network connectivity and firewall settings

4. **"Sharp library error"**
   - Ensure Sharp is properly installed
   - Check image format compatibility

### Debug Mode

For detailed logging in development:

```bash
NODE_ENV=development npm run dev
```

## Support

For issues and questions:
1. Check the health endpoint for service status
2. Review application logs for detailed error information
3. Verify environment configuration
4. Test with known working images

## License

MIT License - see the CharFlow Studio project for details.