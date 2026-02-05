-- ============================================
-- COMPLETE SETUP: Run this entire file in Supabase SQL Editor
-- This creates both tables AND the automatic trigger
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

-- Step 7: Create trigger function for automatic insertion
CREATE OR REPLACE FUNCTION auto_insert_cloudtalk_call()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if it's a CloudTalk webhook and has a body
  IF NEW.is_cloudtalk = TRUE AND NEW.body IS NOT NULL THEN
    INSERT INTO cloudtalk_calls (
      webhook_request_id,
      call_id,
      event_type,
      phone_number,
      phone_number_from,
      status,
      duration,
      direction,
      agent_id,
      agent_name,
      customer_name,
      recording_url,
      transcript,
      call_start_time,
      call_end_time,
      call_result,
      call_outcome,
      contact_name,
      company_name,
      ateco_code,
      ateco_eligible,
      interest_confirmed,
      electricity_bill_received,
      annual_consumption_kwh,
      should_send,
      reason,
      raw_data
    )
    VALUES (
      NEW.id,
      COALESCE((NEW.body->>'call_id'), (NEW.body->>'callId'), (NEW.body->>'id')),
      COALESCE((NEW.body->>'event_type'), (NEW.body->>'eventType'), (NEW.body->>'type')),
      COALESCE((NEW.body->>'phone_number'), (NEW.body->>'phoneNumber'), (NEW.body->>'to'), (NEW.body->>'number')),
      COALESCE((NEW.body->>'phone_number_from'), (NEW.body->>'phoneNumberFrom'), (NEW.body->>'from')),
      COALESCE((NEW.body->>'status'), (NEW.body->>'call_status')),
      CASE 
        WHEN (NEW.body->>'duration') IS NOT NULL THEN (NEW.body->>'duration')::INTEGER
        WHEN (NEW.body->>'call_duration') IS NOT NULL THEN (NEW.body->>'call_duration')::INTEGER
        ELSE NULL
      END,
      COALESCE((NEW.body->>'direction'), (NEW.body->>'call_direction')),
      COALESCE((NEW.body->>'agent_id'), (NEW.body->>'agentId')),
      COALESCE((NEW.body->>'agent_name'), (NEW.body->>'agentName')),
      COALESCE((NEW.body->>'customer_name'), (NEW.body->>'customerName'), (NEW.body->>'contact_name'), (NEW.body->>'contactName')),
      COALESCE((NEW.body->>'recording_url'), (NEW.body->>'recordingUrl'), (NEW.body->>'recording')),
      COALESCE((NEW.body->>'transcript'), (NEW.body->>'transcription'), (NEW.body->>'text')),
      CASE 
        WHEN (NEW.body->>'call_start_time') IS NOT NULL THEN (NEW.body->>'call_start_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'callStartTime') IS NOT NULL THEN (NEW.body->>'callStartTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'start_time') IS NOT NULL THEN (NEW.body->>'start_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'startTime') IS NOT NULL THEN (NEW.body->>'startTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'timestamp') IS NOT NULL THEN (NEW.body->>'timestamp')::TIMESTAMPTZ
        WHEN (NEW.body->>'date') IS NOT NULL THEN (NEW.body->>'date')::TIMESTAMPTZ
        ELSE NULL
      END,
      CASE 
        WHEN (NEW.body->>'call_end_time') IS NOT NULL THEN (NEW.body->>'call_end_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'callEndTime') IS NOT NULL THEN (NEW.body->>'callEndTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'end_time') IS NOT NULL THEN (NEW.body->>'end_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'endTime') IS NOT NULL THEN (NEW.body->>'endTime')::TIMESTAMPTZ
        ELSE NULL
      END,
      COALESCE((NEW.body->>'call_result'), (NEW.body->>'callResult'), (NEW.body->>'result')),
      COALESCE((NEW.body->>'call_outcome'), (NEW.body->>'callOutcome'), (NEW.body->>'outcome')),
      COALESCE((NEW.body->>'contact_name'), (NEW.body->>'contactName')),
      COALESCE((NEW.body->>'company_name'), (NEW.body->>'companyName')),
      COALESCE((NEW.body->>'ateco_code'), (NEW.body->>'atecoCode')),
      CASE 
        WHEN (NEW.body->>'ateco_eligible') IS NOT NULL THEN (NEW.body->>'ateco_eligible')::BOOLEAN
        WHEN (NEW.body->>'atecoEligible') IS NOT NULL THEN (NEW.body->>'atecoEligible')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (NEW.body->>'interest_confirmed') IS NOT NULL THEN (NEW.body->>'interest_confirmed')::BOOLEAN
        WHEN (NEW.body->>'interestConfirmed') IS NOT NULL THEN (NEW.body->>'interestConfirmed')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (NEW.body->>'electricity_bill_received') IS NOT NULL THEN (NEW.body->>'electricity_bill_received')::BOOLEAN
        WHEN (NEW.body->>'electricityBillReceived') IS NOT NULL THEN (NEW.body->>'electricityBillReceived')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (NEW.body->>'annual_consumption_kwh') IS NOT NULL THEN (NEW.body->>'annual_consumption_kwh')::INTEGER
        WHEN (NEW.body->>'annualConsumptionKwh') IS NOT NULL THEN (NEW.body->>'annualConsumptionKwh')::INTEGER
        WHEN (NEW.body->>'consumption') IS NOT NULL THEN (NEW.body->>'consumption')::INTEGER
        ELSE NULL
      END,
      CASE 
        WHEN (NEW.body->>'should_send') IS NOT NULL THEN (NEW.body->>'should_send')::BOOLEAN
        WHEN (NEW.body->>'shouldSend') IS NOT NULL THEN (NEW.body->>'shouldSend')::BOOLEAN
        ELSE NULL
      END,
      COALESCE((NEW.body->>'reason'), (NEW.body->>'message')),
      NEW.body
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicates
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_insert_cloudtalk_call ON webhook_requests;
CREATE TRIGGER trigger_auto_insert_cloudtalk_call
  AFTER INSERT ON webhook_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_cloudtalk_call();

-- Done! Now every CloudTalk webhook inserted into webhook_requests 
-- will automatically create a record in cloudtalk_calls

