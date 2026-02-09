-- ============================================
-- QUICK SETUP: Copy and paste this entire file into Supabase SQL Editor
-- ============================================

-- Step 1: Create webhook_requests table (if not exists)
CREATE TABLE IF NOT EXISTS webhook_requests (
  id BIGSERIAL PRIMARY KEY,
  method VARCHAR(10) NOT NULL,
  path TEXT NOT NULL,
  url TEXT NOT NULL,
  headers JSONB,
  query JSONB,
  body JSONB,
  raw_body TEXT,
  ip_address TEXT,
  user_agent TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  is_cloudtalk BOOLEAN DEFAULT FALSE,
  cloudtalk_call_id TEXT,
  cloudtalk_event_type TEXT,
  cloudtalk_phone_number TEXT,
  cloudtalk_status TEXT,
  cloudtalk_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create cloudtalk_calls table with foreign key
CREATE TABLE IF NOT EXISTS cloudtalk_calls (
  id BIGSERIAL PRIMARY KEY,
  webhook_request_id BIGINT NOT NULL REFERENCES webhook_requests(id) ON DELETE CASCADE,
  call_id TEXT,
  event_type TEXT,
  phone_number TEXT,
  phone_number_from TEXT,
  status TEXT,
  duration INTEGER,
  direction TEXT,
  agent_id TEXT,
  agent_name TEXT,
  customer_name TEXT,
  recording_url TEXT,
  transcript TEXT,
  call_start_time TIMESTAMPTZ,
  call_end_time TIMESTAMPTZ,
  call_result TEXT,
  call_outcome TEXT,
  contact_name TEXT,
  company_name TEXT,
  ateco_code TEXT,
  ateco_eligible BOOLEAN,
  interest_confirmed BOOLEAN,
  electricity_bill_received BOOLEAN,
  annual_consumption_kwh INTEGER,
  should_send BOOLEAN,
  reason TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 3: Create indexes for webhook_requests
CREATE INDEX IF NOT EXISTS idx_webhook_requests_created_at ON webhook_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_is_cloudtalk ON webhook_requests(is_cloudtalk);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_cloudtalk_call_id ON webhook_requests(cloudtalk_call_id);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_cloudtalk_phone_number ON webhook_requests(cloudtalk_phone_number);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_path ON webhook_requests(path);

-- Step 4: Create indexes for cloudtalk_calls
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_webhook_request_id ON cloudtalk_calls(webhook_request_id);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_call_id ON cloudtalk_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_phone_number ON cloudtalk_calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_event_type ON cloudtalk_calls(event_type);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_created_at ON cloudtalk_calls(created_at DESC);

-- Step 5: Enable Row Level Security
ALTER TABLE webhook_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloudtalk_calls ENABLE ROW LEVEL SECURITY;

-- Step 6: Create policies (allow all operations)
DROP POLICY IF EXISTS "Allow all operations on webhook_requests" ON webhook_requests;
CREATE POLICY "Allow all operations on webhook_requests" ON webhook_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all operations on cloudtalk_calls" ON cloudtalk_calls;
CREATE POLICY "Allow all operations on cloudtalk_calls" ON cloudtalk_calls
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Done! Both tables are now created and ready to use.

