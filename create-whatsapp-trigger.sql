-- Create trigger to automatically send WhatsApp message when cloudtalk_calls record is inserted
-- This trigger calls a webhook endpoint on your Vercel server

-- First, enable pg_net extension (for HTTP calls from PostgreSQL)
-- Note: This might need to be enabled by Supabase admin
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send WhatsApp message via webhook
CREATE OR REPLACE FUNCTION send_whatsapp_on_call_insert()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  message_text TEXT;
  payload JSONB;
BEGIN
  -- Only proceed if phone_number is present
  IF NEW.phone_number IS NOT NULL AND NEW.phone_number != '' THEN
    -- Italian message asking for bolletta (electricity bill)
    message_text := 'Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all''Agrisolare di quest''anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.';
    
    -- Webhook URL to your Vercel server
    webhook_url := 'https://cloudtalk-new.vercel.app/api/send-whatsapp';
    
    -- Prepare payload
    payload := jsonb_build_object(
      'phone_number', NEW.phone_number,
      'message', message_text,
      'call_id', NEW.call_id,
      'webhook_request_id', NEW.webhook_request_id
    );
    
    -- Send HTTP POST request to webhook
    -- Using pg_net extension (if available) or pg_http extension
    PERFORM net.http_post(
      url := webhook_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := payload::text
    );
    
    -- Log the attempt (you can create a log table if needed)
    RAISE NOTICE 'WhatsApp message triggered for phone: %, call_id: %', NEW.phone_number, NEW.call_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_send_whatsapp_on_call_insert ON cloudtalk_calls;
CREATE TRIGGER trigger_send_whatsapp_on_call_insert
  AFTER INSERT ON cloudtalk_calls
  FOR EACH ROW
  WHEN (NEW.phone_number IS NOT NULL AND NEW.phone_number != '')
  EXECUTE FUNCTION send_whatsapp_on_call_insert();

-- Alternative: If pg_net is not available, use this version that logs to a table
-- and your server can poll it, or use Supabase Edge Functions

