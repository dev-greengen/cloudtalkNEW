import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pmtpufqtohygciwsdewt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_9WUXqQA-w5JKRpaojmhZhA_hBApvDsq';

const supabase = createClient(supabaseUrl, supabaseKey);
const phoneNumber = process.argv[2] || '361';

// Normalize phone number
let normalizedPhone = phoneNumber.replace(/\D/g, '');
if (normalizedPhone.startsWith('+')) {
  normalizedPhone = normalizedPhone.substring(1);
}
if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
  normalizedPhone = '39' + normalizedPhone;
}

console.log(`🔍 Cercando ultimo messaggio da: ${phoneNumber} (normalizzato: ${normalizedPhone})`);
console.log(`📊 Cercando nel database Supabase...\n`);

try {
  // 1. Cerca in webhook_requests (messaggi WhatsApp ricevuti)
  console.log('1️⃣ Cercando in webhook_requests (webhook WhatsApp)...');
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_requests')
    .select('*')
    .eq('path', '/api/whatsapp-webhook')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (webhookError) {
    console.log(`   ⚠️  Errore: ${webhookError.message}`);
  } else {
    console.log(`   ✅ Trovati ${webhooks?.length || 0} webhook WhatsApp`);
    
    // Cerca messaggi da questo numero
    const messagesFromNumber = (webhooks || []).filter(wh => {
      if (!wh.body) return false;
      
      const body = typeof wh.body === 'string' ? JSON.parse(wh.body) : wh.body;
      const data = body.data || body.message || body;
      const from = data.from || data.phone_number || data.number || '';
      
      // Normalize for matching
      const normalizePhone = (phone) => {
        let normalized = String(phone).replace(/\D/g, '');
        if (normalized.startsWith('+')) normalized = normalized.substring(1);
        return normalized.length >= 10 ? normalized.slice(-10) : normalized;
      };
      
      const fromNormalized = normalizePhone(from);
      const targetNormalized = normalizePhone(normalizedPhone);
      
      return fromNormalized === targetNormalized ||
             from.replace(/\D/g, '') === normalizedPhone.replace(/\D/g, '') ||
             from.replace(/\D/g, '').endsWith(targetNormalized);
    });
    
    if (messagesFromNumber.length > 0) {
      const lastWebhook = messagesFromNumber[0];
      const body = typeof lastWebhook.body === 'string' ? JSON.parse(lastWebhook.body) : lastWebhook.body;
      const data = body.data || body.message || body;
      const messageText = data.body?.body || data.body || data.text || '';
      const timestamp = lastWebhook.created_at || lastWebhook.timestamp;
      
      console.log(`\n📨 ULTIMO MESSAGGIO RICEVUTO (da webhook):`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📞 Da: ${data.from || 'N/A'}`);
      console.log(`📅 Data: ${timestamp ? new Date(timestamp).toLocaleString('it-IT') : 'N/A'}`);
      console.log(`💬 Messaggio:`);
      console.log(`   ${messageText || '(messaggio non testuale)'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    } else {
      console.log(`   ℹ️  Nessun messaggio trovato da ${phoneNumber} in webhook_requests\n`);
    }
  }
  
  // 2. Cerca in cloudtalk_calls (per vedere se hanno risposto)
  console.log('2️⃣ Cercando in cloudtalk_calls (chiamate con risposte)...');
  const { data: calls, error: callsError } = await supabase
    .from('cloudtalk_calls')
    .select('*')
    .or(`phone_number.ilike.%${normalizedPhone}%,phone_number.ilike.%${phoneNumber}%`)
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (callsError) {
    console.log(`   ⚠️  Errore: ${callsError.message}`);
  } else {
    console.log(`   ✅ Trovate ${calls?.length || 0} chiamata/e`);
    
    const callsWithResponse = (calls || []).filter(c => c.electricity_bill_received === true);
    
    if (callsWithResponse.length > 0) {
      const lastCall = callsWithResponse[0];
      console.log(`\n✅ Trovata chiamata con risposta ricevuta:`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📞 Numero: ${lastCall.phone_number}`);
      console.log(`📅 Chiamata: ${lastCall.created_at ? new Date(lastCall.created_at).toLocaleString('it-IT') : 'N/A'}`);
      console.log(`📅 Aggiornato: ${lastCall.updated_at ? new Date(lastCall.updated_at).toLocaleString('it-IT') : 'N/A'}`);
      console.log(`✅ Bolletta ricevuta: ${lastCall.electricity_bill_received ? 'SÌ' : 'NO'}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    } else {
      console.log(`   ℹ️  Nessuna chiamata con risposta trovata per ${phoneNumber}`);
      
      // Mostra comunque l'ultima chiamata trovata
      if (calls && calls.length > 0) {
        const lastCall = calls[0];
        console.log(`\n📞 Ultima chiamata trovata (senza risposta):`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📞 Numero: ${lastCall.phone_number}`);
        console.log(`📅 Chiamata: ${lastCall.created_at ? new Date(lastCall.created_at).toLocaleString('it-IT') : 'N/A'}`);
        console.log(`📅 Aggiornato: ${lastCall.updated_at ? new Date(lastCall.updated_at).toLocaleString('it-IT') : 'N/A'}`);
        console.log(`✅ Bolletta ricevuta: ${lastCall.electricity_bill_received ? 'SÌ' : 'NO'}`);
        console.log(`📝 Call ID: ${lastCall.call_id || 'N/A'}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      }
    }
  }
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  process.exit(1);
}

