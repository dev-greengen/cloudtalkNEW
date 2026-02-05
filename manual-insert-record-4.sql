-- Manually insert CloudTalk call data for webhook_requests record ID 4
-- The data is nested under body->'data' in the JSON

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
  COALESCE((body->'data'->>'callId'), (body->'data'->>'call_id'), (body->'data'->>'id')) as call_id,
  NULL as event_type, -- Not in the data
  COALESCE((body->'data'->>'caller_number'), (body->'data'->>'phoneNumber'), (body->'data'->>'phone_number')) as phone_number,
  NULL as phone_number_from, -- Not in the data
  NULL as status, -- Not in the data
  NULL as duration, -- Not in the data
  NULL as direction, -- Not in the data
  NULL as agent_id, -- Not in the data
  NULL as agent_name, -- Not in the data
  COALESCE((body->'data'->>'contactName'), (body->'data'->>'contact_name')) as customer_name,
  NULL as recording_url, -- Not in the data
  NULL as transcript, -- Not in the data
  NULL as call_start_time, -- Not in the data
  NULL as call_end_time, -- Not in the data
  (body->'data'->>'call_result') as call_result,
  (body->'data'->>'callOutcome') as call_outcome,
  COALESCE((body->'data'->>'contactName'), (body->'data'->>'contact_name')) as contact_name,
  COALESCE((body->'data'->>'companyName'), (body->'data'->>'company_name')) as company_name,
  COALESCE((body->'data'->>'atecoCode'), (body->'data'->>'ateco_code')) as ateco_code,
  CASE 
    WHEN (body->'data'->>'atecoEligible') IS NOT NULL THEN (body->'data'->>'atecoEligible')::BOOLEAN
    WHEN (body->'data'->>'ateco_eligible') IS NOT NULL THEN (body->'data'->>'ateco_eligible')::BOOLEAN
    ELSE NULL
  END as ateco_eligible,
  CASE 
    WHEN (body->'data'->>'interestConfirmed') IS NOT NULL THEN (body->'data'->>'interestConfirmed')::BOOLEAN
    WHEN (body->'data'->>'interest_confirmed') IS NOT NULL THEN (body->'data'->>'interest_confirmed')::BOOLEAN
    ELSE NULL
  END as interest_confirmed,
  CASE 
    WHEN (body->'data'->>'electricityBillReceived') IS NOT NULL THEN (body->'data'->>'electricityBillReceived')::BOOLEAN
    WHEN (body->'data'->>'electricity_bill_received') IS NOT NULL THEN (body->'data'->>'electricity_bill_received')::BOOLEAN
    ELSE NULL
  END as electricity_bill_received,
  CASE 
    WHEN (body->'data'->>'annualConsumptionKwh') IS NOT NULL THEN (body->'data'->>'annualConsumptionKwh')::INTEGER
    WHEN (body->'data'->>'annual_consumption_kwh') IS NOT NULL THEN (body->'data'->>'annual_consumption_kwh')::INTEGER
    ELSE NULL
  END as annual_consumption_kwh,
  CASE 
    WHEN (body->'data'->>'shouldSend') IS NOT NULL THEN (body->'data'->>'shouldSend')::BOOLEAN
    WHEN (body->'data'->>'should_send') IS NOT NULL THEN (body->'data'->>'should_send')::BOOLEAN
    ELSE NULL
  END as should_send,
  (body->'data'->>'reason') as reason,
  (body->'data') as raw_data -- Store the nested data object
FROM webhook_requests
WHERE id = 4
ON CONFLICT DO NOTHING;

-- Verify the insertion
SELECT * FROM cloudtalk_calls WHERE webhook_request_id = 4;

