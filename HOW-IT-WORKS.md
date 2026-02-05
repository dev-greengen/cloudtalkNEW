# How The System Works - Complete Flow

## Overview

This system automatically:
1. Receives CloudTalk call webhooks
2. Extracts phone numbers
3. Sends WhatsApp messages asking for electricity bills
4. Monitors replies and updates the database

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDTALK CALL HAPPENS                        │
│              (Customer calls your business)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         CLOUDTALK SENDS WEBHOOK TO YOUR SERVER                  │
│    POST https://cloudtalk-new.vercel.app                       │
│    Body: { phone_number, call_id, call_result, ... }           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              SERVER RECEIVES WEBHOOK                             │
│  • Saves to webhook_requests table                              │
│  • Detects it's a CloudTalk webhook                             │
│  • Extracts data (handles nested body.data structure)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         DATABASE TRIGGER FIRES AUTOMATICALLY                    │
│  • Auto-detects CloudTalk webhook from body structure           │
│  • Extracts phone_number, call_id, etc.                         │
│  • Inserts into cloudtalk_calls table                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         CHECK IF PHONE NUMBER EXISTS                            │
│  IF phone_number is present:                                    │
│    → Automatically send WhatsApp message                        │
│  ELSE:                                                          │
│    → Skip (no WhatsApp sent)                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         SEND WHATSAPP MESSAGE                                    │
│  • Normalize phone number (add 39 if Italian)                   │
│  • Send via Whapi.Cloud API                                     │
│  • Message: "Buongiorno, sono Samuela della Greengen Group..." │
│  • Ask for "bollette elettriche" (electricity bills)            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         CLIENT RECEIVES WHATSAPP                                │
│  Customer sees message asking for electricity bill              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         CLIENT REPLIES (OPTIONAL)                                │
│  Customer sends reply message                                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         CRON JOB CHECKS FOR REPLIES                             │
│  Every 5 minutes:                                               │
│  • Calls /api/check-whatsapp-replies                            │
│  • Fetches recent messages from Whapi.Cloud                     │
│  • Filters incoming messages (from_me: false)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         MATCH PHONE NUMBER                                       │
│  • Extract phone number from reply                              │
│  • Normalize format (393209793492, +393209793492, etc.)         │
│  • Search cloudtalk_calls table for matching phone_number        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         UPDATE DATABASE                                         │
│  IF match found:                                                │
│    → Set electricity_bill_received = true                       │
│    → Update updated_at timestamp                                │
│  ELSE:                                                          │
│    → No update (not a customer we messaged)                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step

### Step 1: CloudTalk Call Webhook Arrives

**What happens:**
- CloudTalk sends POST request to: `https://cloudtalk-new.vercel.app`
- Body contains call data: `{ phone_number, call_id, call_result, ... }`
- May have nested structure: `{ data: { phone_number, ... } }`

**Server action:**
```javascript
// server.js - saveRequestToDB()
1. Detects it's a CloudTalk webhook (by path, user-agent, or body structure)
2. Saves to webhook_requests table
3. Extracts phone_number and other data
4. Calls saveCloudTalkCallData()
```

---

### Step 2: Data Extraction & Database Insert

**What happens:**
- Server extracts all CloudTalk fields
- Handles both direct body and nested `body.data` structures
- Inserts into `cloudtalk_calls` table

**Database trigger:**
```sql
-- UPDATE-TRIGGER-AUTO-DETECT.sql
1. Trigger fires automatically on INSERT to webhook_requests
2. Auto-detects CloudTalk webhook by checking body structure
3. Extracts data (handles nested body.data)
4. Inserts into cloudtalk_calls table
```

**Result:**
- Record in `cloudtalk_calls` with phone_number, call_id, etc.

---

### Step 3: Automatic WhatsApp Sending

**What happens:**
- Server checks if `phone_number` exists in extracted data
- If yes, automatically calls `sendWhatsAppMessage()`

**Phone normalization:**
```javascript
// Examples:
"3209793492" → "393209793492"  // Adds Italian country code
"+393209793492" → "393209793492"  // Removes +
"393209793492" → "393209793492"  // Already correct
```

**WhatsApp message sent:**
```
Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta 
di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una 
copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.
```

