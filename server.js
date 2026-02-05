import express from 'express';
import { supabase } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Store all requests
const requests = [];

// Parse JSON and text
app.use(express.json({ limit: '10mb', verify: (req, res, buf) => {
  req.rawBody = buf.toString('utf8');
}}));
app.use(express.text({ type: '*/*', limit: '10mb', verify: (req, res, buf) => {
  if (!req.rawBody) req.rawBody = buf.toString('utf8');
}}));

// Function to save request to Supabase
async function saveRequestToDB(requestData) {
  try {
    // Check if it's a CloudTalk webhook by path/user-agent first
    let isCloudTalk = requestData.path.includes('cloudtalk') || 
                      requestData.path.includes('webhook') ||
                      (requestData.headers['user-agent'] && requestData.headers['user-agent'].includes('cloudtalk'));
    
    // Also check body structure for CloudTalk-specific fields (handles nested body.data)
    if (requestData.body && typeof requestData.body === 'object') {
      // Check for nested body.data structure
      const bodyData = requestData.body.data || requestData.body;
      
      // Check if it contains CloudTalk-specific fields
      const hasCloudTalkFields = bodyData.callId || bodyData.call_id || 
                                 bodyData.call_result || bodyData.callResult ||
                                 bodyData.phoneNumber || bodyData.phone_number ||
                                 bodyData.eventType || bodyData.event_type;
      
      if (hasCloudTalkFields) {
        isCloudTalk = true;
      }
    }
    
    // Extract CloudTalk-specific data if present
    let cloudtalkData = null;
    if (requestData.body && typeof requestData.body === 'object') {
      const bodyData = requestData.body.data || requestData.body;
      cloudtalkData = {
        call_id: bodyData.call_id || bodyData.callId || null,
        event_type: bodyData.event_type || bodyData.eventType || null,
        phone_number: bodyData.phone_number || bodyData.phoneNumber || bodyData.caller_number || null,
        status: bodyData.status || null,
        duration: bodyData.duration || null,
        timestamp: bodyData.timestamp || bodyData.date || null
      };
    }
    
    const dbRecord = {
      method: requestData.method,
      path: requestData.path,
      url: requestData.url,
      headers: requestData.headers,
      query: requestData.query,
      body: requestData.body,
      raw_body: requestData.rawBody,
      ip_address: requestData.ip,
      user_agent: requestData.userAgent,
      timestamp: requestData.timestamp,
      is_cloudtalk: isCloudTalk,
      cloudtalk_call_id: cloudtalkData?.call_id || null,
      cloudtalk_event_type: cloudtalkData?.event_type || null,
      cloudtalk_phone_number: cloudtalkData?.phone_number || null,
      cloudtalk_status: cloudtalkData?.status || null,
      cloudtalk_duration: cloudtalkData?.duration || null,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('webhook_requests')
      .insert([dbRecord])
      .select();
    
    if (error) {
      console.error('Error saving to database:', error.message);
      // Don't throw - continue processing even if DB save fails
      return;
    }
    
    const webhookId = data?.[0]?.id;
    console.log(`✅ Saved request to DB: ${requestData.method} ${requestData.path}${isCloudTalk ? ' (CloudTalk)' : ''}`);
    
    // If it's a CloudTalk webhook and we have a body, save to cloudtalk_calls table
    // Note: Database trigger also handles this automatically, but we do it here too for immediate processing
    // The trigger will handle nested body.data structure, so we pass the full body
    if (isCloudTalk && requestData.body && typeof requestData.body === 'object' && webhookId) {
      try {
        // Handle nested body.data structure - pass the actual data object
        const bodyToProcess = requestData.body.data || requestData.body;
        const callData = await saveCloudTalkCallData(webhookId, bodyToProcess);
        
        // Automatically send WhatsApp if phone number is present
        if (callData && callData.phone_number) {
          try {
            await sendWhatsAppMessage(callData.phone_number, webhookId, callData.call_id);
          } catch (whatsappErr) {
            console.error('Error sending WhatsApp (will be queued by trigger):', whatsappErr.message);
            // Don't fail - trigger will queue it as backup
          }
        }
      } catch (err) {
        console.error('Error saving CloudTalk call data (will be handled by DB trigger):', err.message);
        // Don't fail - database trigger will handle it as backup
      }
    }
  } catch (error) {
    console.error('Error in saveRequestToDB:', error.message);
    // Don't throw - continue processing
  }
}

// Function to save CloudTalk call data to separate table
async function saveCloudTalkCallData(webhookRequestId, body) {
  try {
    // Extract all possible fields from CloudTalk webhook body
    const callData = {
      webhook_request_id: webhookRequestId,
      call_id: body.call_id || body.callId || body.id || null,
      event_type: body.event_type || body.eventType || body.type || null,
      phone_number: body.caller_number || body.phone_number || body.phoneNumber || body.to || body.number || null,
      phone_number_from: body.phone_number_from || body.phoneNumberFrom || body.from || null,
      status: body.status || body.call_status || null,
      duration: body.duration || body.call_duration || null,
      direction: body.direction || body.call_direction || null,
      agent_id: body.agent_id || body.agentId || null,
      agent_name: body.agent_name || body.agentName || null,
      customer_name: body.customer_name || body.customerName || body.contact_name || body.contactName || null,
      recording_url: body.recording_url || body.recordingUrl || body.recording || null,
      transcript: body.transcript || body.transcription || body.text || null,
      call_start_time: body.call_start_time || body.callStartTime || body.start_time || body.startTime || body.timestamp || body.date || null,
      call_end_time: body.call_end_time || body.callEndTime || body.end_time || body.endTime || null,
      call_result: body.call_result || body.callResult || body.result || null,
      call_outcome: body.call_outcome || body.callOutcome || body.outcome || null,
      // Extracted data fields (from AI agent)
      contact_name: body.contact_name || body.contactName || null,
      company_name: body.company_name || body.companyName || null,
      ateco_code: body.ateco_code || body.atecoCode || null,
      ateco_eligible: body.ateco_eligible !== undefined ? body.ateco_eligible : (body.atecoEligible !== undefined ? body.atecoEligible : null),
      interest_confirmed: body.interest_confirmed !== undefined ? body.interest_confirmed : (body.interestConfirmed !== undefined ? body.interestConfirmed : null),
      electricity_bill_received: body.electricity_bill_received !== undefined ? body.electricity_bill_received : (body.electricityBillReceived !== undefined ? body.electricityBillReceived : null),
      annual_consumption_kwh: body.annual_consumption_kwh || body.annualConsumptionKwh || body.consumption || null,
      should_send: body.should_send !== undefined ? body.should_send : (body.shouldSend !== undefined ? body.shouldSend : null),
      reason: body.reason || body.message || null,
      raw_data: body // Store entire body as JSONB for reference
    };
    
    const { data, error } = await supabase
      .from('cloudtalk_calls')
      .insert([callData])
      .select();
    
    if (error) {
      // Check if it's a duplicate (trigger might have already inserted)
      if (error.code === '23505' || error.message.includes('duplicate')) {
        console.log(`ℹ️  CloudTalk call data already exists (likely inserted by DB trigger): Call ID ${callData.call_id || 'N/A'}`);
      } else {
        console.error('Error saving CloudTalk call data:', error.message);
      }
      // Don't throw - continue processing
    } else {
      console.log(`✅ Saved CloudTalk call data: Call ID ${callData.call_id || 'N/A'}`);
      return callData; // Return call data for further processing
    }
    return null;
  } catch (error) {
    console.error('Error in saveCloudTalkCallData:', error.message);
    // Don't throw - continue processing
    return null;
  }
}

// Function to send WhatsApp message automatically
async function sendWhatsAppMessage(phoneNumber, webhookRequestId, callId) {
  try {
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
    
    if (!whatsappToken) {
      console.error('WHATSAPP_API_TOKEN not configured');
      return { success: false, error: 'WhatsApp API not configured' };
    }
    
    // Italian message asking for bolletta (electricity bill)
    const message = `Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.`;
    
    // Normalize phone number (remove all non-digits, ensure starts with country code)
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    
    // If Italian number without country code, add 39
    if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
      normalizedPhone = '39' + normalizedPhone;
    }
    
    console.log(`📤 Auto-sending WhatsApp to ${normalizedPhone} (original: ${phoneNumber})`);
    
    // Send WhatsApp message via Whapi.Cloud API
    const response = await fetch(`${whatsappUrl}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: normalizedPhone,
        body: message
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ WhatsApp sent successfully to ${normalizedPhone}`);
      
      // Update queue status if exists
      if (webhookRequestId) {
        try {
          await supabase
            .from('whatsapp_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('webhook_request_id', webhookRequestId)
            .eq('status', 'pending');
        } catch (err) {
          // Queue might not exist yet, that's okay
        }
      }
      
      return { 
        success: true, 
        phone_number: normalizedPhone,
        result 
      };
    } else {
      console.error(`❌ WhatsApp send failed:`, result);
      return { 
        success: false, 
        error: result.error || result.message || 'Failed to send WhatsApp',
        details: result 
      };
    }
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

// Capture all requests after parsing
app.use(async (req, res, next) => {
  // Skip capturing the main page requests to avoid clutter
  if (req.path === '/' && req.method === 'GET') {
    return next();
  }
  
  const timestamp = new Date().toISOString();
  const requestData = {
    id: requests.length + 1,
    timestamp,
    method: req.method,
    path: req.path,
    url: req.url,
    headers: req.headers,
    query: req.query,
    body: req.body || null,
    rawBody: req.rawBody || (req.body ? JSON.stringify(req.body) : null),
    ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
    userAgent: req.get('user-agent') || 'unknown'
  };
  
  requests.unshift(requestData); // Add to beginning
  if (requests.length > 100) requests.pop(); // Keep last 100 requests
  
  // Save to database ONLY for POST requests (async, don't wait)
  if (req.method === 'POST') {
    saveRequestToDB(requestData).catch(err => {
      console.error('Failed to save request to DB:', err.message);
    });
  }
  
  next();
});

// Main endpoint - show all requests
app.get('/', async (req, res) => {
  try {
    // Test Supabase connection and get stats
    let dbStatus = 'connected';
    let dbStats = { total: 0, cloudtalk: 0 };
    
    try {
      const { count: totalCount } = await supabase
        .from('webhook_requests')
        .select('*', { count: 'exact', head: true });
      
      const { count: cloudtalkCount } = await supabase
        .from('webhook_requests')
        .select('*', { count: 'exact', head: true })
        .eq('is_cloudtalk', true);
      
      dbStats.total = totalCount || 0;
      dbStats.cloudtalk = cloudtalkCount || 0;
    } catch (dbError) {
      if (dbError.code === 'PGRST116') {
        dbStatus = 'connected (table not created yet - run create-webhook-table.sql)';
      } else {
        dbStatus = `connected (error: ${dbError.message})`;
      }
    }
    
    // Return HTML page showing all requests
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Webhook Inspector</title>
  <meta charset="utf-8">
  <style>
    body { font-family: monospace; margin: 20px; background: #1e1e1e; color: #d4d4d4; }
    h1 { color: #4ec9b0; }
    .status { color: #4ec9b0; margin-bottom: 20px; }
    .request { background: #252526; padding: 15px; margin: 10px 0; border-left: 3px solid #007acc; }
    .request-header { color: #569cd6; font-weight: bold; margin-bottom: 10px; }
    .method { color: #4ec9b0; }
    .path { color: #ce9178; }
    .timestamp { color: #858585; font-size: 0.9em; }
    .section { margin: 10px 0; }
    .section-title { color: #569cd6; font-weight: bold; margin: 10px 0 5px 0; }
    pre { background: #1e1e1e; padding: 10px; overflow-x: auto; border: 1px solid #3e3e3e; }
    .empty { color: #858585; text-align: center; padding: 40px; }
    .refresh { color: #4ec9b0; text-decoration: none; margin-left: 20px; }
  </style>
  <meta http-equiv="refresh" content="5">
</head>
<body>
  <h1>Webhook Inspector <a href="/" class="refresh">🔄 Auto-refresh (5s)</a></h1>
  <div class="status">
    Supabase: ${dbStatus} | 
    In Memory: ${requests.length} | 
    In DB: ${dbStats.total} (CloudTalk: ${dbStats.cloudtalk}) |
    <a href="/api/webhooks" style="color: #4ec9b0; margin-left: 10px;">View All in DB</a> |
    <a href="/api/cloudtalk-webhooks" style="color: #4ec9b0;">CloudTalk Only</a>
  </div>
  ${requests.length === 0 ? '<div class="empty">No requests yet. Send a request to this URL to see it here.</div>' : ''}
  ${requests.map(req => `
    <div class="request">
      <div class="request-header">
        <span class="method">${req.method}</span> 
        <span class="path">${req.path}</span>
        <span class="timestamp">${req.timestamp}</span>
      </div>
      
      <div class="section">
        <div class="section-title">Headers:</div>
        <pre>${JSON.stringify(req.headers, null, 2)}</pre>
      </div>
      
      ${Object.keys(req.query).length > 0 ? `
      <div class="section">
        <div class="section-title">Query Parameters:</div>
        <pre>${JSON.stringify(req.query, null, 2)}</pre>
      </div>
      ` : ''}
      
      ${req.rawBody || req.body ? `
      <div class="section">
        <div class="section-title">Body (Raw):</div>
        <pre>${req.rawBody || (typeof req.body === 'object' ? JSON.stringify(req.body, null, 2) : String(req.body))}</pre>
      </div>
      ` : ''}
      
      <div class="section">
        <div class="section-title">IP:</div>
        <pre>${req.ip}</pre>
      </div>
      
      ${req.userAgent ? `
      <div class="section">
        <div class="section-title">User Agent:</div>
        <pre>${req.userAgent}</pre>
      </div>
      ` : ''}
    </div>
  `).join('')}
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error</h1><pre>${error.message}</pre>`);
  }
});

// Webhook endpoint - also captured by middleware above (saved automatically)
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Webhook received:', payload);
    
    res.json({ 
      success: true, 
      message: 'Webhook received and saved to database',
      data: payload 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// CloudTalk-specific webhook endpoint
app.post('/webhook/cloudtalk', async (req, res) => {
  try {
    const payload = req.body;
    console.log('CloudTalk webhook received:', payload);
    
    res.json({ 
      success: true, 
      message: 'CloudTalk webhook received and saved to database',
      data: payload 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API endpoint to get requests as JSON
app.get('/api/requests', (req, res) => {
  res.json({ requests, count: requests.length });
});

// Get webhook requests from database
app.get('/api/webhooks', async (req, res) => {
  try {
    const { limit = 100, offset = 0, cloudtalk_only = false } = req.query;
    
    let query = supabase
      .from('webhook_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (cloudtalk_only === 'true') {
      query = query.eq('is_cloudtalk', true);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    res.json({ 
      data, 
      count: data.length,
      total: data.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get CloudTalk webhooks only
app.get('/api/cloudtalk-webhooks', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const { data, error } = await supabase
      .from('webhook_requests')
      .select('*')
      .eq('is_cloudtalk', true)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (error) throw error;
    
    res.json({ data, count: data.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get CloudTalk calls with extracted data
app.get('/api/cloudtalk-calls', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    
    const { data, error } = await supabase
      .from('cloudtalk_calls')
      .select(`
        *,
        webhook_request:webhook_requests(*)
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (error) throw error;
    
    res.json({ data, count: data.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single CloudTalk call by call_id
app.get('/api/cloudtalk-calls/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    
    const { data, error } = await supabase
      .from('cloudtalk_calls')
      .select(`
        *,
        webhook_request:webhook_requests(*)
      `)
      .eq('call_id', callId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (error) throw error;
    
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get last CloudTalk call record with status
app.get('/api/cloudtalk-calls/last/status', async (req, res) => {
  try {
    // Get the last record
    const { data: lastCall, error: callError } = await supabase
      .from('cloudtalk_calls')
      .select(`
        *,
        webhook_request:webhook_requests(*)
      `)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (callError) throw callError;
    
    if (!lastCall) {
      return res.json({ 
        message: 'No records found',
        has_response: false 
      });
    }
    
    // Check if there's a reply (electricity_bill_received = true)
    const hasResponse = lastCall.electricity_bill_received === true;
    
    // If phone number exists, check recent WhatsApp messages for replies
    let recentReply = null;
    if (lastCall.phone_number) {
      try {
        const whatsappToken = process.env.WHATSAPP_API_TOKEN;
        const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
        
        if (whatsappToken) {
          // Normalize phone number
          let normalizedPhone = lastCall.phone_number.replace(/\D/g, '');
          if (normalizedPhone.startsWith('+')) {
            normalizedPhone = normalizedPhone.substring(1);
          }
          if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
            normalizedPhone = '39' + normalizedPhone;
          }
          
          // Get recent messages
          const response = await fetch(`${whatsappUrl}/messages/list?limit=50`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const result = await response.json();
            const incomingMessages = (result.messages || []).filter(msg => 
              msg.from_me === false && 
              msg.type === 'text' &&
              (msg.from === normalizedPhone || 
               msg.from === `+${normalizedPhone}` ||
               msg.from === `39${normalizedPhone}` ||
               msg.from.replace(/\D/g, '') === normalizedPhone.replace(/\D/g, ''))
            );
            
            if (incomingMessages.length > 0) {
              recentReply = {
                message: incomingMessages[0].text?.body || '',
                timestamp: incomingMessages[0].timestamp,
                from: incomingMessages[0].from
              };
            }
          }
        }
      } catch (err) {
        console.error('Error checking WhatsApp messages:', err);
      }
    }
    
    res.json({
      last_record: lastCall,
      has_response: hasResponse,
      electricity_bill_received: lastCall.electricity_bill_received,
      phone_number: lastCall.phone_number,
      recent_reply: recentReply,
      status: hasResponse ? 'Client has replied' : 'Waiting for reply'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WhatsApp sending endpoint (called by database trigger or queue processor)
app.post('/api/send-whatsapp', async (req, res) => {
  try {
    const { phone_number, message, call_id, webhook_request_id } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({ error: 'phone_number is required' });
    }
    
    if (!message) {
      return res.status(400).json({ error: 'message is required' });
    }
    
    // Get WhatsApp API credentials from environment
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
    
    if (!whatsappToken) {
      console.error('WHATSAPP_API_TOKEN not configured');
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    // Normalize phone number (remove all non-digits, ensure starts with country code)
    let normalizedPhone = phone_number.replace(/\D/g, '');
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    
    // If Italian number without country code, add 39
    if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
      normalizedPhone = '39' + normalizedPhone;
    }
    
    console.log(`📤 Sending WhatsApp to ${normalizedPhone} (original: ${phone_number})`);
    
    // Send WhatsApp message via Whapi.Cloud API
    const response = await fetch(`${whatsappUrl}/messages/text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: normalizedPhone,
        body: message
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ WhatsApp sent successfully to ${normalizedPhone}`);
      
      // Update queue status if webhook_request_id is provided
      if (webhook_request_id) {
        try {
          await supabase
            .from('whatsapp_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('webhook_request_id', webhook_request_id)
            .eq('status', 'pending');
        } catch (err) {
          console.error('Error updating queue:', err.message);
        }
      }
      
      res.json({ 
        success: true, 
        message: 'WhatsApp sent successfully',
        phone_number: normalizedPhone,
        result 
      });
    } else {
      console.error(`❌ WhatsApp send failed:`, result);
      res.status(response.status).json({ 
        success: false, 
        error: result.error || result.message || 'Failed to send WhatsApp',
        details: result 
      });
    }
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Webhook endpoint to receive incoming WhatsApp messages from Whapi.Cloud
app.post('/api/whatsapp-webhook', async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log('📥 Incoming WhatsApp webhook:', JSON.stringify(webhookData, null, 2));
    
    // Whapi.Cloud webhook structure: { event, data: { from, to, body, ... } }
    const event = webhookData.event || webhookData.type;
    const messageData = webhookData.data || webhookData.message || webhookData;
    
    // Only process incoming messages (not sent messages)
    if (event === 'messages' || event === 'message' || (messageData && !messageData.from_me)) {
      const fromNumber = messageData.from || messageData.phone_number || messageData.number;
      const messageText = messageData.body?.body || messageData.body || messageData.text || '';
      
      if (!fromNumber) {
        console.log('⚠️  No phone number in incoming message');
        return res.json({ success: true, message: 'No phone number' });
      }
      
      // Normalize phone number
      let normalizedPhone = fromNumber.replace(/\D/g, '');
      if (normalizedPhone.startsWith('+')) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
        normalizedPhone = '39' + normalizedPhone;
      }
      
      console.log(`📨 Message from ${normalizedPhone}: ${messageText.substring(0, 100)}...`);
      
      // Check if we've sent a message to this number (check cloudtalk_calls table)
      const { data: calls, error: callsError } = await supabase
        .from('cloudtalk_calls')
        .select('id, phone_number, electricity_bill_received')
        .or(`phone_number.eq.${normalizedPhone},phone_number.eq.+${normalizedPhone},phone_number.eq.39${normalizedPhone},phone_number.like.%${normalizedPhone}%`);
      
      if (callsError) {
        console.error('Error querying cloudtalk_calls:', callsError);
        return res.json({ success: true, message: 'Error querying database' });
      }
      
      if (calls && calls.length > 0) {
        // Found calls for this number - update electricity_bill_received to true
        const callIds = calls.map(call => call.id);
        
        const { error: updateError } = await supabase
          .from('cloudtalk_calls')
          .update({ 
            electricity_bill_received: true,
            updated_at: new Date().toISOString()
          })
          .in('id', callIds)
          .eq('electricity_bill_received', false); // Only update if not already true
        
        if (updateError) {
          console.error('Error updating electricity_bill_received:', updateError);
        } else {
          console.log(`✅ Updated electricity_bill_received=true for ${callIds.length} call(s) from ${normalizedPhone}`);
        }
        
        // Also save the incoming message to webhook_requests for tracking
        try {
          await supabase
            .from('webhook_requests')
            .insert([{
              method: 'POST',
              path: '/api/whatsapp-webhook',
              url: req.url,
              headers: req.headers,
              body: webhookData,
              raw_body: JSON.stringify(webhookData),
              ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
              user_agent: req.get('user-agent') || 'Whapi.Cloud-Webhook',
              timestamp: new Date().toISOString(),
              is_cloudtalk: false,
              created_at: new Date().toISOString()
            }]);
        } catch (saveError) {
          console.error('Error saving webhook:', saveError);
        }
      } else {
        console.log(`ℹ️  Message from ${normalizedPhone} but no matching calls found`);
      }
    }
    
    res.json({ success: true, message: 'Webhook processed' });
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Polling endpoint to check for new incoming messages and update electricity_bill_received
app.get('/api/check-whatsapp-replies', async (req, res) => {
  try {
    const { limit = 200 } = req.query; // Increased default limit
    
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
    
    if (!whatsappToken) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    // Get recent messages from Whapi.Cloud - get more messages to ensure we catch recent ones
    // Try to get messages from last 24 hours by requesting a larger limit
    const response = await fetch(`${whatsappUrl}/messages/list?limit=${Math.max(parseInt(limit), 500)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({ 
        success: false, 
        error: result.error || result.message || 'Failed to fetch messages',
        details: result 
      });
    }
    
    // Filter to only incoming messages (from_me: false)
    // Include text, image, document, and voice messages (could be the bill)
    const allIncoming = (result.messages || []).filter(msg => {
      if (msg.from_me === true) return false;
      
      const msgType = msg.type;
      // Accept text, image, document (PDF, etc.), and voice messages
      if (msgType === 'text' && msg.text?.body) return true;
      if (msgType === 'image') return true; // Could be bill photo
      if (msgType === 'document') return true; // Could be PDF bill
      if (msgType === 'voice') return true; // Voice message
      if (msgType === 'link_preview') return true; // Link previews
      
      return false;
    });
    
    // Sort by timestamp descending (most recent first) to ensure we process newest messages
    const incomingMessages = allIncoming.sort((a, b) => {
      const tsA = a.timestamp || 0;
      const tsB = b.timestamp || 0;
      return tsB - tsA; // Descending order (newest first)
    });
    
    console.log(`📥 Found ${incomingMessages.length} incoming messages (total fetched: ${result.messages?.length || 0})`);
    if (incomingMessages.length > 0) {
      const latest = incomingMessages[0];
      const latestTime = latest.timestamp ? new Date(latest.timestamp * 1000).toISOString() : 'N/A';
      console.log(`📅 Most recent message timestamp: ${latestTime}`);
    }
    
    let updatedCount = 0;
    const updates = [];
    
    // Process each incoming message
    for (const message of incomingMessages) {
      const fromNumber = message.from || message.phone_number || message.chat_id?.split('@')[0];
      if (!fromNumber) {
        console.log('⚠️  Skipping message - no phone number found:', message.id);
        continue;
      }
      
      // Normalize phone number
      let normalizedPhone = fromNumber.replace(/\D/g, '');
      if (normalizedPhone.startsWith('+')) {
        normalizedPhone = normalizedPhone.substring(1);
      }
      if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
        normalizedPhone = '39' + normalizedPhone;
      }
      
      console.log(`📨 Processing message from ${normalizedPhone} (original: ${fromNumber}), type: ${message.type}`);
      
      // Check if we've sent a message to this number
      // Get all calls and match by normalizing phone numbers
      const { data: allCalls, error: callsError } = await supabase
        .from('cloudtalk_calls')
        .select('id, phone_number, electricity_bill_received')
        .not('phone_number', 'is', null);
      
      if (callsError) {
        console.error('Error querying cloudtalk_calls:', callsError);
        continue;
      }
      
      // Normalize and match phone numbers - simplified approach
      const calls = (allCalls || []).filter(call => {
        if (!call.phone_number) return false;
        
        // Normalize both numbers to digits only, then compare last 10 digits
        const normalizePhone = (phone) => {
          let normalized = String(phone).replace(/\D/g, ''); // Remove all non-digits
          // If it starts with +, remove it
          if (normalized.startsWith('+')) {
            normalized = normalized.substring(1);
          }
          // Return last 10 digits (Italian number) or full number if shorter
          return normalized.length >= 10 ? normalized.slice(-10) : normalized;
        };
        
        const dbPhoneNormalized = normalizePhone(call.phone_number);
        const whatsappPhoneNormalized = normalizePhone(normalizedPhone);
        
        // Also try full number comparison (with country code)
        const dbPhoneFull = String(call.phone_number).replace(/\D/g, '').replace(/^\+/, '');
        const whatsappPhoneFull = normalizedPhone.replace(/\D/g, '').replace(/^\+/, '');
        
        const matches = (
          dbPhoneNormalized === whatsappPhoneNormalized || // Last 10 digits match
          dbPhoneFull === whatsappPhoneFull || // Full number match
          dbPhoneFull.endsWith(whatsappPhoneNormalized) || // DB ends with WhatsApp last 10
          whatsappPhoneFull.endsWith(dbPhoneNormalized) // WhatsApp ends with DB last 10
        );
        
        if (matches) {
          console.log(`✅ Phone match found: DB="${call.phone_number}" (last10: ${dbPhoneNormalized}) === WhatsApp="${fromNumber}" (last10: ${whatsappPhoneNormalized})`);
        }
        
        return matches;
      });
      
      if (callsError) {
        console.error('Error querying cloudtalk_calls:', callsError);
        continue;
      }
      
      if (calls && calls.length > 0) {
        console.log(`📞 Found ${calls.length} matching call(s) for ${normalizedPhone}`);
        // Filter to only update records where electricity_bill_received is false or null
        const callsToUpdate = calls.filter(call => {
          const value = call.electricity_bill_received;
          return value !== true && value !== 'true' && value !== 1;
        });
        
        console.log(`📝 ${callsToUpdate.length} call(s) need updating (current values: ${calls.map(c => c.electricity_bill_received).join(', ')})`);
        
        if (callsToUpdate.length > 0) {
          const callIds = callsToUpdate.map(call => call.id);
          
          const { error: updateError } = await supabase
            .from('cloudtalk_calls')
            .update({ 
              electricity_bill_received: true,
              updated_at: new Date().toISOString()
            })
            .in('id', callIds);
          
          if (!updateError) {
            updatedCount += callIds.length;
            updates.push({
              phone_number: normalizedPhone,
              message_preview: message.text?.body?.substring(0, 50) || '',
              calls_updated: callIds.length
            });
            console.log(`✅ Updated electricity_bill_received=true for ${callIds.length} call(s) from ${normalizedPhone}`);
          }
        }
      }
    }
    
    res.json({ 
      success: true,
      checked: incomingMessages.length,
      updated: updatedCount,
      updates: updates,
      message: `Checked ${incomingMessages.length} incoming messages, updated ${updatedCount} call records`
    });
  } catch (error) {
    console.error('Error checking WhatsApp replies:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get last sent WhatsApp messages from Whapi
app.get('/api/whatsapp-messages', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
    
    if (!whatsappToken) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    const response = await fetch(`${whatsappUrl}/messages/list?limit=${limit}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Filter to show only sent messages (from_me: true)
      const sentMessages = result.messages?.filter(msg => msg.from_me === true) || [];
      
      res.json({ 
        success: true,
        total: result.count || 0,
        sent_count: sentMessages.length,
        messages: sentMessages,
        all_messages: result.messages || []
      });
    } else {
      res.status(response.status).json({ 
        success: false, 
        error: result.error || result.message || 'Failed to fetch messages',
        details: result 
      });
    }
  } catch (error) {
    console.error('Error fetching WhatsApp messages:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Process WhatsApp queue (can be called periodically)
app.post('/api/process-whatsapp-queue', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get pending messages from queue
    const { data: queueItems, error } = await supabase
      .from('whatsapp_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));
    
    if (error) throw error;
    
    if (!queueItems || queueItems.length === 0) {
      return res.json({ processed: 0, message: 'No pending messages' });
    }
    
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
    
    if (!whatsappToken) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    let processed = 0;
    let failed = 0;
    
    for (const item of queueItems) {
      try {
        // Normalize phone number
        let normalizedPhone = item.phone_number.replace(/\D/g, '');
        if (normalizedPhone.startsWith('+')) {
          normalizedPhone = normalizedPhone.substring(1);
        }
        if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
          normalizedPhone = '39' + normalizedPhone;
        }
        
        // Send WhatsApp
        const response = await fetch(`${whatsappUrl}/messages/text`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            to: normalizedPhone,
            body: item.message
          })
        });
        
        if (response.ok) {
          await supabase
            .from('whatsapp_queue')
            .update({ 
              status: 'sent', 
              sent_at: new Date().toISOString() 
            })
            .eq('id', item.id);
          processed++;
        } else {
          const errorData = await response.json();
          await supabase
            .from('whatsapp_queue')
            .update({ 
              status: 'failed', 
              error_message: errorData.error || errorData.message 
            })
            .eq('id', item.id);
          failed++;
        }
      } catch (err) {
        await supabase
          .from('whatsapp_queue')
          .update({ 
            status: 'failed', 
            error_message: err.message 
          })
          .eq('id', item.id);
        failed++;
      }
    }
    
    res.json({ 
      processed, 
      failed, 
      total: queueItems.length 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Example: Get data from database
app.get('/data', async (req, res) => {
  try {
    const { table } = req.query;
    
    if (!table) {
      return res.status(400).json({ error: 'Table name required' });
    }
    
    const { data, error } = await supabase
      .from(table)
      .select('*');
    
    if (error) throw error;
    
    res.json({ data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export for Vercel serverless
export default app;

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Supabase connection initialized');
  });
}

