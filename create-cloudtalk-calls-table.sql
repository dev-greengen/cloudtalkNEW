-- Create table for CloudTalk call data extracted from webhook body
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_webhook_request_id ON cloudtalk_calls(webhook_request_id);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_call_id ON cloudtalk_calls(call_id);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_phone_number ON cloudtalk_calls(phone_number);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_event_type ON cloudtalk_calls(event_type);
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_created_at ON cloudtalk_calls(created_at DESC);

-- Enable Row Level Security
ALTER TABLE cloudtalk_calls ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations
CREATE POLICY "Allow all operations on cloudtalk_calls" ON cloudtalk_calls
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE cloudtalk_calls IS 'Stores extracted CloudTalk call data from webhook JSON body, linked to webhook_requests table';

