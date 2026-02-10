# Developer Documentation - CloudTalk + WhatsApp System

## 📁 Project Structure

```
cloudtalkNEW/
├── server.js              # Main Express.js server (all code)
├── db.js                  # Supabase client and database configuration
├── vercel.json            # Vercel deployment configuration
├── package.json           # Node.js dependencies
├── supabase/
│   └── functions/
│       └── webhook/
│           └── index.ts   # Supabase Edge Function (currently unused)
└── *.sql                  # SQL scripts for database setup
```

## 🏗️ Architecture

### Technology Stack
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (Serverless Functions)
- **External API**: Wasender (WhatsApp API)

### Data Flow

```
CloudTalk → POST /webhook/cloudtalk → saveRequestToDB() → saveCloudTalkCallData() → sendWhatsAppMessage()
                                                                                        ↓
Wasender → POST /api/whatsapp-webhook → Update electricity_bill_received → Save to webhook_requests
```

## 📂 Main Files

### `server.js` (2295 lines)

Main file containing all server code. Organized in sections:

#### 1. **Setup and Middleware** (lines 1-20)
- Import dependencies
- Express configuration
- JSON and text parsing

#### 2. **Database Functions** (lines 22-250)
- **`saveRequestToDB(requestData)`** (line 22)
  - Saves all webhooks to `webhook_requests`
  - Automatically detects if it's a CloudTalk webhook
  - Processes CloudTalk webhooks and sends WhatsApp
  
- **`saveCloudTalkCallData(webhookRequestId, body)`** (line 178)
  - Saves call data to `cloudtalk_calls`
  - Normalizes data from CloudTalk
  - Handles duplicates

#### 3. **WhatsApp Functions** (line 254-400)
- **`sendWhatsAppMessage(phoneNumber, webhookRequestId, callId)`** (line 254)
  - Sends message via Wasender API
  - Endpoint: `POST https://www.wasenderapi.com/api/send-message`
  - Payload: `{ to: "393209793492", text: "message" }`
  - Saves sent message to `webhook_requests` with `from_me: true`

#### 4. **Monitor Page** (line 437-841)
- **`GET /monitor`** - HTML web interface with JavaScript
- Auto-refresh every 5 seconds
- Shows incoming and sent messages
- Uses `/api/whatsapp-incoming` to get data

#### 5. **Request Capture Middleware** (line 844-882)
- Captures all POST requests
- **IMPORTANT**: Skips `/webhook/cloudtalk` to avoid duplication
- Saves to memory and database

#### 6. **CloudTalk Webhook Endpoint** (line 1015-1060)
- **`POST /webhook/cloudtalk`**
- Receives call data from CloudTalk
- Calls `saveRequestToDB()` which processes everything
- Responds with confirmation JSON

#### 7. **Wasender Webhook Endpoint** (line 1387-1558)
- **`POST /api/whatsapp-webhook`**
- Verifies webhook secret
- Extracts sender number and message text
- **Updates `electricity_bill_received = true`** if match found in `cloudtalk_calls`
- Saves message to `webhook_requests`

#### 8. **API Endpoints** (various lines)
- **`GET /api/whatsapp-incoming`** (line 1828) - Messages for monitor
- **`GET /api/cloudtalk-calls`** (line 1119) - Call list
- **`POST /api/send-whatsapp`** (line 1257) - Manual WhatsApp sending
- Other endpoints for debugging and management

### `db.js` (76 lines)

- Initializes Supabase client
- Handles missing credentials with mock client
- 10 second timeout for fetch
- Detailed logging of calls

### `vercel.json` (27 lines)

- Vercel deployment configuration
- Route mapping
- Environment variables (should be moved to Vercel dashboard for security)

## 🔧 Common Modifications

### Modify WhatsApp Message

**File**: `server.js`  
**Function**: `sendWhatsAppMessage()` (line 254)  
**Line to modify**: ~278

```javascript
const message = `Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.`;
```

