# Setup CloudTalk Calls Table

## Step 1: Create the Linked Table

1. Go to https://app.supabase.com
2. Select your project (pmtpufqtohygciwsdewt)
3. Go to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `create-cloudtalk-calls-table.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)

## Step 2: Verify Table Created

Run this query to verify:
```sql
SELECT * FROM cloudtalk_calls LIMIT 1;
```

## Step 3: Test the API

After deploying, all CloudTalk POST requests will automatically:
1. Save to `webhook_requests` table
2. Extract data and save to `cloudtalk_calls` table (linked via foreign key)

**API Endpoints:**

1. **View all CloudTalk calls with extracted data:**
   ```
   GET https://cloudtalk-new.vercel.app/api/cloudtalk-calls
   ```

2. **View specific call by call_id:**
   ```
   GET https://cloudtalk-new.vercel.app/api/cloudtalk-calls/{callId}
   ```

3. **View in Supabase Dashboard:**
   - Go to Table Editor → cloudtalk_calls
   - See all extracted call data in separate columns

## Table Structure

The `cloudtalk_calls` table:
- **Foreign Key**: `webhook_request_id` → links to `webhook_requests.id`
- **Extracted Fields**: All CloudTalk data from JSON body in separate columns
- **Raw Data**: Entire JSON body stored in `raw_data` column (JSONB)

## Automatic Extraction

When a CloudTalk webhook arrives:
1. Request saved to `webhook_requests` table
2. JSON body parsed and extracted fields saved to `cloudtalk_calls` table
3. Both tables linked via foreign key relationship

## Fields Extracted

- Call metadata (call_id, event_type, status, duration)
- Phone numbers (phone_number, phone_number_from)
- Agent info (agent_id, agent_name)
- Customer info (customer_name, contact_name)
- Call details (recording_url, transcript, timestamps)
- AI extracted data (ateco_code, interest_confirmed, etc.)
- Raw JSON (entire body in raw_data column)

