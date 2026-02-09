# WhatsApp Webhook Setup for Reply Monitoring

## Overview

When a client replies to a WhatsApp message we sent, the system automatically updates the `electricity_bill_received` column to `true` in the `cloudtalk_calls` table.

## Step 1: Configure Whapi.Cloud Webhook

1. Go to your Whapi.Cloud dashboard
2. Navigate to **Settings** → **Webhooks** or **Integrations**
3. Add a new webhook with:
   - **URL**: `https://cloudtalk-new.vercel.app/api/whatsapp-webhook`
   - **Events**: Select "Incoming Messages" or "messages" event
   - **Method**: POST

## Step 2: Add updated_at Column (if not exists)

Run this SQL in Supabase SQL Editor:

```sql
-- Run add-updated-at-column.sql
```

Or manually:
```sql
ALTER TABLE cloudtalk_calls 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
```

## Step 3: Test the Webhook

1. Send a test WhatsApp message to a number
2. Have that number reply to your message
3. Check the `cloudtalk_calls` table - `electricity_bill_received` should be `true`

## How It Works

1. **Client replies** → Whapi.Cloud sends webhook to `/api/whatsapp-webhook`
2. **Server receives** → Extracts phone number from incoming message
3. **Matches phone** → Finds all `cloudtalk_calls` records with that phone number
4. **Updates database** → Sets `electricity_bill_received = true` for all matching records
5. **Logs webhook** → Saves incoming message to `webhook_requests` table for tracking

## Phone Number Matching

The system handles multiple phone number formats:
- `393209793492`
- `+393209793492`
- `39209793492`
- `3209793492` (10 digits, adds 39 prefix)

## API Endpoint

**POST** `/api/whatsapp-webhook`

Receives webhooks from Whapi.Cloud when messages arrive.

## Monitoring

Check webhook activity:
- View webhook logs: `GET /api/webhooks`
- Check updated calls: Query `cloudtalk_calls` where `electricity_bill_received = true`
- View recent updates: Query by `updated_at` timestamp


