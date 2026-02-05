# WhatsApp Reply Monitoring via Polling

## Overview

Since Whapi.Cloud doesn't support webhook configuration through the dashboard, we use a **polling approach** to check for incoming messages and update `electricity_bill_received` when clients reply.

## How It Works

1. **Polling Endpoint**: `/api/check-whatsapp-replies` checks for new incoming messages
2. **Message Processing**: Filters incoming messages (from_me: false)
3. **Phone Matching**: Matches sender phone number with `cloudtalk_calls` records
4. **Database Update**: Sets `electricity_bill_received = true` for matching records

## Setup Options

### Option 1: Manual Polling (Testing)

Call the endpoint manually:
```bash
curl https://cloudtalk-new.vercel.app/api/check-whatsapp-replies
```

### Option 2: Automated Polling (Recommended)

Set up a cron job or scheduled task to call the endpoint periodically:

**Using Vercel Cron Jobs:**
1. Create `vercel.json` cron configuration (if not exists)
2. Add cron job to call `/api/check-whatsapp-replies` every 5-10 minutes

**Using External Cron Service:**
- Use services like:
  - [cron-job.org](https://cron-job.org)
  - [EasyCron](https://www.easycron.com)
  - [Cronitor](https://cronitor.io)
  
  Configure to call: `GET https://cloudtalk-new.vercel.app/api/check-whatsapp-replies`

**Using Supabase Edge Functions:**
- Create a scheduled Edge Function that calls your endpoint

## API Endpoint

**GET** `/api/check-whatsapp-replies?limit=50`

**Parameters:**
- `limit` (optional): Number of messages to check (default: 50)

**Response:**
```json
{
  "success": true,
  "checked": 10,
  "updated": 3,
  "updates": [
    {
      "phone_number": "393209793492",
      "message_preview": "Ecco la bolletta...",
      "calls_updated": 1
    }
  ],
  "message": "Checked 10 incoming messages, updated 3 call records"
}
```

## Recommended Polling Frequency

- **Every 5 minutes**: Good balance between responsiveness and API usage
- **Every 10 minutes**: Lower API usage, still timely
- **Every 1 minute**: Most responsive, higher API usage

## Testing

1. Send a WhatsApp message to a test number
2. Have that number reply
3. Call `/api/check-whatsapp-replies`
4. Check `cloudtalk_calls` table - `electricity_bill_received` should be `true`

## Notes

- Only processes text messages (ignores images, voice, etc.)
- Only updates records where `electricity_bill_received = false`
- Handles multiple phone number formats automatically
- Updates `updated_at` timestamp when records are modified