### Modify Sending Logic

**File**: `server.js`  
**Function**: `saveRequestToDB()` (line 22)  
**Section**: lines 143-160

Currently sends always if there's a number. To add conditions:

```javascript
if (callData.phone_number && callData.should_send === true) {
  // Send only if should_send is true
}
```

### Modify Monitor

**File**: `server.js`  
**Endpoint**: `GET /monitor` (line 437)  
**Section**: lines 437-841

HTML is in a template string. Modify:
- CSS styles (lines ~450-550)
- JavaScript for refresh (lines ~600-830)
- HTML layout (lines ~550-600)

### Add New Endpoint

Add after other endpoints (after line 2200):

```javascript
app.get('/api/new-endpoint', async (req, res) => {
  try {
    // Your code here
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Modify Database Query

**File**: `server.js`  
Search for calls to `supabase.from('table_name')`

Example to modify `cloudtalk_calls` query:

```javascript
const { data, error } = await supabase
  .from('cloudtalk_calls')
  .select('*')
  .eq('phone_number', phoneNumber)
  .order('created_at', { ascending: false })
  .limit(10);
```

## 📞 Making Calls with CloudTalk API

### Overview

CloudTalk API allows you to initiate outbound calls programmatically. This section explains how to integrate CloudTalk API calls into your system.

### Prerequisites

1. **CloudTalk API Credentials**
   - Get your API key from CloudTalk dashboard
   - API endpoint: `https://api.cloudtalk.io/api/v1/`
   - Authentication: Bearer token in Authorization header

2. **Environment Variables**
   Add to your Vercel environment variables:
   ```
   CLOUDTALK_API_KEY=your_api_key_here
   CLOUDTALK_API_URL=https://api.cloudtalk.io/api/v1
   ```

### Making a Call

#### Basic Call Example

