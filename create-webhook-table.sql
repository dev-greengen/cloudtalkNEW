-- Create table for storing webhook requests from CloudTalk and other sources
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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_webhook_requests_created_at ON webhook_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_is_cloudtalk ON webhook_requests(is_cloudtalk);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_cloudtalk_call_id ON webhook_requests(cloudtalk_call_id);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_cloudtalk_phone_number ON webhook_requests(cloudtalk_phone_number);
CREATE INDEX IF NOT EXISTS idx_webhook_requests_path ON webhook_requests(path);

-- Enable Row Level Security (optional - adjust as needed)
ALTER TABLE webhook_requests ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security needs)
CREATE POLICY "Allow all operations on webhook_requests" ON webhook_requests
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE webhook_requests IS 'Stores all webhook requests received by the API server, with special handling for CloudTalk webhooks';

