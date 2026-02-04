import express from 'express';
import { supabase } from './db.js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Test database connection
app.get('/', async (req, res) => {
  try {
    // Test query
    const { data, error } = await supabase.from('_test').select('*').limit(1);
    
    if (error && error.code !== 'PGRST116') { // Table doesn't exist is OK
      return res.json({ 
        status: 'connected', 
        message: 'Supabase connected but no test table found',
        error: error.message 
      });
    }
    
    res.json({ 
      status: 'connected', 
      message: 'Supabase connected successfully!',
      data 
    });
  } catch (error) {
    res.json({ 
      status: 'error', 
      message: 'Failed to connect to Supabase',
      error: error.message 
    });
  }
});

// Webhook endpoint example
app.post('/webhook', async (req, res) => {
  try {
    const payload = req.body;
    
    // Example: Save webhook data to database
    // const { data, error } = await supabase
    //   .from('webhooks')
    //   .insert([{ payload, created_at: new Date() }]);
    
    console.log('Webhook received:', payload);
    
    res.json({ 
      success: true, 
      message: 'Webhook received',
      data: payload 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
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