```javascript
// Add this function to server.js
async function makeCloudTalkCall(phoneNumber, agentId = null) {
  try {
    const apiKey = process.env.CLOUDTALK_API_KEY;
    const apiUrl = process.env.CLOUDTALK_API_URL || 'https://api.cloudtalk.io/api/v1';
    
    if (!apiKey) {
      throw new Error('CLOUDTALK_API_KEY not configured');
    }
    
    // CloudTalk API endpoint for making calls
    const response = await fetch(`${apiUrl}/calls`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone_number: phoneNumber,  // Format: +393209793492
        agent_id: agentId,           // Optional: specific agent ID
        // Additional options:
        // caller_id: '+391234567890',  // Caller ID to display
        // recording: true,              // Record the call
        // tags: ['outbound', 'followup'] // Tags for organization
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`CloudTalk API error: ${error.message || response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`✅ Call initiated to ${phoneNumber}, Call ID: ${result.call_id}`);
    return result;
    
  } catch (error) {
    console.error('❌ Error making CloudTalk call:', error.message);
    throw error;
  }
}
```

#### Advanced Call with Custom Data

```javascript
async function makeCloudTalkCallAdvanced(phoneNumber, options = {}) {
  const apiKey = process.env.CLOUDTALK_API_KEY;
  const apiUrl = process.env.CLOUDTALK_API_URL || 'https://api.cloudtalk.io/api/v1';
  
  const payload = {
    phone_number: phoneNumber,
    agent_id: options.agentId || null,
    caller_id: options.callerId || null,
    recording: options.recording !== false, // Default: true
    tags: options.tags || [],
    custom_data: options.customData || {}, // Custom data passed to webhook
    // Schedule for later (optional):
    // scheduled_at: '2024-02-15T10:00:00Z',
  };
  
  const response = await fetch(`${apiUrl}/calls`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  return await response.json();
}
```

### Adding an Endpoint to Make Calls

Add this endpoint to `server.js` (after line 2200):

```javascript
// Endpoint to initiate CloudTalk calls
app.post('/api/make-call', async (req, res) => {
  try {
    const { phone_number, agent_id, caller_id, tags } = req.body;
    
    if (!phone_number) {
      return res.status(400).json({ 
        success: false, 
        error: 'phone_number is required' 
      });
    }
    
    const result = await makeCloudTalkCall(phone_number, agent_id);
    
    // Optionally save to database
    await supabase
      .from('cloudtalk_calls')
      .insert([{
        call_id: result.call_id,
        phone_number: phone_number,
        status: 'initiated',
        direction: 'outbound',
        agent_id: agent_id || null,
        raw_data: result
      }]);
    
    res.json({ 
      success: true, 
      message: 'Call initiated successfully',
      data: result 
    });
    
  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### Testing CloudTalk API Calls

#### Using cURL

```bash
# Basic call
curl -X POST https://api.cloudtalk.io/api/v1/calls \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+393209793492",
    "agent_id": 12345
  }'

# Call with custom data
curl -X POST https://api.cloudtalk.io/api/v1/calls \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+393209793492",
    "agent_id": 12345,
    "recording": true,
    "tags": ["followup", "important"],
    "custom_data": {
      "customer_id": "123",
      "order_id": "456"
    }
  }'
```

#### Using Node.js

```javascript
// Test locally
const response = await fetch('http://localhost:3000/api/make-call', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone_number: '+393209793492',
    agent_id: 12345
  })
});

const result = await response.json();
console.log(result);
```

### Call Status and Webhooks

After initiating a call, CloudTalk will send webhooks to your `/webhook/cloudtalk` endpoint for:
- **Call Started**: When the call begins
- **Call Answered**: When the customer answers
- **Call Ended**: When the call finishes (this is what triggers WhatsApp sending)

The webhook payload includes:
```json
{
  "call_id": "call_123456",
  "phone_number": "+393209793492",
  "status": "completed",
  "duration": 120,
  "direction": "outbound",
  "agent_id": 12345,
  "recording_url": "https://...",
  "custom_data": {
    "customer_id": "123"
  }
}
```

### Best Practices

1. **Error Handling**: Always wrap API calls in try/catch
2. **Rate Limiting**: CloudTalk has rate limits - implement retry logic
3. **Phone Number Format**: Always use E.164 format (+393209793492)
4. **Logging**: Log all call attempts for debugging
5. **Webhook Verification**: Verify webhook signatures if available

### Common Issues

**Error: "Invalid phone number"**
- Ensure phone number is in E.164 format (+country code + number)
- Remove spaces, dashes, and parentheses

**Error: "Agent not found"**
- Verify agent_id exists in your CloudTalk account
- Use null to let CloudTalk assign automatically

**Error: "Rate limit exceeded"**
- Implement exponential backoff
- Queue calls if needed

## 🗄️ Database Schema

### `webhook_requests` Table

```sql
- id (bigint, primary key)
- method (text) - GET, POST, etc.
- path (text) - /webhook/cloudtalk
- url (text)
- headers (jsonb)
- query (jsonb)
- body (jsonb)
- raw_body (text)
- ip_address (text)
- user_agent (text)
- timestamp (timestamp)
- is_cloudtalk (boolean)
- cloudtalk_call_id (text)
- cloudtalk_event_type (text)
- cloudtalk_phone_number (text)
- cloudtalk_status (text)
- cloudtalk_duration (integer)
- created_at (timestamp)
```

### `cloudtalk_calls` Table

```sql
- id (bigint, primary key)
- webhook_request_id (bigint, foreign key → webhook_requests.id)
- call_id (text)
- event_type (text)
- phone_number (text)
- phone_number_from (text)
- status (text)
- duration (integer)
- direction (text)
- agent_id (text)
- agent_name (text)
- customer_name (text)
- recording_url (text)
- transcript (text)
- call_start_time (timestamp)
- call_end_time (timestamp)
- call_result (text)
- call_outcome (text)
- contact_name (text)
- company_name (text)
- ateco_code (text)
- ateco_eligible (boolean)
- interest_confirmed (boolean)
- electricity_bill_received (boolean) ⭐ IMPORTANT
- annual_consumption_kwh (integer)
- should_send (boolean)
- reason (text)
- raw_data (jsonb)
- created_at (timestamp)
```

## 🔍 Debugging

### Important Logs to Look For

**CloudTalk Webhook**:
```
📞 CloudTalk webhook received at /webhook/cloudtalk
✅ CloudTalk call data saved. Phone: +393209793492
📱 Attempting to send WhatsApp to +393209793492...
✅ WhatsApp sent successfully to +393209793492
```

**Wasender Webhook**:
```
📥 Incoming WhatsApp webhook
📨 Message from 393209793492: [text]
✅ Updated electricity_bill_received=true for X call(s) from 393209793492
```

**Common Errors**:
```
❌ WhatsApp send failed: [error]
❌ Error updating electricity_bill_received: [error]
❌ Fetch failed for [URL]: [error]
```

### Local Testing

```bash
# Start local server
npm run dev

# Test CloudTalk webhook
curl -X POST http://localhost:3000/webhook/cloudtalk \
  -H "Content-Type: application/json" \
  -d '{"data": {"callId": "test", "phoneNumber": "+393209793492", "shouldSend": true}}'

# Test Wasender webhook
curl -X POST http://localhost:3000/api/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: [secret]" \
  -d '{"event": "messages.received", "data": {"messages": {"key": {"fromMe": false, "cleanedSenderPn": "393209793492"}, "messageBody": "test"}}}'

# Test making a call
curl -X POST http://localhost:3000/api/make-call \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+393209793492", "agent_id": 12345}'
```

## 🚨 Known Issues and Solutions

### 1. CloudTalk Webhook Duplication

**Problem**: Webhook processed twice  
**Cause**: Middleware and endpoint both process it  
**Solution**: Middleware skips `/webhook/cloudtalk` (line 869)

### 2. Wasender Rate Limit (429)

**Problem**: "You can send 1 message every 1 minute"  
**Cause**: Limited trial plan  
**Solution**: Wait 60 seconds between messages or upgrade plan

### 3. `text` vs `body` Field in Wasender

**Problem**: Error 422 "text field is required"  
**Cause**: Wasender requires `text`, not `body`  
**Solution**: Use `text: message` in payload (already fixed)

### 4. SSL/TLS Errors

**Problem**: "SSL routines:ssl3_read_bytes:tlsv1 unrecognized name"  
**Cause**: Incorrect Wasender API URL  
**Solution**: Use `https://www.wasenderapi.com/api`

## 📝 Best Practices

1. **Always log errors** with `console.error()`
2. **Handle timeouts** for external calls (10 seconds)
3. **Validate input** before processing
4. **Use try/catch** for all async operations
5. **Don't block responses** - use `await` only when necessary
6. **Test webhooks** with curl before deploying

## 🔐 Security

- **Webhook Secret**: Always verify for Wasender
- **Environment Variables**: Don't commit to git
- **Input Validation**: Validate all inputs
- **Rate Limiting**: Consider rate limiting for production

## 🚀 Deployment

### Vercel

```bash
# Deploy
vercel --prod

# Environment variables should be configured in Vercel Dashboard
# Settings → Environment Variables
```

### Git Workflow

```bash
git add .
git commit -m "Description of change"
git push  # Auto-deploy to Vercel
```

## 📚 Resources

- [Express.js Docs](https://expressjs.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Wasender API Docs](https://wasenderapi.com/api-docs)
- [CloudTalk API Docs](https://www.cloudtalk.io/api-documentation)
- [Vercel Docs](https://vercel.com/docs)

## 🐛 Bug Reporting

When reporting a bug, include:
1. Complete logs from Vercel
2. Webhook payload (without sensitive data)
3. Error timestamp
4. Description of what you were doing
