// Script to delete all records from database
// Run with: node delete-all-records.js

import { supabase } from './db.js';

async function deleteAllRecords() {
  console.log('🗑️  Starting deletion of all records...\n');

  try {
    // Delete webhook_requests (delete all where id is not null - matches all)
    console.log('Deleting webhook_requests...');
    const { error: webhookError } = await supabase
      .from('webhook_requests')
      .delete()
      .not('id', 'is', null);
    
    if (webhookError) {
      console.error('Error deleting webhook_requests:', webhookError);
    } else {
      console.log('✅ Deleted all webhook_requests');
    }

    // Delete whatsapp_queue
    console.log('Deleting whatsapp_queue...');
    const { error: queueError } = await supabase
      .from('whatsapp_queue')
      .delete()
      .not('id', 'is', null);
    
    if (queueError) {
      console.error('Error deleting whatsapp_queue:', queueError);
    } else {
      console.log('✅ Deleted all whatsapp_queue');
    }

    // Delete cloudtalk_calls
    console.log('Deleting cloudtalk_calls...');
    const { error: callsError } = await supabase
      .from('cloudtalk_calls')
      .delete()
      .not('id', 'is', null);
    
    if (callsError) {
      console.error('Error deleting cloudtalk_calls:', callsError);
    } else {
      console.log('✅ Deleted all cloudtalk_calls');
    }

    console.log('\n✅ All records deleted successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteAllRecords();