**API call:**
```javascript
POST https://gate.whapi.cloud/messages/text
Headers: Authorization: Bearer TJJs7JOsxKdKyqMLKkiovuvVgs2lmfVA
Body: { to: "393209793492", body: "Buongiorno..." }
```

---

### Step 4: Client Receives & Replies

**What happens:**
- Customer receives WhatsApp message
- Customer may reply (optional)
- Reply goes to Whapi.Cloud

---

### Step 5: Polling for Replies

**What happens:**
- Cron job (cron-job.org) calls endpoint every 5 minutes:
  ```
  GET https://cloudtalk-new.vercel.app/api/check-whatsapp-replies
  ```

**Server action:**
```javascript
// server.js - /api/check-whatsapp-replies
1. Fetches recent messages from Whapi.Cloud API
2. Filters to only incoming messages (from_me: false)
3. For each incoming message:
   a. Extract phone number
   b. Normalize phone number
   c. Search cloudtalk_calls for matching phone_number
   d. If found AND electricity_bill_received = false:
      → Update to electricity_bill_received = true
```

---

### Step 6: Database Update

**What happens:**
- When reply is detected from a number we messaged:
  ```sql
  UPDATE cloudtalk_calls
  SET electricity_bill_received = true,
      updated_at = NOW()
  WHERE phone_number = '393209793492'
    AND electricity_bill_received = false
  ```

**Result:**
- `electricity_bill_received` column is now `true`
- You can query the database to see which customers have replied

---

## Database Tables

### `webhook_requests`
- Stores all incoming webhooks
- Contains raw body, headers, timestamp
- Has `is_cloudtalk` flag

### `cloudtalk_calls`
- Extracted CloudTalk call data
- Linked to `webhook_requests` via foreign key
- Contains: phone_number, call_id, electricity_bill_received, etc.

### `whatsapp_queue` (optional)
- Queue for WhatsApp messages
- Used by database trigger as backup
- Status: pending, sent, failed

---

## Key Features

✅ **Automatic Detection**: No manual configuration needed
✅ **Nested Data Handling**: Works with both `body` and `body.data` structures
✅ **Phone Normalization**: Handles multiple phone number formats
✅ **Error Handling**: Falls back to queue if direct send fails
✅ **Reply Monitoring**: Automatically detects when clients reply
✅ **Database Updates**: Updates `electricity_bill_received` automatically

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/` | GET | Webhook inspector (view all requests) |
| `/api/webhooks` | GET | Get webhook requests from database |
| `/api/cloudtalk-calls` | GET | Get CloudTalk call records |
| `/api/send-whatsapp` | POST | Manually send WhatsApp message |
| `/api/check-whatsapp-replies` | GET | Check for incoming replies (polling) |
| `/api/whatsapp-messages` | GET | View sent WhatsApp messages |
| `/api/whatsapp-webhook` | POST | Receive webhooks (if Whapi.Cloud supports it) |

---

## Environment Variables

```bash
SUPABASE_URL=https://pmtpufqtohygciwsdewt.supabase.co
SUPABASE_KEY=sb_publishable_9WUXqQA-w5JKRpaojmhZhA_hBApvDsq
WHATSAPP_API_TOKEN=TJJs7JOsxKdKyqMLKkiovuvVgs2lmfVA
WHATSAPP_API_URL=https://gate.whapi.cloud
```

---

## Testing the Flow

1. **Test webhook reception:**
   ```bash
   curl -X POST https://cloudtalk-new.vercel.app \
     -H "Content-Type: application/json" \
     -d '{"phone_number": "3209793492", "call_id": "test123"}'
   ```

2. **Check if WhatsApp was sent:**
   ```bash
   curl https://cloudtalk-new.vercel.app/api/whatsapp-messages
   ```

3. **Check for replies:**
   ```bash
   curl https://cloudtalk-new.vercel.app/api/check-whatsapp-replies
   ```

4. **View database records:**
   - Go to Supabase dashboard
   - Check `cloudtalk_calls` table
   - See `electricity_bill_received` status

---

## Summary

**Incoming Flow:**
CloudTalk → Webhook → Database → Extract Phone → Send WhatsApp

**Reply Flow:**
Client Reply → Whapi.Cloud → Polling → Match Phone → Update Database

Everything is **automatic** - no manual intervention needed! 🚀

