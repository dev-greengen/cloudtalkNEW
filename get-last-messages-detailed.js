import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pmtpufqtohygciwsdewt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_9WUXqQA-w5JKRpaojmhZhA_hBApvDsq';

const supabase = createClient(supabaseUrl, supabaseKey);
const limit = parseInt(process.argv[2]) || 5;

console.log(`📥 Recuperando gli ultimi ${limit} messaggi WhatsApp ricevuti...\n`);

try {
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_requests')
    .select('*')
    .eq('path', '/api/whatsapp-webhook')
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (webhookError) {
    console.error('❌ Errore:', webhookError.message);
    process.exit(1);
  }
  
  if (!webhooks || webhooks.length === 0) {
    console.log('📭 Nessun messaggio WhatsApp trovato nel database');
    process.exit(0);
  }
  
  console.log(`✅ Trovati ${webhooks.length} messaggio/i\n`);
  
  webhooks.forEach((wh, index) => {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📨 MESSAGGIO ${index + 1} (ID: ${wh.id})`);
    console.log(`📅 Data: ${wh.created_at ? new Date(wh.created_at).toLocaleString('it-IT') : 'N/A'}`);
    
    try {
      const body = typeof wh.body === 'string' ? JSON.parse(wh.body) : wh.body;
      
      // Prova diversi formati
      const from = body.data?.from || body.message?.from || body.from || body.data?.phone_number || body.phone_number || 'N/A';
      const text = body.data?.body?.body || body.data?.body || body.data?.text || body.message?.body?.body || body.message?.body || body.message?.text || body.body?.body || body.body || body.text || '(messaggio non testuale)';
      const type = body.data?.type || body.message?.type || body.type || 'unknown';
      
      console.log(`📞 Da: ${String(from).replace('@s.whatsapp.net', '')}`);
      console.log(`📝 Tipo: ${type}`);
      console.log(`💬 Testo: ${String(text).substring(0, 300)}${String(text).length > 300 ? '...' : ''}`);
      
      // Mostra struttura completa se non è testuale
      if (text === '(messaggio non testuale)') {
        console.log(`\n📋 Struttura body (primi 500 caratteri):`);
        console.log(JSON.stringify(body, null, 2).substring(0, 500) + '...');
      }
    } catch (parseError) {
      console.log(`⚠️  Errore parsing body: ${parseError.message}`);
      console.log(`📋 Body raw (primi 200 caratteri): ${String(wh.body).substring(0, 200)}`);
    }
    
    console.log('─'.repeat(80));
  });
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  process.exit(1);
}

