# Aspect Ratio Processing Service

Automated image aspect ratio processing service for CharFlow Studio.

## Features
- Processes images to create 1:1, 16:9, and 9:16 aspect ratios
- Adds black padding to preserve original image content
- Integrates with Supabase for storage and database updates
- Secure webhook authentication

## Endpoints

### GET /api/health
Health check endpoint

### POST /api/process
Process aspect ratios for a character

## Environment Variables
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for Supabase
- `WEBHOOK_SECRET`: Secret for webhook authentication

---
Deployed on Vercel - January 2025

Deploy trigger: Sat Sep  6 21:18:45 CEST 2025

Force deploy: 1757186938
