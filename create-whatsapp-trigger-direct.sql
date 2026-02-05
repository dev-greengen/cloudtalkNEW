-- Direct trigger that calls Vercel webhook endpoint
-- This uses pg_http extension (if available in Supabase)

-- Enable pg_http extension (if available)
-- Note: Supabase might have this enabled by default
CREATE EXTENSION IF NOT EXISTS http;

-- Create function to send WhatsApp via webhook
CREATE OR REPLACE FUNCTION send_whatsapp_on_call_insert()
RETURNS TRIGGER AS $$
DECLARE
  webhook_url TEXT;
  message_text TEXT;
  response http_response;
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
    
    -- Send HTTP POST request
    SELECT * INTO response FROM http((
      'POST',
      webhook_url,
      ARRAY[
        http_header('Content-Type', 'application/json')
      ],
      'application/json',
      json_build_object(
        'phone_number', NEW.phone_number,
        'message', message_text,
        'call_id', NEW.call_id,
        'webhook_request_id', NEW.webhook_request_id
      )::text
    )::http_request);
    
    -- Log the result
    RAISE NOTICE 'WhatsApp webhook called for phone: %, call_id: %, status: %', 
      NEW.phone_number, NEW.call_id, response.status;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If http extension is not available, just log and continue
    RAISE NOTICE 'Could not send WhatsApp (http extension may not be available): %', SQLERRM;
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

