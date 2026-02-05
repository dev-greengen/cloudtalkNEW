# WhatsApp Automatic Trigger Setup

## Quick Setup (Recommended)

### Step 1: Configure WhatsApp API in Vercel

1. Go to https://vercel.com → Your project → Settings → Environment Variables
2. Add:
   - `WHATSAPP_API_TOKEN` - Your Whapi.Cloud API token
   - `WHATSAPP_API_URL` - (Optional) Default: `https://gate.whapi.cloud`

### Step 2: Choose Trigger Method

**Option A: Queue Method (Most Reliable)**
1. Run `create-whatsapp-trigger-alternative.sql` in Supabase
2. This creates a `whatsapp_queue` table
3. Trigger inserts messages into queue
4. Process queue by calling: `POST /api/process-whatsapp-queue`

**Option B: Direct HTTP Call (If pg_http available)**
1. Run `create-whatsapp-trigger-direct.sql` in Supabase
2. Trigger directly calls Vercel webhook
3. Requires `pg_http` extension (check if available)

**Option C: Queue + Auto-Process**
1. Use Option A (queue method)
2. Set up a cron job to call `/api/process-whatsapp-queue` every minute
3. Or use Supabase Edge Functions to process queue

### Step 3: Test

Insert a test record:
```sql
INSERT INTO cloudtalk_calls (
  webhook_request_id,
  phone_number,
  call_id
) VALUES (
  4,  -- or any existing webhook_request_id
  '+393209793492',
  'test_123'
);
```

Check if WhatsApp was sent or queued.

## Message Sent (Italian)

```
Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.
```

## API Endpoints

- `POST /api/send-whatsapp` - Send WhatsApp directly
  ```json
  {
    "phone_number": "+393209793492",
    "message": "Your message here"
  }
  ```

- `POST /api/process-whatsapp-queue` - Process pending messages from queue

## How It Works

1. CloudTalk webhook arrives → Saved to `webhook_requests`
2. Data extracted → Saved to `cloudtalk_calls` (with phone_number)
3. **Trigger fires** → Queues WhatsApp message or sends directly
4. Vercel server processes → Sends via Whapi.Cloud API
5. Message delivered to customer

