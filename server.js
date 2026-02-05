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
    // Check if it's a CloudTalk webhook
    const isCloudTalk = requestData.path.includes('cloudtalk') || 
                       requestData.path.includes('webhook') ||
                       (requestData.headers['user-agent'] && requestData.headers['user-agent'].includes('cloudtalk'));
    
    // Extract CloudTalk-specific data if present
    let cloudtalkData = null;
    if (requestData.body && typeof requestData.body === 'object') {
      cloudtalkData = {
        call_id: requestData.body.call_id || requestData.body.callId || null,
        event_type: requestData.body.event_type || requestData.body.eventType || null,
        phone_number: requestData.body.phone_number || requestData.body.phoneNumber || null,
        status: requestData.body.status || null,
        duration: requestData.body.duration || null,
        timestamp: requestData.body.timestamp || requestData.body.date || null
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
    } else {
      console.log(`✅ Saved request to DB: ${requestData.method} ${requestData.path}${isCloudTalk ? ' (CloudTalk)' : ''}`);
    }
  } catch (error) {
    console.error('Error in saveRequestToDB:', error.message);
    // Don't throw - continue processing
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
  
  // Save to database (async, don't wait)
  saveRequestToDB(requestData).catch(err => {
    console.error('Failed to save request to DB:', err.message);
  });
  
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

