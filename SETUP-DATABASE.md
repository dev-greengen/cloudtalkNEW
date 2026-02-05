# Setup Database for CloudTalk Webhooks

## Step 1: Create the Table in Supabase

1. Go to https://app.supabase.com
2. Select your project (pmtpufqtohygciwsdewt)
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `create-webhook-table.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)

## Step 2: Verify Table Created

Run this query to verify:
```sql
SELECT * FROM webhook_requests LIMIT 1;
```

## Step 3: Test the API

After deploying, all requests will be automatically saved. You can:

1. **View all webhooks:**
   ```
   GET https://cloudtalk-new.vercel.app/api/webhooks
   ```

2. **View only CloudTalk webhooks:**
   ```
   GET https://cloudtalk-new.vercel.app/api/cloudtalk-webhooks
   ```

3. **View in Supabase Dashboard:**
   - Go to Table Editor → webhook_requests
   - See all saved requests in real-time

## Table Structure

The `webhook_requests` table stores:
- All request metadata (method, path, headers, etc.)
- Request body (JSON)
- Raw body (text)
- IP address and user agent
- CloudTalk-specific fields (call_id, event_type, phone_number, etc.)
- Timestamps

## Automatic Saving

Every request to your API (except GET /) is automatically saved to the database. No additional code needed!

