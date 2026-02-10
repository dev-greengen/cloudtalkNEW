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
    console.log(`💾 Attempting to save request: ${requestData.method} ${requestData.path}`);
    
    // Check if it's a CloudTalk webhook by path/user-agent first
    let isCloudTalk = requestData.path.includes('cloudtalk') || 
                      requestData.path.includes('webhook') ||
                      (requestData.headers['user-agent'] && requestData.headers['user-agent'].includes('cloudtalk'));
    
    console.log(`🔍 Initial isCloudTalk check: ${isCloudTalk} (path: ${requestData.path}, user-agent: ${requestData.headers['user-agent']?.substring(0, 50) || 'none'})`);
    
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
        console.log(`✅ Detected CloudTalk webhook by body fields`);
      } else {
        console.log(`ℹ️  Body does not contain CloudTalk fields. Body keys: ${Object.keys(bodyData).join(', ')}`);
      }
    } else {
      console.log(`ℹ️  Body is not an object or is null`);
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
    
    console.log(`💾 Attempting to insert into webhook_requests table...`);
    let data, error;
    try {
      console.log(`💾 Calling Supabase insert...`);
      const result = await supabase
      .from('webhook_requests')
      .insert([dbRecord])
      .select();
      console.log(`💾 Supabase insert result received. Has data: ${!!result?.data}, has error: ${!!result?.error}`);
      data = result.data;
      error = result.error;
    } catch (fetchError) {
      console.error('❌ Fetch error when saving to database:', fetchError.message);
      console.error('❌ Fetch error type:', fetchError.constructor.name);
      console.error('❌ Fetch error stack:', fetchError.stack);
      // Check if it's a network error
      if (fetchError.message && fetchError.message.includes('fetch failed')) {
        console.error('❌ This is a network/fetch error. Possible causes:');
        console.error('   - Supabase URL is incorrect or unreachable');
        console.error('   - Network timeout');
        console.error('   - DNS resolution failed');
        console.error('   - SSL/TLS certificate issue');
      }
      // Don't throw - continue processing even if DB save fails
      return;
    }
    
    if (error) {
      console.error('❌ Error saving to database:', error.message);
      console.error('❌ Error code:', error.code);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      // Don't throw - continue processing even if DB save fails
      return;
    }
    
    console.log(`💾 Database insert successful. Data:`, data ? JSON.stringify(data, null, 2).substring(0, 200) : 'null');
    const webhookId = data?.[0]?.id;
    console.log(`✅ Saved request to DB: ${requestData.method} ${requestData.path}${isCloudTalk ? ' (CloudTalk)' : ''} - ID: ${webhookId || 'NO ID RETURNED'}`);
    
    // If it's a CloudTalk webhook and we have a body, save to cloudtalk_calls table
    // Note: Database trigger also handles this automatically, but we do it here too for immediate processing
    // The trigger will handle nested body.data structure, so we pass the full body
    console.log(`🔍 Checking CloudTalk processing: isCloudTalk=${isCloudTalk}, hasBody=${!!requestData.body}, isObject=${typeof requestData.body === 'object'}, webhookId=${webhookId}`);
    
    if (isCloudTalk && requestData.body && typeof requestData.body === 'object' && webhookId) {
      console.log(`📞 Processing CloudTalk webhook...`);
      try {
        // Handle nested body.data structure - pass the actual data object
        const bodyToProcess = requestData.body.data || requestData.body;
        console.log(`📋 Processing body data. Keys: ${Object.keys(bodyToProcess).join(', ')}`);
        const callData = await saveCloudTalkCallData(webhookId, bodyToProcess);
        
        if (callData) {
          console.log(`✅ CloudTalk call data saved. Phone: ${callData.phone_number || 'N/A'}, Call ID: ${callData.call_id || 'N/A'}, shouldSend: ${callData.should_send} (ignored - always send if phone exists)`);
        
        // Automatically send WhatsApp if phone number is present (always send, ignore shouldSend flag)
          if (callData.phone_number) {
            console.log(`📱 Attempting to send WhatsApp to ${callData.phone_number}... (shouldSend flag is ignored - sending always)`);
            try {
              const result = await sendWhatsAppMessage(callData.phone_number, webhookId, callData.call_id);
              if (result.success) {
                console.log(`✅ WhatsApp sent successfully to ${callData.phone_number}`);
              } else {
                console.error(`❌ WhatsApp send failed: ${result.error}`);
              }
          } catch (whatsappErr) {
              console.error('❌ Error sending WhatsApp (will be queued by trigger):', whatsappErr.message);
              console.error('❌ Error stack:', whatsappErr.stack);
            // Don't fail - trigger will queue it as backup
          }
          } else {
            console.log(`⚠️  No phone number found in call data. Cannot send WhatsApp.`);
          }
        } else {
          console.log(`⚠️  saveCloudTalkCallData returned null - call data not saved`);
        }
      } catch (err) {
        console.error('❌ Error saving CloudTalk call data (will be handled by DB trigger):', err.message);
        console.error('❌ Error stack:', err.stack);
        // Don't fail - database trigger will handle it as backup
      }
    } else {
      console.log(`ℹ️  Skipping CloudTalk processing: isCloudTalk=${isCloudTalk}, hasBody=${!!requestData.body}, isObject=${typeof requestData.body === 'object'}, webhookId=${webhookId}`);
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
    
    console.log(`💾 Attempting to insert CloudTalk call data. Phone: ${callData.phone_number || 'N/A'}, Call ID: ${callData.call_id || 'N/A'}`);
    
    const { data, error } = await supabase
      .from('cloudtalk_calls')
      .insert([callData])
      .select();
    
    if (error) {
      // Check if it's a duplicate (trigger might have already inserted)
      if (error.code === '23505' || error.message.includes('duplicate')) {
        console.log(`ℹ️  CloudTalk call data already exists (likely inserted by DB trigger): Call ID ${callData.call_id || 'N/A'}`);
        // Try to fetch the existing record
        const { data: existing } = await supabase
          .from('cloudtalk_calls')
          .select('*')
          .eq('webhook_request_id', webhookRequestId)
          .limit(1)
          .single();
        if (existing) {
          console.log(`✅ Found existing CloudTalk call record, returning it`);
          return existing;
        }
      } else {
        console.error('❌ Error saving CloudTalk call data:', error.message);
        console.error('❌ Error code:', error.code);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
      }
      // Don't throw - continue processing
    } else {
      console.log(`✅ Saved CloudTalk call data: Call ID ${callData.call_id || 'N/A'}, Phone: ${callData.phone_number || 'N/A'}`);
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
    const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
    
    console.log('🔧 WhatsApp API Configuration Check:');
    console.log('🔧 WHATSAPP_API_TOKEN:', whatsappToken ? whatsappToken.substring(0, 20) + '...' : 'NOT SET');
    console.log('🔧 WHATSAPP_API_URL:', whatsappUrl || 'NOT SET');
    console.log('🔧 WHATSAPP_API_URL type:', typeof whatsappUrl);
    console.log('🔧 WHATSAPP_API_URL length:', whatsappUrl ? whatsappUrl.length : 0);
    
    if (!whatsappToken) {
      console.error('❌ WHATSAPP_API_TOKEN not configured');
      return { success: false, error: 'WhatsApp API not configured' };
    }
    
    if (!whatsappUrl || whatsappUrl.trim() === '') {
      console.error('❌ WHATSAPP_API_URL not configured or empty');
      console.error('❌ Current value:', JSON.stringify(whatsappUrl));
      console.error('❌ All env vars starting with WHATSAPP:', Object.keys(process.env).filter(k => k.startsWith('WHATSAPP')));
      return { success: false, error: 'WhatsApp API URL not configured' };
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
    
    // Send WhatsApp message via Wasender API
    // Wasender endpoint for sending messages - try multiple possible endpoints
    // If URL already ends with /api, don't add it again
    const baseUrl = whatsappUrl.endsWith('/api') ? whatsappUrl : whatsappUrl;
    const apiPrefix = baseUrl.endsWith('/api') ? '' : '/api';
    
    const possibleSendEndpoints = [
      `${baseUrl}${apiPrefix}/send`,
      `${baseUrl}/send`,
      `${baseUrl}${apiPrefix}/send-message`,
      `${baseUrl}/messages/send`,
      `${baseUrl}/messages/text`
    ];
    
    let sendEndpoint = possibleSendEndpoints[0]; // Default to first
    let response;
    let lastSendError;
    
    // Try each endpoint until one works
    for (const endpoint of possibleSendEndpoints) {
      console.log(`📤 Trying to send via: ${endpoint}`);
      try {
        response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: normalizedPhone,
        body: message
          }),
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        console.log(`✅ Got response from ${endpoint}, status: ${response.status}`);
        sendEndpoint = endpoint; // Use this endpoint
        break; // Success, exit loop
      } catch (fetchErr) {
        console.log(`❌ Send failed for ${endpoint}:`, fetchErr.message);
        lastSendError = fetchErr;
        // Continue to next endpoint
        continue;
      }
    }
    
    // If all endpoints failed, throw error
    if (!response) {
      console.error('❌ All send endpoints failed');
      throw lastSendError || new Error('All Wasender send endpoints failed');
    }
    
    // Check response content type before parsing JSON
    const contentType = response.headers.get('content-type') || '';
    console.log(`📋 Response Content-Type: ${contentType}`);
    console.log(`📋 Response Status: ${response.status}`);
    
    let result;
    if (contentType.includes('application/json')) {
      try {
        result = await response.json();
      } catch (jsonErr) {
        const text = await response.text();
        console.error('❌ Failed to parse JSON response:', jsonErr.message);
        console.error('❌ Response text (first 500 chars):', text.substring(0, 500));
        throw new Error(`Invalid JSON response from Wasender API: ${text.substring(0, 100)}`);
      }
    } else {
      // Response is not JSON - probably HTML error page
      const text = await response.text();
      console.error('❌ Wasender API returned non-JSON response (probably HTML error page)');
      console.error('❌ Response status:', response.status);
      console.error('❌ Response Content-Type:', contentType);
      console.error('❌ Response text (first 500 chars):', text.substring(0, 500));
      throw new Error(`Wasender API returned HTML instead of JSON (status: ${response.status}). Check endpoint URL and authentication.`);
    }
    
    if (response.ok) {
      console.log(`✅ WhatsApp sent successfully to ${normalizedPhone}`);
      
      // Save sent message to database for monitoring
      try {
        await supabase
          .from('webhook_requests')
          .insert([{
            method: 'POST',
            path: '/api/send-whatsapp',
            url: '/api/send-whatsapp',
            headers: {},
            query: {},
            body: {
              from_me: true,
              to: normalizedPhone,
              phone_number: normalizedPhone,
              text: message,
              body: message,
              type: 'text',
              timestamp: Math.floor(Date.now() / 1000),
              message: { body: message, to: normalizedPhone }
            },
            raw_body: JSON.stringify({ to: normalizedPhone, body: message }),
            ip_address: 'system',
            user_agent: 'WhatsApp-Sender',
            timestamp: new Date().toISOString(),
            is_cloudtalk: false,
            created_at: new Date().toISOString()
          }]);
        console.log(`✅ Saved sent message to database for ${normalizedPhone}`);
      } catch (dbErr) {
        console.error('Error saving sent message to database:', dbErr.message);
        // Don't fail - continue
      }
      
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

// Test endpoint to verify routing works
app.get('/test-monitor', (req, res) => {
  res.send('Monitor endpoint test - OK');
});

// Real-time monitoring page for incoming WhatsApp messages (defined early to avoid middleware issues)
app.get('/monitor', async (req, res) => {
  console.log('📱 Monitor endpoint called');
  try {
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Monitor Messaggi WhatsApp - Real-Time</title>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 15px;
    }
    .header .status {
      font-size: 0.6em;
      opacity: 0.9;
      margin-top: 10px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 2px solid #e9ecef;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-card .number {
      font-size: 2.5em;
      font-weight: bold;
      color: #25D366;
      margin-bottom: 5px;
    }
    .stat-card .label {
      color: #666;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .messages-container {
      padding: 30px;
      max-height: 600px;
      overflow-y: auto;
    }
    .message {
      background: #f8f9fa;
      border-left: 4px solid #25D366;
      padding: 20px;
      margin-bottom: 15px;
      border-radius: 8px;
      transition: all 0.3s ease;
      animation: slideIn 0.3s ease;
    }
    .message.new {
      background: #e8f5e9;
      border-left-color: #4caf50;
      animation: highlight 0.5s ease;
    }
    .message.sent {
      background: #e3f2fd;
      border-left-color: #2196F3;
    }
    .message.sent.new {
      background: #bbdefb;
      border-left-color: #1976D2;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes highlight {
      0%, 100% { background: #e8f5e9; }
      50% { background: #c8e6c9; }
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      flex-wrap: wrap;
      gap: 10px;
    }
    .message-phone {
      font-weight: bold;
      color: #25D366;
      font-size: 1.1em;
    }
    .message-time {
      color: #666;
      font-size: 0.9em;
    }
    .message-text {
      color: #333;
      line-height: 1.6;
      margin-top: 10px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message-type {
      display: inline-block;
      background: #25D366;
      color: white;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 0.8em;
      margin-left: 10px;
    }
    .empty {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }
    .empty-icon {
      font-size: 4em;
      margin-bottom: 20px;
    }
    .refresh-info {
      text-align: center;
      padding: 15px;
      background: #e3f2fd;
      color: #1976d2;
      font-size: 0.9em;
    }
    .controls {
      padding: 20px 30px;
      background: #f8f9fa;
      border-top: 2px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 15px;
    }
    .btn {
      background: #25D366;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 1em;
      transition: all 0.3s ease;
    }
    .btn:hover {
      background: #128C7E;
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(37, 211, 102, 0.4);
    }
    .auto-refresh {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .auto-refresh input[type="checkbox"] {
      width: 20px;
      height: 20px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>
        <span>📱</span>
        Monitor Messaggi WhatsApp
      </h1>
      <div class="status">Aggiornamento automatico ogni 5 secondi | Fonte: <span id="data-source">API WhatsApp</span></div>
    </div>
    
    <div class="stats" id="stats">
      <div class="stat-card">
        <div class="number" id="total-messages">0</div>
        <div class="label">Messaggi Totali</div>
      </div>
      <div class="stat-card">
        <div class="number" id="new-messages">0</div>
        <div class="label">Nuovi Oggi</div>
      </div>
      <div class="stat-card">
        <div class="number" id="last-update">--:--</div>
        <div class="label">Ultimo Aggiornamento</div>
      </div>
    </div>
    
    <div class="controls">
      <button class="btn" onclick="refreshMessages()">🔄 Aggiorna Ora</button>
      <div class="auto-refresh">
        <label>
          <input type="checkbox" id="auto-refresh" checked onchange="toggleAutoRefresh()">
          Auto-refresh (5s)
        </label>
      </div>
    </div>
    
    <div class="messages-container" id="messages-container">
      <div class="empty">
        <div class="empty-icon">📭</div>
        <div>Caricamento messaggi...</div>
      </div>
    </div>
    
    <div class="refresh-info">
      ⏱️ Prossimo aggiornamento automatico tra <span id="countdown">5</span> secondi
    </div>
  </div>

  <script>
    let lastTimestamp = null;
    let autoRefreshInterval = null;
    let countdownInterval = null;
    let messageIds = new Set();

    async function loadMessages() {
      try {
        const url = '/api/whatsapp-incoming?limit=50' + (lastTimestamp ? '&since=' + lastTimestamp : '');
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error('HTTP error! status: ' + response.status);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Update data source indicator
          const sourceElement = document.getElementById('data-source');
          if (sourceElement) {
            if (data.source === 'database') {
              sourceElement.textContent = 'Database (fallback)';
              sourceElement.style.color = '#ff9800';
            } else {
              sourceElement.textContent = 'API Wasender';
              sourceElement.style.color = '#25D366';
            }
          }
          updateStats(data);
          displayMessages(data.messages || []);
          if (data.last_timestamp) {
            lastTimestamp = data.last_timestamp;
          }
          // Never show error if success is true - even if there's an error field, we have data
        } else {
          // Only show error if success is false AND we don't have messages
          // But since we always return success: true now, this should rarely happen
          if (!data.messages || data.messages.length === 0) {
            // Don't log to console - just show empty state
            const container = document.getElementById('messages-container');
            container.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div>Nessun messaggio disponibile</div></div>';
          } else {
            // We have messages even though success is false - show them anyway
            updateStats(data);
            displayMessages(data.messages || []);
          }
        }
      } catch (error) {
        console.error('Error:', error);
        const container = document.getElementById('messages-container');
        container.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Errore nel caricamento: ' + error.message + '</div></div>';
      }
    }

    function updateStats(data) {
      document.getElementById('total-messages').textContent = data.incoming_count || 0;
      document.getElementById('last-update').textContent = new Date().toLocaleTimeString('it-IT');
      
      let newCount = 0;
      if (data.messages && Array.isArray(data.messages)) {
      data.messages.forEach(msg => {
          if (msg.id && !messageIds.has(msg.id)) {
          newCount++;
          messageIds.add(msg.id);
        }
      });
      }
      document.getElementById('new-messages').textContent = newCount;
    }

    function displayMessages(messages) {
      const container = document.getElementById('messages-container');
      
      if (messages.length === 0) {
        container.innerHTML = '<div class="empty"><div class="empty-icon">📭</div><div>Nessun messaggio in arrivo</div></div>';
        return;
      }
      
      let html = '';
      messages.forEach(msg => {
        const msgId = msg.id || (msg.timestamp + '-' + (msg.from || msg.phone_number));
        const isNew = msg.id ? !messageIds.has(msg.id) : true;
        if (msg.id) {
          messageIds.add(msg.id);
        }
        const phone = msg.phone_number || (msg.from ? msg.from.replace('@s.whatsapp.net', '') : '') || 'Sconosciuto';
        const text = msg.text || '(messaggio non testuale)';
        const time = msg.timestamp_readable || 'N/A';
        const type = msg.type || 'text';
        const isSent = msg.from_me === true;
        const messageClass = 'message ' + (isNew ? 'new' : '') + (isSent ? ' sent' : '');
        const phoneLabel = isSent ? '📤 Inviato a' : '📞 Da';
        
        html += '<div class="' + messageClass + '" data-id="' + msgId + '">' +
          '<div class="message-header">' +
            '<div>' +
              '<span class="message-phone">' + phoneLabel + ' ' + phone + '</span>' +
              '<span class="message-type">' + type + '</span>' +
              (isSent ? '<span style="background: #2196F3; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.8em; margin-left: 10px;">Inviato</span>' : '') +
            '</div>' +
            '<div class="message-time">' + time + '</div>' +
          '</div>' +
          '<div class="message-text">' + escapeHtml(text) + '</div>' +
        '</div>';
      });
      
      container.innerHTML = html;
      container.scrollTop = 0;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function refreshMessages() {
      loadMessages();
    }

    function toggleAutoRefresh() {
      const checkbox = document.getElementById('auto-refresh');
      if (checkbox.checked) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    }

    function startAutoRefresh() {
      if (autoRefreshInterval) clearInterval(autoRefreshInterval);
      if (countdownInterval) clearInterval(countdownInterval);
      
      let countdown = 5;
      document.getElementById('countdown').textContent = countdown;
      
      countdownInterval = setInterval(() => {
        countdown--;
        if (countdown <= 0) countdown = 5;
        document.getElementById('countdown').textContent = countdown;
      }, 1000);
      
      autoRefreshInterval = setInterval(() => {
        loadMessages();
      }, 5000);
    }

    function stopAutoRefresh() {
      if (autoRefreshInterval) clearInterval(autoRefreshInterval);
      if (countdownInterval) clearInterval(countdownInterval);
      document.getElementById('countdown').textContent = '--';
    }

    loadMessages();
    startAutoRefresh();
  </script>
</body>
</html>`;
    
    res.send(html);
  } catch (error) {
    console.error('Monitor endpoint error:', error);
    res.status(500).send('<h1>Error</h1><pre>' + error.message + '</pre>');
  }
});

// Capture all requests after parsing
app.use(async (req, res, next) => {
  // Skip capturing the main page requests and monitor page to avoid clutter
  if ((req.path === '/' || req.path === '/monitor') && req.method === 'GET') {
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
    console.log(`📥 POST request received: ${req.path}`);
    console.log(`📋 Body type: ${typeof req.body}, is object: ${typeof req.body === 'object'}`);
    if (req.body && typeof req.body === 'object') {
      console.log(`📋 Body keys: ${Object.keys(req.body).join(', ')}`);
    }
    saveRequestToDB(requestData).catch(err => {
      console.error('❌ Failed to save request to DB:', err.message);
      console.error('❌ Error stack:', err.stack);
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
    <a href="/api/cloudtalk-webhooks" style="color: #4ec9b0;">CloudTalk Only</a> |
    <a href="/monitor" style="color: #25D366; font-weight: bold;">📱 Monitor WhatsApp</a>
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
    console.log('📞 CloudTalk webhook received at /webhook/cloudtalk');
    console.log('📋 Full payload:', JSON.stringify(payload, null, 2));
    console.log('📋 Payload keys:', Object.keys(payload || {}).join(', '));
    
    // Check for nested data structure
    if (payload && payload.data) {
      console.log('📋 Found nested data structure');
      console.log('📋 Data keys:', Object.keys(payload.data || {}).join(', '));
    }
    
    // Process the webhook directly to ensure WhatsApp is sent
    // The middleware will also save it, but we process it here to ensure it completes
    const requestData = {
      method: 'POST',
      path: '/webhook/cloudtalk',
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.body || null,
      rawBody: req.rawBody || (req.body ? JSON.stringify(req.body) : null),
      ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'] || 'unknown',
      userAgent: req.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    // Process the webhook and wait for it to complete (including WhatsApp sending)
    console.log('🔄 Processing CloudTalk webhook directly...');
    await saveRequestToDB(requestData);
    console.log('✅ CloudTalk webhook processing completed');
    
    res.json({ 
      success: true, 
      message: 'CloudTalk webhook received and processed',
      data: payload,
      received_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error in /webhook/cloudtalk:', error);
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
        const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
        
        if (whatsappToken) {
          // Normalize phone number
          let normalizedPhone = lastCall.phone_number.replace(/\D/g, '');
          if (normalizedPhone.startsWith('+')) {
            normalizedPhone = normalizedPhone.substring(1);
          }
          if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
            normalizedPhone = '39' + normalizedPhone;
          }
          
          // Get recent messages from Wasender
          // Wasender endpoint: /api/messages or /messages (adjust based on your Wasender instance)
          const messagesEndpoint = `${whatsappUrl}/api/messages?limit=50`;
          const response = await fetch(messagesEndpoint, {
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
    const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
    
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
    
    // Send WhatsApp message via Wasender API
    // Wasender endpoint for sending messages - adjust if different
    const sendEndpoint = `${whatsappUrl}/api/send`;
    const response = await fetch(sendEndpoint, {
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
      
      // Save sent message to database for monitoring
      try {
        await supabase
          .from('webhook_requests')
          .insert([{
            method: 'POST',
            path: '/api/send-whatsapp',
            url: '/api/send-whatsapp',
            headers: {},
            query: {},
            body: {
              from_me: true,
              to: normalizedPhone,
              phone_number: normalizedPhone,
              text: message,
              body: message,
              type: 'text',
              timestamp: Math.floor(Date.now() / 1000),
              message: { body: message, to: normalizedPhone }
            },
            raw_body: JSON.stringify({ to: normalizedPhone, body: message }),
            ip_address: 'system',
            user_agent: 'WhatsApp-Sender',
            timestamp: new Date().toISOString(),
            is_cloudtalk: false,
            created_at: new Date().toISOString()
          }]);
        console.log(`✅ Saved sent message to database for ${normalizedPhone}`);
      } catch (dbErr) {
        console.error('Error saving sent message to database:', dbErr.message);
        // Don't fail - continue
      }
      
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

// Webhook endpoint to receive incoming WhatsApp messages from Wasender
app.post('/api/whatsapp-webhook', async (req, res) => {
  try {
    // Verify webhook secret if configured
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (webhookSecret) {
      // Check for secret in headers (common formats: X-Webhook-Secret, X-Wasender-Secret, Authorization)
      const headerSecret = req.headers['x-webhook-secret'] || 
                          req.headers['x-wasender-secret'] || 
                          req.headers['x-secret'] ||
                          (req.headers['authorization'] && req.headers['authorization'].replace('Bearer ', ''));
      
      // Also check in body if present (some services send it in the payload)
      const bodySecret = req.body?.secret || req.body?.webhook_secret || req.body?.webhookSecret;
      
      const receivedSecret = headerSecret || bodySecret;
      
      if (!receivedSecret || receivedSecret !== webhookSecret) {
        console.warn('⚠️  Webhook secret verification failed');
        console.warn('   Expected:', webhookSecret.substring(0, 10) + '...');
        console.warn('   Received:', receivedSecret ? receivedSecret.substring(0, 10) + '...' : 'none');
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid webhook secret' 
        });
      }
      console.log('✅ Webhook secret verified');
    }
    
    const webhookData = req.body;
    
    console.log('📥 Incoming WhatsApp webhook:', JSON.stringify(webhookData, null, 2));
    
    // Wasender webhook structure according to https://wasenderapi.com/api-docs/webhooks/webhook-message-received
    // Format: { event: "messages.received", timestamp: 123, data: { messages: { key: {...}, messageBody: "...", message: {...} } } }
    const event = webhookData.event || webhookData.type;
    
    // Handle Wasender API format: data.messages.key and data.messages.messageBody
    let fromNumber = '';
    let messageText = '';
    let messageKey = null;
    
    if (event === 'messages.received' && webhookData.data && webhookData.data.messages) {
      // Wasender API format
      const msg = webhookData.data.messages;
      const key = msg.key || {};
      
      // Check if it's an incoming message (fromMe: false)
      if (key.fromMe === false) {
        // Get phone number from key - prefer cleanedSenderPn, then senderPn, then remoteJid
        fromNumber = key.cleanedSenderPn || key.senderPn || key.remoteJid || '';
        // Remove @s.whatsapp.net or @lid if present
        fromNumber = fromNumber.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@', '');
        
        // Get message text - prefer messageBody, then message.conversation
        messageText = msg.messageBody || msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
        
        messageKey = key;
      } else {
        // This is a sent message, skip it
        return res.json({ success: true, message: 'Sent message, skipping' });
      }
    } else {
      // Fallback to old format for compatibility
    const messageData = webhookData.data || webhookData.message || webhookData;
      fromNumber = messageData.from || messageData.phone_number || messageData.number || '';
      messageText = messageData.body?.body || messageData.body || messageData.text || '';
      
      // Only process if not a sent message
      if (messageData.from_me === true || messageData.fromMe === true) {
        return res.json({ success: true, message: 'Sent message, skipping' });
      }
    }
    
    // Only process incoming messages
    if (event === 'messages.received' || (fromNumber && messageText)) {
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
      
      // Format the body to match what the monitor expects (Wasender API format)
      const formattedBody = {
        from: fromNumber,
        phone_number: normalizedPhone,
        number: normalizedPhone,
        body: messageText,
        text: messageText,
        type: 'text',
        from_me: false,
        id: messageKey?.id || null,
        timestamp: webhookData.timestamp || Math.floor(Date.now() / 1000),
        chat_id: messageKey?.remoteJid || null,
        message: {
          body: messageText,
          conversation: messageText
        },
        // Include original Wasender format for reference
        _wasender: webhookData.data?.messages || null
      };
      
      // Check if we've sent a message to this number (check cloudtalk_calls table)
      const { data: calls, error: callsError } = await supabase
        .from('cloudtalk_calls')
        .select('id, phone_number, electricity_bill_received')
        .or(`phone_number.eq.${normalizedPhone},phone_number.eq.+${normalizedPhone},phone_number.eq.39${normalizedPhone},phone_number.like.%${normalizedPhone}%`);
      
      if (!callsError && calls && calls.length > 0) {
        // Found calls for this number - update electricity_bill_received to true
        // Update ALL records for this phone number, regardless of current value
        const callIds = calls.map(call => call.id);
        
        const { error: updateError } = await supabase
          .from('cloudtalk_calls')
          .update({ 
            electricity_bill_received: true
          })
          .in('id', callIds);
        
        if (updateError) {
          console.error('Error updating electricity_bill_received:', updateError);
        } else {
          console.log(`✅ Updated electricity_bill_received=true for ${callIds.length} call(s) from ${normalizedPhone}`);
        }
      } else if (callsError) {
        console.error('Error querying cloudtalk_calls:', callsError);
      } else {
        console.log(`ℹ️  Message from ${normalizedPhone} but no matching calls found`);
        }
        
      // Always save the incoming message to webhook_requests for tracking (so it shows in monitor)
        try {
          await supabase
            .from('webhook_requests')
            .insert([{
              method: 'POST',
              path: '/api/whatsapp-webhook',
              url: req.url,
              headers: req.headers,
            body: formattedBody,
              raw_body: JSON.stringify(webhookData),
              ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
            user_agent: req.get('user-agent') || 'Wasender-Webhook',
              timestamp: new Date().toISOString(),
              is_cloudtalk: false,
              created_at: new Date().toISOString()
            }]);
        console.log(`✅ Saved incoming message to database from ${normalizedPhone}`);
        } catch (saveError) {
          console.error('Error saving webhook:', saveError);
        }
      } else {
      // Event is not messages.received or no valid data, but still acknowledge
      console.log('ℹ️  Webhook received but not a messages.received event:', event);
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
    const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
    
    if (!whatsappToken) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    // Strategy: Get messages from specific chats we've messaged, not just /messages/list
    // First, get all cloudtalk_calls with phone numbers that haven't received bills yet
    const { data: callsWithPhones, error: callsError } = await supabase
      .from('cloudtalk_calls')
      .select('id, phone_number, electricity_bill_received')
      .not('phone_number', 'is', null)
      .or('electricity_bill_received.is.null,electricity_bill_received.eq.false');
    
    if (callsError) {
      console.error('Error fetching calls:', callsError);
    }
    
    let allIncomingMessages = [];
    const processedChats = new Set();
    
    // For each phone number, try to get messages from that specific chat
    if (callsWithPhones && callsWithPhones.length > 0) {
      console.log(`📞 Checking ${callsWithPhones.length} phone numbers for new messages...`);
      for (const call of callsWithPhones) {
        if (!call.phone_number) continue;
        
        // Normalize phone number to create chat_id
        let phone = call.phone_number.replace(/\D/g, '');
        if (phone.startsWith('+')) phone = phone.substring(1);
        if (phone.length === 10 && !phone.startsWith('39')) {
          phone = '39' + phone;
        }
        
        const chatId = `${phone}@s.whatsapp.net`;
        if (processedChats.has(chatId)) continue;
        processedChats.add(chatId);
        
        try {
          // Get messages from this specific chat
          const chatResponse = await fetch(`${whatsappUrl}/chats/${chatId}/messages?limit=100`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${whatsappToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (chatResponse.ok) {
            const chatResult = await chatResponse.json();
            const chatMessages = chatResult.messages || chatResult.data || [];
            // Filter to only incoming messages
            const incoming = chatMessages.filter(msg => !msg.from_me);
            allIncomingMessages.push(...incoming);
            if (incoming.length > 0) {
              console.log(`📥 Found ${incoming.length} incoming messages from chat ${chatId}`);
            }
          }
        } catch (err) {
          // Chat might not exist or endpoint might not work, continue
        }
      }
    }
    
    // Also get general messages list as fallback
    const maxLimit = Math.max(parseInt(limit), 1000);
    console.log(`📥 Also fetching up to ${maxLimit} messages from general list...`);
    // Wasender API endpoint for getting messages
    const messagesEndpoint = `${whatsappUrl}/api/messages?limit=${maxLimit}`;
    const response = await fetch(messagesEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    // Combine messages from specific chats with general list
    const generalMessages = response.ok ? ((result.messages || []).filter(msg => !msg.from_me)) : [];
    allIncomingMessages.push(...generalMessages);
    
    // Remove duplicates by message ID
    const uniqueMessages = [];
    const seenIds = new Set();
    for (const msg of allIncomingMessages) {
      if (msg.id && !seenIds.has(msg.id)) {
        seenIds.add(msg.id);
        uniqueMessages.push(msg);
      } else if (!msg.id) {
        // If no ID, use timestamp+from as unique key
        const key = `${msg.timestamp}_${msg.from}`;
        if (!seenIds.has(key)) {
          seenIds.add(key);
          uniqueMessages.push(msg);
        }
      }
    }
    
    console.log(`📥 Total unique incoming messages: ${uniqueMessages.length} (from specific chats: ${allIncomingMessages.length - generalMessages.length}, from general list: ${generalMessages.length})`);
    
    // Use unique messages
    const messagesToProcess = uniqueMessages;
    
    // Filter to only incoming messages (from_me: false)
    // Include text, image, document, and voice messages (could be the bill)
    const allIncoming = messagesToProcess.filter(msg => {
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
            electricity_bill_received: true
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

// Get incoming WhatsApp messages in real-time
// Note: Messages come via webhooks (messages.received, messages.upsert) and are saved to database
// We don't use API GET to fetch messages - Wasender API doesn't support GET for messages
app.get('/api/whatsapp-incoming', async (req, res) => {
  try {
    const { limit = 50, since } = req.query;
    
    console.log('📥 /api/whatsapp-incoming called', { limit, since });
    console.log('📊 Using database as source (messages come via webhooks)');
    
    // Always use database - messages are saved here via webhooks
    try {
      let webhooks = [];
      let dbError = null;
      
      try {
        console.log('📊 Querying database for webhooks...');
        // Get both incoming webhooks and sent messages
        const queryBuilder = supabase
          .from('webhook_requests')
          .select('*')
          .or('path.eq./api/whatsapp-webhook,path.eq./api/send-whatsapp')
          .order('created_at', { ascending: false })
          .limit(parseInt(limit));
        
        // Supabase queries return promises, so always await
        const result = await queryBuilder;
        
        console.log('📊 Database query result:', { hasData: !!result?.data, dataLength: result?.data?.length, hasError: !!result?.error });
        
        if (result && result.data) {
          webhooks = result.data;
        }
        if (result && result.error) {
          dbError = result.error;
          console.error('Database error:', dbError);
        }
      } catch (supabaseError) {
        console.error('Supabase query exception:', supabaseError);
        dbError = supabaseError;
        webhooks = []; // Set to empty array on error
      }
      
      if (dbError) {
        console.error('Database error:', dbError);
        // Don't throw - return empty result instead
      }
      
      const messages = (Array.isArray(webhooks) ? webhooks : []).map(wh => {
        try {
          const body = typeof wh.body === 'string' ? JSON.parse(wh.body) : wh.body;
          const data = body.data || body.message || body;
          
          // Handle sent messages (from /api/send-whatsapp)
          const isSent = wh.path === '/api/send-whatsapp' || data.from_me === true;
          
          let from, messageText;
          if (isSent) {
            // Sent message - use 'to' field
            from = data.to || data.phone_number || '';
            messageText = data.text || data.body || '';
          } else {
            // Incoming message - use 'from' field
            from = data.from || data.phone_number || data.number || '';
            messageText = data.body?.body || data.body || data.text || '';
          }
          
          const timestamp = wh.created_at ? Math.floor(new Date(wh.created_at).getTime() / 1000) : null;
          
          // Normalize phone number for filtering
          const normalizedFrom = from.replace(/\D/g, ''); // Remove all non-digits
          
          return {
            id: wh.id,
            from: from,
            phone_number: from.replace('@s.whatsapp.net', ''),
            text: messageText,
            type: data.type || 'text',
            timestamp: timestamp,
            timestamp_readable: wh.created_at ? new Date(wh.created_at).toLocaleString('it-IT') : null,
            chat_id: data.chat_id || null,
            message: data,
            from_me: isSent,
            _normalizedPhone: normalizedFrom // For filtering
          };
        } catch (parseError) {
          console.error('Error parsing webhook body:', parseError);
          return null;
        }
      }).filter(msg => {
        // Remove null messages
        return msg !== null;
      });
      
      // Filter by timestamp if since is provided
      let filteredMessages = messages;
      if (since) {
        const sinceTimestamp = parseInt(since);
        filteredMessages = messages.filter(msg => (msg.timestamp || 0) > sinceTimestamp);
      }
      
      // Always return 200 status, even if API failed - we have database fallback
      return res.status(200).json({ 
        success: true,
        source: 'database',
        total: messages.length,
        incoming_count: filteredMessages.length,
        messages: filteredMessages,
        last_timestamp: filteredMessages.length > 0 ? filteredMessages[0].timestamp : null
      });
    } catch (dbError) {
      console.error('Error fetching from database:', dbError);
      // Even if database fails, return 200 with empty array instead of error
      return res.status(200).json({ 
        success: true,
        source: 'database',
        total: 0,
        incoming_count: 0,
        messages: [],
        last_timestamp: null,
        note: 'Database query failed, but returning empty result'
      });
    }
    
  } catch (error) {
    console.error('❌ CRITICAL Error in /api/whatsapp-incoming:', error);
    console.error('Error stack:', error.stack);
    // ALWAYS return 200 with empty result - never return 500
    // This prevents frontend errors
    try {
      return res.status(200).json({ 
        success: true,
        source: 'database',
        total: 0,
        incoming_count: 0,
        messages: [],
        last_timestamp: null,
        error: error.message || 'Unknown error',
        note: 'Error occurred but returning empty result'
      });
    } catch (responseError) {
      // If we can't send response, log it
      console.error('Failed to send error response:', responseError);
    }
  }
});

// Get last sent WhatsApp messages from Wasender
app.get('/api/whatsapp-messages', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
    
    if (!whatsappToken) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    // Wasender API endpoint for getting messages
    const messagesEndpoint = `${whatsappUrl}/api/messages?limit=${limit}`;
    const response = await fetch(messagesEndpoint, {
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

// Get last received message from a specific phone number
app.get('/api/whatsapp-messages/:phoneNumber', async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { limit = 200 } = req.query;
    
    const whatsappToken = process.env.WHATSAPP_API_TOKEN;
    const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
    
    if (!whatsappToken) {
      return res.status(500).json({ error: 'WhatsApp API not configured' });
    }
    
    // Normalize phone number
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (normalizedPhone.startsWith('+')) {
      normalizedPhone = normalizedPhone.substring(1);
    }
    if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
      normalizedPhone = '39' + normalizedPhone;
    }
    
    // Get messages from Wasender
    const messagesEndpoint = `${whatsappUrl}/api/messages?limit=${limit}`;
    const response = await fetch(messagesEndpoint, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${whatsappToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // Filter to only incoming messages from this number
      const normalizePhoneForMatch = (phone) => {
        let normalized = String(phone).replace(/\D/g, '');
        if (normalized.startsWith('+')) normalized = normalized.substring(1);
        return normalized.length >= 10 ? normalized.slice(-10) : normalized;
      };
      
      const targetPhoneNormalized = normalizePhoneForMatch(normalizedPhone);
      
      const messagesFromNumber = (result.messages || []).filter(msg => {
        if (msg.from_me === true) return false; // Only incoming messages
        
        const msgFrom = msg.from || msg.phone_number || '';
        const msgFromNormalized = normalizePhoneForMatch(msgFrom);
        
        // Match by last 10 digits or full number
        return msgFromNormalized === targetPhoneNormalized ||
               msgFrom.replace(/\D/g, '') === normalizedPhone.replace(/\D/g, '') ||
               msgFrom.replace(/\D/g, '').endsWith(targetPhoneNormalized) ||
               normalizedPhone.replace(/\D/g, '').endsWith(msgFromNormalized);
      });
      
      // Sort by timestamp descending (most recent first)
      messagesFromNumber.sort((a, b) => {
        const tsA = a.timestamp || 0;
        const tsB = b.timestamp || 0;
        return tsB - tsA;
      });
      
      const lastMessage = messagesFromNumber.length > 0 ? messagesFromNumber[0] : null;
      
      res.json({ 
        success: true,
        phone_number: phoneNumber,
        normalized_phone: normalizedPhone,
        total_messages_from_number: messagesFromNumber.length,
        last_message: lastMessage ? {
          id: lastMessage.id,
          text: lastMessage.text?.body || lastMessage.body || '',
          type: lastMessage.type,
          timestamp: lastMessage.timestamp,
          timestamp_readable: lastMessage.timestamp ? new Date(lastMessage.timestamp * 1000).toISOString() : null,
          from: lastMessage.from,
          message: lastMessage
        } : null,
        all_messages: messagesFromNumber.slice(0, 10) // Last 10 messages
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
    const whatsappUrl = process.env.WHATSAPP_API_URL; // Wasender API URL - must be set in environment variables
    
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
        
        // Send WhatsApp via Wasender
        const sendEndpoint = `${whatsappUrl}/api/send`;
        const response = await fetch(sendEndpoint, {
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

// Get incoming messages from database (webhook_requests)
app.get('/api/whatsapp-incoming-db', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const { data: webhooks, error } = await supabase
      .from('webhook_requests')
      .select('*')
      .eq('path', '/api/whatsapp-webhook')
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    if (error) throw error;
    
    const messages = (webhooks || []).map(wh => {
      const body = typeof wh.body === 'string' ? JSON.parse(wh.body) : wh.body;
      const data = body.data || body.message || body;
      const from = data.from || data.phone_number || data.number || '';
      const messageText = data.body?.body || data.body || data.text || '';
      
      return {
        id: wh.id,
        from: from,
        phone_number: from.replace('@s.whatsapp.net', ''),
        text: messageText,
        type: data.type || 'text',
        timestamp: wh.created_at ? Math.floor(new Date(wh.created_at).getTime() / 1000) : null,
        timestamp_readable: wh.created_at ? new Date(wh.created_at).toLocaleString('it-IT') : null,
        raw: data
      };
    });
    
    res.json({
      success: true,
      count: messages.length,
      messages: messages
    });
  } catch (error) {
    console.error('Error fetching messages from database:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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

