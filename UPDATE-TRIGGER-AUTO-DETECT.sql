-- Update trigger to automatically detect CloudTalk webhooks
-- This trigger will run for ALL inserts and check if it's a CloudTalk webhook
-- by examining the body structure, not just relying on is_cloudtalk flag

CREATE OR REPLACE FUNCTION auto_insert_cloudtalk_call()
RETURNS TRIGGER AS $$
DECLARE
  is_cloudtalk_webhook BOOLEAN := FALSE;
  body_data JSONB;
BEGIN
  -- Skip if body is null
  IF NEW.body IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if is_cloudtalk is already set to TRUE
  IF NEW.is_cloudtalk = TRUE THEN
    is_cloudtalk_webhook := TRUE;
  ELSE
    -- Auto-detect CloudTalk webhook by checking body structure
    -- Check for nested body.data structure first
    IF NEW.body ? 'data' AND NEW.body->'data' IS NOT NULL THEN
      body_data := NEW.body->'data';
    ELSE
      body_data := NEW.body;
    END IF;
    
    -- Check if it contains CloudTalk-specific fields
    is_cloudtalk_webhook := (
      body_data ? 'callId' OR
      body_data ? 'call_id' OR
      body_data ? 'call_result' OR
      body_data ? 'callResult' OR
      body_data ? 'phoneNumber' OR
      body_data ? 'phone_number' OR
      body_data ? 'eventType' OR
      body_data ? 'event_type' OR
      (NEW.path ILIKE '%cloudtalk%' OR NEW.path ILIKE '%webhook%')
    );
    
    -- If detected, update is_cloudtalk flag
    IF is_cloudtalk_webhook THEN
      UPDATE webhook_requests 
      SET is_cloudtalk = TRUE 
      WHERE id = NEW.id;
    END IF;
  END IF;
  
  -- Only process if it's a CloudTalk webhook
  IF is_cloudtalk_webhook THEN
    -- Determine which body structure to use
    IF NEW.body ? 'data' AND NEW.body->'data' IS NOT NULL THEN
      body_data := NEW.body->'data';
    ELSE
      body_data := NEW.body;
    END IF;
    
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
      -- Handle both nested body.data and direct body structure
      COALESCE(
        (body_data->>'callId'), 
        (body_data->>'call_id'), 
        (body_data->>'id'),
        (NEW.body->>'call_id'), 
        (NEW.body->>'callId'), 
        (NEW.body->>'id')
      ),
      COALESCE(
        (body_data->>'event_type'), 
        (body_data->>'eventType'), 
        (body_data->>'type'),
        (NEW.body->>'event_type'), 
        (NEW.body->>'eventType'), 
        (NEW.body->>'type')
      ),
      COALESCE(
        (body_data->>'caller_number'),
        (body_data->>'phoneNumber'),
        (body_data->>'phone_number'),
        (body_data->>'to'),
        (body_data->>'number'),
        (NEW.body->>'phone_number'), 
        (NEW.body->>'phoneNumber'), 
        (NEW.body->>'to'), 
        (NEW.body->>'number')
      ),
      COALESCE(
        (body_data->>'phone_number_from'),
        (body_data->>'phoneNumberFrom'),
        (body_data->>'from'),
        (NEW.body->>'phone_number_from'), 
        (NEW.body->>'phoneNumberFrom'), 
        (NEW.body->>'from')
      ),
      COALESCE(
        (body_data->>'status'),
        (body_data->>'call_status'),
        (NEW.body->>'status'), 
        (NEW.body->>'call_status')
      ),
      CASE 
        WHEN (body_data->>'duration') IS NOT NULL THEN (body_data->>'duration')::INTEGER
        WHEN (body_data->>'call_duration') IS NOT NULL THEN (body_data->>'call_duration')::INTEGER
        WHEN (NEW.body->>'duration') IS NOT NULL THEN (NEW.body->>'duration')::INTEGER
        WHEN (NEW.body->>'call_duration') IS NOT NULL THEN (NEW.body->>'call_duration')::INTEGER
        ELSE NULL
      END,
      COALESCE(
        (body_data->>'direction'),
        (body_data->>'call_direction'),
        (NEW.body->>'direction'), 
        (NEW.body->>'call_direction')
      ),
      COALESCE(
        (body_data->>'agent_id'),
        (body_data->>'agentId'),
        (NEW.body->>'agent_id'), 
        (NEW.body->>'agentId')
      ),
      COALESCE(
        (body_data->>'agent_name'),
        (body_data->>'agentName'),
        (NEW.body->>'agent_name'), 
        (NEW.body->>'agentName')
      ),
      COALESCE(
        (body_data->>'customer_name'),
        (body_data->>'customerName'),
        (body_data->>'contact_name'),
        (body_data->>'contactName'),
        (NEW.body->>'customer_name'), 
        (NEW.body->>'customerName'), 
        (NEW.body->>'contact_name'), 
        (NEW.body->>'contactName')
      ),
      COALESCE(
        (body_data->>'recording_url'),
        (body_data->>'recordingUrl'),
        (body_data->>'recording'),
        (NEW.body->>'recording_url'), 
        (NEW.body->>'recordingUrl'), 
        (NEW.body->>'recording')
      ),
      COALESCE(
        (body_data->>'transcript'),
        (body_data->>'transcription'),
        (body_data->>'text'),
        (NEW.body->>'transcript'), 
        (NEW.body->>'transcription'), 
        (NEW.body->>'text')
      ),
      CASE 
        WHEN (body_data->>'call_start_time') IS NOT NULL THEN (body_data->>'call_start_time')::TIMESTAMPTZ
        WHEN (body_data->>'callStartTime') IS NOT NULL THEN (body_data->>'callStartTime')::TIMESTAMPTZ
        WHEN (body_data->>'start_time') IS NOT NULL THEN (body_data->>'start_time')::TIMESTAMPTZ
        WHEN (body_data->>'startTime') IS NOT NULL THEN (body_data->>'startTime')::TIMESTAMPTZ
        WHEN (body_data->>'timestamp') IS NOT NULL THEN (body_data->>'timestamp')::TIMESTAMPTZ
        WHEN (body_data->>'date') IS NOT NULL THEN (body_data->>'date')::TIMESTAMPTZ
        WHEN (NEW.body->>'call_start_time') IS NOT NULL THEN (NEW.body->>'call_start_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'callStartTime') IS NOT NULL THEN (NEW.body->>'callStartTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'start_time') IS NOT NULL THEN (NEW.body->>'start_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'startTime') IS NOT NULL THEN (NEW.body->>'startTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'timestamp') IS NOT NULL THEN (NEW.body->>'timestamp')::TIMESTAMPTZ
        WHEN (NEW.body->>'date') IS NOT NULL THEN (NEW.body->>'date')::TIMESTAMPTZ
        ELSE NULL
      END,
      CASE 
        WHEN (body_data->>'call_end_time') IS NOT NULL THEN (body_data->>'call_end_time')::TIMESTAMPTZ
        WHEN (body_data->>'callEndTime') IS NOT NULL THEN (body_data->>'callEndTime')::TIMESTAMPTZ
        WHEN (body_data->>'end_time') IS NOT NULL THEN (body_data->>'end_time')::TIMESTAMPTZ
        WHEN (body_data->>'endTime') IS NOT NULL THEN (body_data->>'endTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'call_end_time') IS NOT NULL THEN (NEW.body->>'call_end_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'callEndTime') IS NOT NULL THEN (NEW.body->>'callEndTime')::TIMESTAMPTZ
        WHEN (NEW.body->>'end_time') IS NOT NULL THEN (NEW.body->>'end_time')::TIMESTAMPTZ
        WHEN (NEW.body->>'endTime') IS NOT NULL THEN (NEW.body->>'endTime')::TIMESTAMPTZ
        ELSE NULL
      END,
      COALESCE(
        (body_data->>'call_result'),
        (body_data->>'callResult'),
        (body_data->>'result'),
        (NEW.body->>'call_result'), 
        (NEW.body->>'callResult'), 
        (NEW.body->>'result')
      ),
      COALESCE(
        (body_data->>'callOutcome'),
        (body_data->>'call_outcome'),
        (body_data->>'outcome'),
        (NEW.body->>'call_outcome'), 
        (NEW.body->>'callOutcome'), 
        (NEW.body->>'outcome')
      ),
      COALESCE(
        (body_data->>'contactName'),
        (body_data->>'contact_name'),
        (NEW.body->>'contact_name'), 
        (NEW.body->>'contactName')
      ),
      COALESCE(
        (body_data->>'companyName'),
        (body_data->>'company_name'),
        (NEW.body->>'company_name'), 
        (NEW.body->>'companyName')
      ),
      COALESCE(
        (body_data->>'atecoCode'),
        (body_data->>'ateco_code'),
        (NEW.body->>'ateco_code'), 
        (NEW.body->>'atecoCode')
      ),
      CASE 
        WHEN (body_data->>'atecoEligible') IS NOT NULL THEN (body_data->>'atecoEligible')::BOOLEAN
        WHEN (body_data->>'ateco_eligible') IS NOT NULL THEN (body_data->>'ateco_eligible')::BOOLEAN
        WHEN (NEW.body->>'ateco_eligible') IS NOT NULL THEN (NEW.body->>'ateco_eligible')::BOOLEAN
        WHEN (NEW.body->>'atecoEligible') IS NOT NULL THEN (NEW.body->>'atecoEligible')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (body_data->>'interestConfirmed') IS NOT NULL THEN (body_data->>'interestConfirmed')::BOOLEAN
        WHEN (body_data->>'interest_confirmed') IS NOT NULL THEN (body_data->>'interest_confirmed')::BOOLEAN
        WHEN (NEW.body->>'interest_confirmed') IS NOT NULL THEN (NEW.body->>'interest_confirmed')::BOOLEAN
        WHEN (NEW.body->>'interestConfirmed') IS NOT NULL THEN (NEW.body->>'interestConfirmed')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (body_data->>'electricityBillReceived') IS NOT NULL THEN (body_data->>'electricityBillReceived')::BOOLEAN
        WHEN (body_data->>'electricity_bill_received') IS NOT NULL THEN (body_data->>'electricity_bill_received')::BOOLEAN
        WHEN (NEW.body->>'electricity_bill_received') IS NOT NULL THEN (NEW.body->>'electricity_bill_received')::BOOLEAN
        WHEN (NEW.body->>'electricityBillReceived') IS NOT NULL THEN (NEW.body->>'electricityBillReceived')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (body_data->>'annualConsumptionKwh') IS NOT NULL THEN (body_data->>'annualConsumptionKwh')::INTEGER
        WHEN (body_data->>'annual_consumption_kwh') IS NOT NULL THEN (body_data->>'annual_consumption_kwh')::INTEGER
        WHEN (NEW.body->>'annual_consumption_kwh') IS NOT NULL THEN (NEW.body->>'annual_consumption_kwh')::INTEGER
        WHEN (NEW.body->>'annualConsumptionKwh') IS NOT NULL THEN (NEW.body->>'annualConsumptionKwh')::INTEGER
        WHEN (NEW.body->>'consumption') IS NOT NULL THEN (NEW.body->>'consumption')::INTEGER
        ELSE NULL
      END,
      CASE 
        WHEN (body_data->>'shouldSend') IS NOT NULL THEN (body_data->>'shouldSend')::BOOLEAN
        WHEN (body_data->>'should_send') IS NOT NULL THEN (body_data->>'should_send')::BOOLEAN
        WHEN (NEW.body->>'should_send') IS NOT NULL THEN (NEW.body->>'should_send')::BOOLEAN
        WHEN (NEW.body->>'shouldSend') IS NOT NULL THEN (NEW.body->>'shouldSend')::BOOLEAN
        ELSE NULL
      END,
      COALESCE(
        (body_data->>'reason'),
        (body_data->>'message'),
        (NEW.body->>'reason'), 
        (NEW.body->>'message')
      ),
      COALESCE(NEW.body->'data', NEW.body) as raw_data
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicates if trigger fires multiple times
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The trigger is already created, this just updates the function
-- No need to recreate the trigger

COMMENT ON FUNCTION auto_insert_cloudtalk_call() IS 'Automatically detects and extracts CloudTalk call data from webhook_requests, handling both nested body.data and direct body structures';

