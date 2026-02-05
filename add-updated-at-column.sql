-- Add updated_at column to cloudtalk_calls table if it doesn't exist
ALTER TABLE cloudtalk_calls 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index on updated_at for faster queries
CREATE INDEX IF NOT EXISTS idx_cloudtalk_calls_updated_at ON cloudtalk_calls(updated_at DESC);

-- Create a trigger to automatically update updated_at on row updates
CREATE OR REPLACE FUNCTION update_cloudtalk_calls_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_cloudtalk_calls_updated_at ON cloudtalk_calls;
CREATE TRIGGER trigger_update_cloudtalk_calls_updated_at
  BEFORE UPDATE ON cloudtalk_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_cloudtalk_calls_updated_at();

