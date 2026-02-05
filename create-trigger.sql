-- Create a database trigger to automatically insert into cloudtalk_calls
-- when a CloudTalk webhook is inserted into webhook_requests

-- First, create a function that extracts and inserts CloudTalk call data
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
    ON CONFLICT DO NOTHING; -- Prevent duplicates if trigger fires multiple times
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_auto_insert_cloudtalk_call ON webhook_requests;
CREATE TRIGGER trigger_auto_insert_cloudtalk_call
  AFTER INSERT ON webhook_requests
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_cloudtalk_call();

-- Add comment
COMMENT ON FUNCTION auto_insert_cloudtalk_call() IS 'Automatically extracts and inserts CloudTalk call data when a CloudTalk webhook is saved';

