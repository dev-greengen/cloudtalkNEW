import dotenv from 'dotenv';
dotenv.config();

const whatsappToken = process.env.WHATSAPP_API_TOKEN;
const whatsappUrl = process.env.WHATSAPP_API_URL || 'https://gate.whapi.cloud';
const phoneNumber = process.argv[2] || '361';

if (!whatsappToken) {
  console.error('❌ WHATSAPP_API_TOKEN non configurato');
  process.exit(1);
}

// Normalize phone number
let normalizedPhone = phoneNumber.replace(/\D/g, '');
if (normalizedPhone.startsWith('+')) {
  normalizedPhone = normalizedPhone.substring(1);
}
if (normalizedPhone.length === 10 && !normalizedPhone.startsWith('39')) {
  normalizedPhone = '39' + normalizedPhone;
}

console.log(`🔍 Cercando ultimo messaggio da: ${phoneNumber} (normalizzato: ${normalizedPhone})`);

try {
  const response = await fetch(`${whatsappUrl}/messages/list?limit=500`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${whatsappToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    console.error('❌ Errore API:', result);
    process.exit(1);
  }
  
  // Normalize phone for matching
  const normalizePhoneForMatch = (phone) => {
    let normalized = String(phone).replace(/\D/g, '');
    if (normalized.startsWith('+')) normalized = normalized.substring(1);
    return normalized.length >= 10 ? normalized.slice(-10) : normalized;
  };
  
  const targetPhoneNormalized = normalizePhoneForMatch(normalizedPhone);
  
  // Filter incoming messages from this number
  const messagesFromNumber = (result.messages || []).filter(msg => {
    if (msg.from_me === true) return false; // Solo messaggi ricevuti
    
    const msgFrom = msg.from || msg.phone_number || '';
    const msgFromNormalized = normalizePhoneForMatch(msgFrom);
    
    return msgFromNormalized === targetPhoneNormalized ||
           msgFrom.replace(/\D/g, '') === normalizedPhone.replace(/\D/g, '') ||
           msgFrom.replace(/\D/g, '').endsWith(targetPhoneNormalized) ||
           normalizedPhone.replace(/\D/g, '').endsWith(msgFromNormalized);
  });
  
  // Sort by timestamp descending
  messagesFromNumber.sort((a, b) => {
    const tsA = a.timestamp || 0;
    const tsB = b.timestamp || 0;
    return tsB - tsA;
  });
  
  if (messagesFromNumber.length === 0) {
    console.log(`\n❌ Nessun messaggio ricevuto trovato da ${phoneNumber}`);
    console.log(`\nMessaggi totali controllati: ${result.messages?.length || 0}`);
    process.exit(0);
  }
  
  const lastMessage = messagesFromNumber[0];
  const timestamp = lastMessage.timestamp ? new Date(lastMessage.timestamp * 1000) : null;
  
  console.log(`\n✅ Trovati ${messagesFromNumber.length} messaggio/i da ${phoneNumber}`);
  console.log(`\n📨 ULTIMO MESSAGGIO RICEVUTO:`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📞 Da: ${lastMessage.from || 'N/A'}`);
  console.log(`📅 Data: ${timestamp ? timestamp.toLocaleString('it-IT') : 'N/A'}`);
  console.log(`📝 Tipo: ${lastMessage.type || 'N/A'}`);
  console.log(`💬 Messaggio:`);
  console.log(`   ${lastMessage.text?.body || lastMessage.body || '(messaggio non testuale)'}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (messagesFromNumber.length > 1) {
    console.log(`\n📋 Ultimi ${Math.min(5, messagesFromNumber.length)} messaggi:`);
    messagesFromNumber.slice(0, 5).forEach((msg, idx) => {
      const ts = msg.timestamp ? new Date(msg.timestamp * 1000).toLocaleString('it-IT') : 'N/A';
      const preview = (msg.text?.body || msg.body || '(non testuale)').substring(0, 50);
      console.log(`   ${idx + 1}. [${ts}] ${preview}${preview.length >= 50 ? '...' : ''}`);
    });
  }
  
} catch (error) {
  console.error('❌ Errore:', error.message);
  process.exit(1);
}

