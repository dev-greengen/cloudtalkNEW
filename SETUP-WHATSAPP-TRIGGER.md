# Setup WhatsApp Automatic Trigger

## Overview

When a record is inserted into `cloudtalk_calls` table with a `phone_number`, it will automatically send a WhatsApp message asking for the "bolletta" (electricity bill) file.

## Step 1: Configure WhatsApp API in Vercel

1. Go to https://vercel.com → Your project → Settings → Environment Variables
2. Add these variables:
   - `WHATSAPP_API_TOKEN` - Your Whapi.Cloud API token
   - `WHATSAPP_API_URL` - (Optional) Default: `https://gate.whapi.cloud`

## Step 2: Create WhatsApp Queue Table (Recommended)

Run this SQL in Supabase SQL Editor:

```sql
-- Create queue table
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id BIGSERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  call_id TEXT,
  webhook_request_id BIGINT REFERENCES webhook_requests(id),
  cloudtalk_call_id BIGINT REFERENCES cloudtalk_calls(id),
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON whatsapp_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_at ON whatsapp_queue(created_at DESC);

ALTER TABLE whatsapp_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on whatsapp_queue" ON whatsapp_queue
  FOR ALL USING (true) WITH CHECK (true);
```

## Step 3: Create the Trigger

Run `create-whatsapp-trigger-alternative.sql` in Supabase SQL Editor.

This creates a trigger that:
- Fires when a record is inserted into `cloudtalk_calls`
- Checks if `phone_number` is present
- Inserts a message into `whatsapp_queue` table
- Your Vercel server processes the queue

## Step 4: Process the Queue

**Option A: Automatic (Recommended)**
- Set up a cron job or scheduled function to call:
  ```
  POST https://cloudtalk-new.vercel.app/api/process-whatsapp-queue
  ```

**Option B: Manual**
- Call the endpoint whenever you want to process pending messages:
  ```bash
  curl -X POST https://cloudtalk-new.vercel.app/api/process-whatsapp-queue
  ```

## Step 5: Test

1. Insert a test record into `cloudtalk_calls` with a phone number
2. Check `whatsapp_queue` table - should have a pending message
3. Call `/api/process-whatsapp-queue` to send it
4. Verify message was sent

## Message Text (Italian)

The message sent is:
```
Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.
```

## API Endpoints

- `POST /api/send-whatsapp` - Send WhatsApp message directly
- `POST /api/process-whatsapp-queue` - Process pending messages from queue

