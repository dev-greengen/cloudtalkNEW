import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://pmtpufqtohygciwsdewt.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_9WUXqQA-w5JKRpaojmhZhA_hBApvDsq';

const supabase = createClient(supabaseUrl, supabaseKey);
const phoneNumber = process.argv[2] || '3209793492';

// Normalize phone number
let normalizedPhone = phoneNumber.replace(/\D/g, '');
if (normalizedPhone.startsWith('+')) {
  normalizedPhone = normalizedPhone.substring(1);
}
if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
  normalizedPhone = '39' + normalizedPhone;
}

console.log(`📥 Cercando messaggi da: ${phoneNumber} (normalizzato: ${normalizedPhone})...\n`);

try {
  const { data: webhooks, error: webhookError } = await supabase
    .from('webhook_requests')
    .select('*')
    .eq('path', '/api/whatsapp-webhook')
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (webhookError) {
    console.error('❌ Errore:', webhookError.message);
    process.exit(1);
  }
  
  if (!webhooks || webhooks.length === 0) {
    console.log('📭 Nessun messaggio WhatsApp trovato nel database');
    process.exit(0);
  }
  
  // Filtra per numero
  const normalizePhoneForMatch = (phone) => {
    let normalized = String(phone).replace(/\D/g, '');
    if (normalized.startsWith('+')) normalized = normalized.substring(1);
    return normalized.length >= 10 ? normalized.slice(-10) : normalized;
  };
  
  const targetPhoneNormalized = normalizePhoneForMatch(normalizedPhone);
  
  const messagesFromNumber = webhooks.filter(wh => {
    try {
      const body = typeof wh.body === 'string' ? JSON.parse(wh.body) : wh.body;
      const msg = body.data?.messages || body.messages;
      if (!msg) return false;
      
      const phone = msg.key?.senderPn || msg.key?.cleanedSenderPn || msg.from || '';
      const phoneClean = String(phone).replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '');
      
      const phoneNormalized = normalizePhoneForMatch(phoneClean);
      const fullPhone = phoneClean.replace(/^\+/, '');
      
      return phoneNormalized === targetPhoneNormalized ||
             fullPhone === normalizedPhone.replace(/\D/g, '') ||
             fullPhone.endsWith(targetPhoneNormalized) ||
             normalizedPhone.replace(/\D/g, '').endsWith(phoneNormalized);
    } catch (e) {
      return false;
    }
  });
  
  if (messagesFromNumber.length === 0) {
    console.log(`📭 Nessun messaggio trovato da ${phoneNumber}`);
    process.exit(0);
  }
  
  console.log(`✅ Trovati ${messagesFromNumber.length} messaggio/i da ${phoneNumber}\n`);
  
  messagesFromNumber.forEach((wh, index) => {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📨 MESSAGGIO ${index + 1}`);
    
    try {
      const body = typeof wh.body === 'string' ? JSON.parse(wh.body) : wh.body;
      const msg = body.data?.messages || body.messages;
      
      if (!msg) {
        console.log(`📅 Data: ${wh.created_at ? new Date(wh.created_at).toLocaleString('it-IT') : 'N/A'}`);
        console.log(`⚠️  Struttura messaggio non riconosciuta`);
        return;
      }
      
      const phone = msg.key?.senderPn || msg.key?.cleanedSenderPn || msg.from || 'Sconosciuto';
      const phoneClean = String(phone).replace('@s.whatsapp.net', '').replace('@c.us', '');
      const timestamp = wh.created_at ? new Date(wh.created_at).toLocaleString('it-IT') : 'N/A';
      
      // Estrai testo
      let text = '';
      let type = 'text';
      
      if (msg.message?.conversation) {
        text = msg.message.conversation;
        type = 'text';
      } else if (msg.message?.extendedTextMessage?.text) {
        text = msg.message.extendedTextMessage.text;
        type = 'text (extended)';
      } else if (msg.message?.audioMessage) {
        text = '🎤 Messaggio vocale';
        type = 'audio';
      } else if (msg.message?.imageMessage) {
        text = '🖼️ Immagine';
        type = 'image';
      } else if (msg.message?.videoMessage) {
        text = '🎥 Video';
        type = 'video';
      } else if (msg.message?.documentMessage) {
        text = '📄 Documento';
        type = 'document';
      } else {
        text = '(tipo messaggio non supportato)';
        type = 'unknown';
      }
      
      console.log(`📞 Da: ${phoneClean}`);
      console.log(`📅 Data: ${timestamp}`);
      console.log(`📝 Tipo: ${type}`);
      console.log(`💬 Testo: ${text}`);
      
    } catch (parseError) {
      console.log(`📅 Data: ${wh.created_at ? new Date(wh.created_at).toLocaleString('it-IT') : 'N/A'}`);
      console.log(`⚠️  Errore parsing: ${parseError.message}`);
    }
    
    console.log('─'.repeat(80));
  });
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  process.exit(1);
}


