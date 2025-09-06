# Aspect Ratio Service - Deployment Guide

## 🚀 Quick Deploy to Vercel

### Step 1: Login to Vercel
```bash
vercel login
```
Choose your preferred login method (GitHub, Google, Email, etc.)

### Step 2: Deploy the Service
```bash
# From the aspect-ratio-service directory
vercel --prod
```

Follow the prompts:
- Set up and deploy: Y
- Which scope: Choose your account
- Link to existing project: N
- Project name: aspect-ratio-service (or press enter for default)
- Directory: ./ (current directory)
- Auto-detected: Yes

### Step 3: Set Environment Variables

After deployment, go to your Vercel dashboard and add these environment variables:

1. Go to: https://vercel.com/dashboard
2. Click on your "aspect-ratio-service" project
3. Go to "Settings" → "Environment Variables"
4. Add these variables:

```env
SUPABASE_URL=https://bjpvxckexqrlgxipfdbr.supabase.co
SUPABASE_SERVICE_ROLE_KEY=[Your service role key from char-flow-studio/.env.local]
WEBHOOK_SECRET=[Generate a secure random string]
```

To generate a webhook secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 4: Redeploy with Environment Variables
```bash
vercel --prod
```

## 📝 Your Service URL

After deployment, you'll get a URL like:
```
https://aspect-ratio-service.vercel.app
```

## 🔗 Integration with CharFlow Studio

### Update the Edge Function

Edit `char-flow-studio/supabase/functions/generate-character-with-credits/index.ts`:

Replace the aspect ratio queueing section (around line 1256) with:

```javascript
// Call the Vercel service to process aspect ratios
try {
  const response = await fetch('https://YOUR-SERVICE.vercel.app/api/process', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': generateSignature(payload, WEBHOOK_SECRET)
    },
    body: JSON.stringify({
      characterId: character.id,
      imageUrl: generatedImageUrl,
      timestamp: Date.now()
    })
  });
  
  if (response.ok) {
    console.log('Aspect ratio processing triggered successfully');
  }
} catch (error) {
  console.error('Failed to trigger aspect ratio processing:', error);
  // Non-fatal error - character is still created
}
```

### Create Webhook Secret in Supabase

Add the same WEBHOOK_SECRET to your Supabase Edge Functions:

```bash
npx supabase secrets set ASPECT_RATIO_WEBHOOK_SECRET=[your-webhook-secret]
```

## 🧪 Testing the Service

### Health Check
```bash
curl https://YOUR-SERVICE.vercel.app/api/health
```

### Process a Character (with signature)
```bash
# Generate test signature
WEBHOOK_SECRET="your-secret"
PAYLOAD='{"characterId":"test-id","imageUrl":"https://example.com/image.jpg","timestamp":1234567890}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" -binary | base64)

curl -X POST https://YOUR-SERVICE.vercel.app/api/process \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

## 📊 Monitoring

View logs in Vercel dashboard:
1. Go to your project dashboard
2. Click on "Functions" tab
3. View real-time logs for each function

## 🔄 Updating the Service

To deploy updates:
```bash
git add .
git commit -m "Update aspect ratio service"
vercel --prod
```

## 🛠️ Troubleshooting

### Common Issues

1. **"Invalid signature" error**
   - Ensure WEBHOOK_SECRET matches in both services
   - Check the signature generation code

2. **"Supabase connection failed"**
   - Verify SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
   - Check Supabase service status

3. **"Sharp installation failed"**
   - Vercel automatically installs Sharp for the correct platform
   - If issues persist, add to vercel.json:
   ```json
   {
     "functions": {
       "api/process.js": {
         "includeFiles": "node_modules/sharp/**"
       }
     }
   }
   ```

## 📚 API Documentation

### POST /api/process
Process aspect ratios for a character.

**Headers:**
- `Content-Type: application/json`
- `X-Webhook-Signature: [HMAC-SHA256 signature]`

**Body:**
```json
{
  "characterId": "uuid",
  "imageUrl": "https://...",
  "timestamp": 1234567890
}
```

**Response:**
```json
{
  "success": true,
  "message": "Aspect ratios processed successfully",
  "urls": {
    "1x1": "https://...",
    "16x9": "https://...",
    "9x16": "https://..."
  }
}
```

### GET /api/health
Check service health.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-06T...",
  "checks": {
    "environment": true,
    "supabase": true,
    "sharp": true
  }
}
```

## 🎉 Success!

Once deployed and integrated, new characters will automatically have their aspect ratios processed with proper black padding!