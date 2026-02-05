-- Update the trigger function to handle nested body.data structure
-- Run this AFTER creating the trigger to update it

CREATE OR REPLACE FUNCTION auto_insert_cloudtalk_call()
RETURNS TRIGGER AS $$
DECLARE
  call_data JSONB;
BEGIN
  -- Only process if it's a CloudTalk webhook and has a body
  IF NEW.is_cloudtalk = TRUE AND NEW.body IS NOT NULL THEN
    -- Handle nested data structure (body.data) if present
    IF NEW.body ? 'data' THEN
      call_data := NEW.body->'data';
    ELSE
      call_data := NEW.body;
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
      COALESCE((call_data->>'call_id'), (call_data->>'callId'), (call_data->>'id')),
      COALESCE((call_data->>'event_type'), (call_data->>'eventType'), (call_data->>'type')),
      COALESCE((call_data->>'phone_number'), (call_data->>'phoneNumber'), (call_data->>'to'), (call_data->>'number'), (call_data->>'caller_number')),
      COALESCE((call_data->>'phone_number_from'), (call_data->>'phoneNumberFrom'), (call_data->>'from')),
      COALESCE((call_data->>'status'), (call_data->>'call_status')),
      CASE 
        WHEN (call_data->>'duration') IS NOT NULL THEN (call_data->>'duration')::INTEGER
        WHEN (call_data->>'call_duration') IS NOT NULL THEN (call_data->>'call_duration')::INTEGER
        ELSE NULL
      END,
      COALESCE((call_data->>'direction'), (call_data->>'call_direction')),
      COALESCE((call_data->>'agent_id'), (call_data->>'agentId')),
      COALESCE((call_data->>'agent_name'), (call_data->>'agentName')),
      COALESCE((call_data->>'customer_name'), (call_data->>'customerName'), (call_data->>'contact_name'), (call_data->>'contactName')),
      COALESCE((call_data->>'recording_url'), (call_data->>'recordingUrl'), (call_data->>'recording')),
      COALESCE((call_data->>'transcript'), (call_data->>'transcription'), (call_data->>'text')),
      CASE 
        WHEN (call_data->>'call_start_time') IS NOT NULL THEN (call_data->>'call_start_time')::TIMESTAMPTZ
        WHEN (call_data->>'callStartTime') IS NOT NULL THEN (call_data->>'callStartTime')::TIMESTAMPTZ
        WHEN (call_data->>'start_time') IS NOT NULL THEN (call_data->>'start_time')::TIMESTAMPTZ
        WHEN (call_data->>'startTime') IS NOT NULL THEN (call_data->>'startTime')::TIMESTAMPTZ
        WHEN (call_data->>'timestamp') IS NOT NULL THEN (call_data->>'timestamp')::TIMESTAMPTZ
        WHEN (call_data->>'date') IS NOT NULL THEN (call_data->>'date')::TIMESTAMPTZ
        ELSE NULL
      END,
      CASE 
        WHEN (call_data->>'call_end_time') IS NOT NULL THEN (call_data->>'call_end_time')::TIMESTAMPTZ
        WHEN (call_data->>'callEndTime') IS NOT NULL THEN (call_data->>'callEndTime')::TIMESTAMPTZ
        WHEN (call_data->>'end_time') IS NOT NULL THEN (call_data->>'end_time')::TIMESTAMPTZ
        WHEN (call_data->>'endTime') IS NOT NULL THEN (call_data->>'endTime')::TIMESTAMPTZ
        ELSE NULL
      END,
      COALESCE((call_data->>'call_result'), (call_data->>'callResult'), (call_data->>'result')),
      COALESCE((call_data->>'call_outcome'), (call_data->>'callOutcome'), (call_data->>'outcome')),
      COALESCE((call_data->>'contact_name'), (call_data->>'contactName')),
      COALESCE((call_data->>'company_name'), (call_data->>'companyName')),
      COALESCE((call_data->>'ateco_code'), (call_data->>'atecoCode')),
      CASE 
        WHEN (call_data->>'ateco_eligible') IS NOT NULL THEN (call_data->>'ateco_eligible')::BOOLEAN
        WHEN (call_data->>'atecoEligible') IS NOT NULL THEN (call_data->>'atecoEligible')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (call_data->>'interest_confirmed') IS NOT NULL THEN (call_data->>'interest_confirmed')::BOOLEAN
        WHEN (call_data->>'interestConfirmed') IS NOT NULL THEN (call_data->>'interestConfirmed')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (call_data->>'electricity_bill_received') IS NOT NULL THEN (call_data->>'electricity_bill_received')::BOOLEAN
        WHEN (call_data->>'electricityBillReceived') IS NOT NULL THEN (call_data->>'electricityBillReceived')::BOOLEAN
        ELSE NULL
      END,
      CASE 
        WHEN (call_data->>'annual_consumption_kwh') IS NOT NULL THEN (call_data->>'annual_consumption_kwh')::INTEGER
        WHEN (call_data->>'annualConsumptionKwh') IS NOT NULL THEN (call_data->>'annualConsumptionKwh')::INTEGER
        WHEN (call_data->>'consumption') IS NOT NULL THEN (call_data->>'consumption')::INTEGER
        ELSE NULL
      END,
      CASE 
        WHEN (call_data->>'should_send') IS NOT NULL THEN (call_data->>'should_send')::BOOLEAN
        WHEN (call_data->>'shouldSend') IS NOT NULL THEN (call_data->>'shouldSend')::BOOLEAN
        ELSE NULL
      END,
      COALESCE((call_data->>'reason'), (call_data->>'message')),
      call_data
    )
    ON CONFLICT DO NOTHING; -- Prevent duplicates
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

