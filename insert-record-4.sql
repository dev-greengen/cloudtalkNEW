-- Manually insert CloudTalk call data for webhook_requests record ID 4
-- Uses the same extraction logic as the automatic trigger/function
-- Note: This record has is_cloudtalk = false but contains CloudTalk data in body.data

-- First, update is_cloudtalk to true if it has CloudTalk data
UPDATE webhook_requests 
SET is_cloudtalk = TRUE 
WHERE id = 4 
  AND (body ? 'data' OR body->>'callId' IS NOT NULL OR body->>'call_result' IS NOT NULL);

-- Now insert into cloudtalk_calls (handling nested body.data structure)
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
SELECT 
  4 as webhook_request_id,
  -- Handle nested body.data structure
  COALESCE(
    (body->'data'->>'callId'), 
    (body->'data'->>'call_id'), 
    (body->'data'->>'id'),
    (body->>'call_id'), 
    (body->>'callId'), 
    (body->>'id')
  ) as call_id,
  COALESCE((body->>'event_type'), (body->>'eventType'), (body->>'type')) as event_type,
  COALESCE(
    (body->'data'->>'caller_number'),
    (body->'data'->>'phoneNumber'),
    (body->'data'->>'phone_number'),
    (body->>'phone_number'), 
    (body->>'phoneNumber'), 
    (body->>'to'), 
    (body->>'number')
  ) as phone_number,
  COALESCE((body->>'phone_number_from'), (body->>'phoneNumberFrom'), (body->>'from')) as phone_number_from,
  COALESCE((body->>'status'), (body->>'call_status')) as status,
  CASE 
    WHEN (body->>'duration') IS NOT NULL THEN (body->>'duration')::INTEGER
    WHEN (body->>'call_duration') IS NOT NULL THEN (body->>'call_duration')::INTEGER
    ELSE NULL
  END as duration,
  COALESCE((body->>'direction'), (body->>'call_direction')) as direction,
  COALESCE((body->>'agent_id'), (body->>'agentId')) as agent_id,
  COALESCE((body->>'agent_name'), (body->>'agentName')) as agent_name,
  COALESCE((body->>'customer_name'), (body->>'customerName'), (body->>'contact_name'), (body->>'contactName')) as customer_name,
  COALESCE((body->>'recording_url'), (body->>'recordingUrl'), (body->>'recording')) as recording_url,
  COALESCE((body->>'transcript'), (body->>'transcription'), (body->>'text')) as transcript,
  CASE 
    WHEN (body->>'call_start_time') IS NOT NULL THEN (body->>'call_start_time')::TIMESTAMPTZ
    WHEN (body->>'callStartTime') IS NOT NULL THEN (body->>'callStartTime')::TIMESTAMPTZ
    WHEN (body->>'start_time') IS NOT NULL THEN (body->>'start_time')::TIMESTAMPTZ
    WHEN (body->>'startTime') IS NOT NULL THEN (body->>'startTime')::TIMESTAMPTZ
    WHEN (body->>'timestamp') IS NOT NULL THEN (body->>'timestamp')::TIMESTAMPTZ
    WHEN (body->>'date') IS NOT NULL THEN (body->>'date')::TIMESTAMPTZ
    ELSE NULL
  END as call_start_time,
  CASE 
    WHEN (body->>'call_end_time') IS NOT NULL THEN (body->>'call_end_time')::TIMESTAMPTZ
    WHEN (body->>'callEndTime') IS NOT NULL THEN (body->>'callEndTime')::TIMESTAMPTZ
    WHEN (body->>'end_time') IS NOT NULL THEN (body->>'end_time')::TIMESTAMPTZ
    WHEN (body->>'endTime') IS NOT NULL THEN (body->>'endTime')::TIMESTAMPTZ
    ELSE NULL
  END as call_end_time,
  COALESCE(
    (body->'data'->>'call_result'),
    (body->'data'->>'callResult'),
    (body->'data'->>'result'),
    (body->>'call_result'), 
    (body->>'callResult'), 
    (body->>'result')
  ) as call_result,
  COALESCE(
    (body->'data'->>'callOutcome'),
    (body->'data'->>'call_outcome'),
    (body->'data'->>'outcome'),
    (body->>'call_outcome'), 
    (body->>'callOutcome'), 
    (body->>'outcome')
  ) as call_outcome,
  COALESCE(
    (body->'data'->>'contactName'),
    (body->'data'->>'contact_name'),
    (body->>'contact_name'), 
    (body->>'contactName')
  ) as contact_name,
  COALESCE(
    (body->'data'->>'companyName'),
    (body->'data'->>'company_name'),
    (body->>'company_name'), 
    (body->>'companyName')
  ) as company_name,
  COALESCE(
    (body->'data'->>'atecoCode'),
    (body->'data'->>'ateco_code'),
    (body->>'ateco_code'), 
    (body->>'atecoCode')
  ) as ateco_code,
  CASE 
    WHEN (body->'data'->>'atecoEligible') IS NOT NULL THEN (body->'data'->>'atecoEligible')::BOOLEAN
    WHEN (body->'data'->>'ateco_eligible') IS NOT NULL THEN (body->'data'->>'ateco_eligible')::BOOLEAN
    WHEN (body->>'ateco_eligible') IS NOT NULL THEN (body->>'ateco_eligible')::BOOLEAN
    WHEN (body->>'atecoEligible') IS NOT NULL THEN (body->>'atecoEligible')::BOOLEAN
    ELSE NULL
  END as ateco_eligible,
  CASE 
    WHEN (body->'data'->>'interestConfirmed') IS NOT NULL THEN (body->'data'->>'interestConfirmed')::BOOLEAN
    WHEN (body->'data'->>'interest_confirmed') IS NOT NULL THEN (body->'data'->>'interest_confirmed')::BOOLEAN
    WHEN (body->>'interest_confirmed') IS NOT NULL THEN (body->>'interest_confirmed')::BOOLEAN
    WHEN (body->>'interestConfirmed') IS NOT NULL THEN (body->>'interestConfirmed')::BOOLEAN
    ELSE NULL
  END as interest_confirmed,
  CASE 
    WHEN (body->'data'->>'electricityBillReceived') IS NOT NULL THEN (body->'data'->>'electricityBillReceived')::BOOLEAN
    WHEN (body->'data'->>'electricity_bill_received') IS NOT NULL THEN (body->'data'->>'electricity_bill_received')::BOOLEAN
    WHEN (body->>'electricity_bill_received') IS NOT NULL THEN (body->>'electricity_bill_received')::BOOLEAN
    WHEN (body->>'electricityBillReceived') IS NOT NULL THEN (body->>'electricityBillReceived')::BOOLEAN
    ELSE NULL
  END as electricity_bill_received,
  CASE 
    WHEN (body->'data'->>'annualConsumptionKwh') IS NOT NULL THEN (body->'data'->>'annualConsumptionKwh')::INTEGER
    WHEN (body->'data'->>'annual_consumption_kwh') IS NOT NULL THEN (body->'data'->>'annual_consumption_kwh')::INTEGER
    WHEN (body->>'annual_consumption_kwh') IS NOT NULL THEN (body->>'annual_consumption_kwh')::INTEGER
    WHEN (body->>'annualConsumptionKwh') IS NOT NULL THEN (body->>'annualConsumptionKwh')::INTEGER
    WHEN (body->>'consumption') IS NOT NULL THEN (body->>'consumption')::INTEGER
    ELSE NULL
  END as annual_consumption_kwh,
  CASE 
    WHEN (body->'data'->>'shouldSend') IS NOT NULL THEN (body->'data'->>'shouldSend')::BOOLEAN
    WHEN (body->'data'->>'should_send') IS NOT NULL THEN (body->'data'->>'should_send')::BOOLEAN
    WHEN (body->>'should_send') IS NOT NULL THEN (body->>'should_send')::BOOLEAN
    WHEN (body->>'shouldSend') IS NOT NULL THEN (body->>'shouldSend')::BOOLEAN
    ELSE NULL
  END as should_send,
  COALESCE(
    (body->'data'->>'reason'),
    (body->'data'->>'message'),
    (body->>'reason'), 
    (body->>'message')
  ) as reason,
  COALESCE(body->'data', body) as raw_data
FROM webhook_requests
WHERE id = 4
  AND body IS NOT NULL
ON CONFLICT DO NOTHING;

-- Verify the insertion
SELECT * FROM cloudtalk_calls WHERE webhook_request_id = 4;

