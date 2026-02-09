-- Script to delete all records from all tables
-- WARNING: This will delete ALL data from these tables!

-- Delete all webhook requests (incoming and sent messages)
DELETE FROM webhook_requests;

-- Delete all WhatsApp queue entries
DELETE FROM whatsapp_queue;

-- Delete all CloudTalk calls
DELETE FROM cloudtalk_calls;

-- Optional: Reset auto-increment counters (if using auto-increment IDs)
-- ALTER TABLE webhook_requests AUTO_INCREMENT = 1;
-- ALTER TABLE cloudtalk_calls AUTO_INCREMENT = 1;
-- ALTER TABLE whatsapp_queue AUTO_INCREMENT = 1;

