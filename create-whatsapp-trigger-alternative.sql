-- Alternative trigger using Supabase Edge Functions or webhook table
-- If pg_net extension is not available, use this approach

-- Create a table to queue WhatsApp messages
CREATE TABLE IF NOT EXISTS whatsapp_queue (
  id BIGSERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  call_id TEXT,
  webhook_request_id BIGINT REFERENCES webhook_requests(id),
  cloudtalk_call_id BIGINT REFERENCES cloudtalk_calls(id),
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status ON whatsapp_queue(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_created_at ON whatsapp_queue(created_at DESC);

-- Create function that inserts into queue
CREATE OR REPLACE FUNCTION queue_whatsapp_on_call_insert()
RETURNS TRIGGER AS $$
DECLARE
  message_text TEXT;
BEGIN
  -- Only proceed if phone_number is present
  IF NEW.phone_number IS NOT NULL AND NEW.phone_number != '' THEN
    -- Italian message asking for bolletta (electricity bill)
    message_text := 'Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all''Agrisolare di quest''anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.';
    
    -- Insert into queue
    INSERT INTO whatsapp_queue (
      phone_number,
      message,
      call_id,
      webhook_request_id,
      cloudtalk_call_id,
      status
    ) VALUES (
      NEW.phone_number,
      message_text,
      NEW.call_id,
      NEW.webhook_request_id,
      NEW.id,
      'pending'
    );
    
    RAISE NOTICE 'WhatsApp message queued for phone: %, call_id: %', NEW.phone_number, NEW.call_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_queue_whatsapp_on_call_insert ON cloudtalk_calls;
CREATE TRIGGER trigger_queue_whatsapp_on_call_insert
  AFTER INSERT ON cloudtalk_calls
  FOR EACH ROW
  WHEN (NEW.phone_number IS NOT NULL AND NEW.phone_number != '')
  EXECUTE FUNCTION queue_whatsapp_on_call_insert();

-- Enable RLS
ALTER TABLE whatsapp_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on whatsapp_queue" ON whatsapp_queue
  FOR ALL USING (true) WITH CHECK (true);

