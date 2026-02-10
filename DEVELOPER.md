# Documentazione Sviluppatore - Sistema CloudTalk + WhatsApp

## 📁 Struttura del Progetto

```
cloudtalkNEW/
├── server.js              # Server principale Express.js (tutto il codice)
├── db.js                  # Client Supabase e configurazione database
├── vercel.json            # Configurazione deployment Vercel
├── package.json           # Dipendenze Node.js
├── supabase/
│   └── functions/
│       └── webhook/
│           └── index.ts   # Edge Function Supabase (non usato attualmente)
└── *.sql                  # Script SQL per setup database
```

## 🏗️ Architettura

### Stack Tecnologico
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel (Serverless Functions)
- **API Esterna**: Wasender (WhatsApp API)

### Flusso Dati

```
CloudTalk → POST /webhook/cloudtalk → saveRequestToDB() → saveCloudTalkCallData() → sendWhatsAppMessage()
                                                                                        ↓
Wasender → POST /api/whatsapp-webhook → Update electricity_bill_received → Save to webhook_requests
```

## 📂 File Principali

### `server.js` (2295 righe)

File principale che contiene tutto il codice del server. Organizzato in sezioni:

#### 1. **Setup e Middleware** (righe 1-20)
- Import dipendenze
- Configurazione Express
- Parsing JSON e text

#### 2. **Funzioni Database** (righe 22-250)
- **`saveRequestToDB(requestData)`** (riga 22)
  - Salva tutti i webhook in `webhook_requests`
  - Rileva automaticamente se è un webhook CloudTalk
  - Processa webhook CloudTalk e invia WhatsApp
  
- **`saveCloudTalkCallData(webhookRequestId, body)`** (riga 178)
  - Salva dati chiamata in `cloudtalk_calls`
  - Normalizza i dati da CloudTalk
  - Gestisce duplicati

#### 3. **Funzioni WhatsApp** (riga 254-400)
- **`sendWhatsAppMessage(phoneNumber, webhookRequestId, callId)`** (riga 254)
  - Invia messaggio via API Wasender
  - Endpoint: `POST https://www.wasenderapi.com/api/send-message`
  - Payload: `{ to: "393209793492", text: "messaggio" }`
  - Salva messaggio inviato in `webhook_requests` con `from_me: true`

#### 4. **Monitor Page** (riga 437-841)
- **`GET /monitor`** - Interfaccia web HTML con JavaScript
- Auto-refresh ogni 5 secondi
- Mostra messaggi in arrivo e inviati
- Usa `/api/whatsapp-incoming` per ottenere i dati

#### 5. **Middleware Request Capture** (riga 844-882)
- Cattura tutte le richieste POST
- **IMPORTANTE**: Salta `/webhook/cloudtalk` per evitare duplicazioni
- Salva in memoria e database

#### 6. **Endpoint Webhook CloudTalk** (riga 1015-1060)
- **`POST /webhook/cloudtalk`**
- Riceve dati chiamate da CloudTalk
- Chiama `saveRequestToDB()` che processa tutto
- Risponde con JSON di conferma

#### 7. **Endpoint Webhook Wasender** (riga 1387-1558)
- **`POST /api/whatsapp-webhook`**
- Verifica webhook secret
- Estrae numero mittente e testo messaggio
- **Aggiorna `electricity_bill_received = true`** se trova corrispondenza in `cloudtalk_calls`
- Salva messaggio in `webhook_requests`

#### 8. **API Endpoints** (varie righe)
- **`GET /api/whatsapp-incoming`** (riga 1828) - Messaggi per il monitor
- **`GET /api/cloudtalk-calls`** (riga 1119) - Lista chiamate
- **`POST /api/send-whatsapp`** (riga 1257) - Invio manuale WhatsApp
- Altri endpoint per debugging e gestione

### `db.js` (76 righe)

- Inizializza client Supabase
- Gestisce mancanza di credenziali con mock client
- Timeout 10 secondi per fetch
- Logging dettagliato delle chiamate

### `vercel.json` (27 righe)

- Configurazione deployment Vercel
- Route mapping
- Variabili d'ambiente (da spostare in Vercel dashboard per sicurezza)

## 🔧 Modifiche Comuni

### Modificare il Messaggio WhatsApp

**File**: `server.js`  
**Funzione**: `sendWhatsAppMessage()` (riga 254)  
**Riga da modificare**: ~278

```javascript
const message = `Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.`;
```

### Modificare la Logica di Invio

**File**: `server.js`  
**Funzione**: `saveRequestToDB()` (riga 22)  
**Sezione**: righe 143-160

Attualmente invia sempre se c'è un numero. Per aggiungere condizioni:

```javascript
if (callData.phone_number && callData.should_send === true) {
  // Invia solo se should_send è true
}
```

### Modificare il Monitor

**File**: `server.js`  
**Endpoint**: `GET /monitor` (riga 437)  
**Sezione**: righe 437-841

L'HTML è in un template string. Modifica:
- Stile CSS (righe ~450-550)
- JavaScript per refresh (righe ~600-830)
- Layout HTML (righe ~550-600)

### Aggiungere Nuovo Endpoint

Aggiungi dopo gli altri endpoint (dopo riga 2200):

```javascript
app.get('/api/nuovo-endpoint', async (req, res) => {
  try {
    // Il tuo codice qui
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### Modificare la Query Database

**File**: `server.js`  
Cerca le chiamate a `supabase.from('nome_tabella')`

Esempio per modificare query `cloudtalk_calls`:

```javascript
const { data, error } = await supabase
  .from('cloudtalk_calls')
  .select('*')
  .eq('phone_number', phoneNumber)
  .order('created_at', { ascending: false })
  .limit(10);
```

## 🗄️ Schema Database

### Tabella `webhook_requests`

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

### Tabella `cloudtalk_calls`

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
- electricity_bill_received (boolean) ⭐ IMPORTANTE
- annual_consumption_kwh (integer)
- should_send (boolean)
- reason (text)
- raw_data (jsonb)
- created_at (timestamp)
```

## 🔍 Debugging

### Log Importanti da Cercare

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
📨 Message from 393209793492: [testo]
✅ Updated electricity_bill_received=true for X call(s) from 393209793492
```

**Errori Comuni**:
```
❌ WhatsApp send failed: [errore]
❌ Error updating electricity_bill_received: [errore]
❌ Fetch failed for [URL]: [errore]
```

### Test Locale

```bash
# Avvia server locale
npm run dev

# Test webhook CloudTalk
curl -X POST http://localhost:3000/webhook/cloudtalk \
  -H "Content-Type: application/json" \
  -d '{"data": {"callId": "test", "phoneNumber": "+393209793492", "shouldSend": true}}'

# Test webhook Wasender
curl -X POST http://localhost:3000/api/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: [secret]" \
  -d '{"event": "messages.received", "data": {"messages": {"key": {"fromMe": false, "cleanedSenderPn": "393209793492"}, "messageBody": "test"}}}'
```

## 🚨 Problemi Conosciuti e Soluzioni

### 1. Duplicazione Webhook CloudTalk

**Problema**: Webhook processato due volte  
**Causa**: Middleware e endpoint processano entrambi  
**Soluzione**: Middleware salta `/webhook/cloudtalk` (riga 869)

### 2. Rate Limit Wasender (429)

**Problema**: "You can send 1 message every 1 minute"  
**Causa**: Piano trial limitato  
**Soluzione**: Aspettare 60 secondi tra messaggi o upgrade piano

### 3. Campo `text` vs `body` in Wasender

**Problema**: Errore 422 "text field is required"  
**Causa**: Wasender richiede `text`, non `body`  
**Soluzione**: Usare `text: message` nel payload (già corretto)

### 4. SSL/TLS Errors

**Problema**: "SSL routines:ssl3_read_bytes:tlsv1 unrecognized name"  
**Causa**: URL API Wasender errato  
**Soluzione**: Usare `https://www.wasenderapi.com/api`

## 📝 Best Practices

1. **Sempre loggare errori** con `console.error()`
2. **Gestire timeout** per chiamate esterne (10 secondi)
3. **Validare input** prima di processare
4. **Usare try/catch** per tutte le operazioni async
5. **Non bloccare risposte** - usare `await` solo quando necessario
6. **Testare webhook** con curl prima di deployare

## 🔐 Sicurezza

- **Webhook Secret**: Sempre verificare per Wasender
- **Environment Variables**: Non committare in git
- **Input Validation**: Validare tutti gli input
- **Rate Limiting**: Considerare rate limiting per produzione

## 🚀 Deployment

### Vercel

```bash
# Deploy
vercel --prod

# Variabili d'ambiente vanno configurate in Vercel Dashboard
# Settings → Environment Variables
```

### Git Workflow

```bash
git add .
git commit -m "Descrizione modifica"
git push  # Auto-deploy su Vercel
```

## 📚 Risorse

- [Express.js Docs](https://expressjs.com/)
- [Supabase Docs](https://supabase.com/docs)
- [Wasender API Docs](https://wasenderapi.com/api-docs)
- [Vercel Docs](https://vercel.com/docs)

## 🐛 Reporting Bug

Quando segnali un bug, includi:
1. Log completi da Vercel
2. Payload del webhook (senza dati sensibili)
3. Timestamp dell'errore
4. Descrizione di cosa stavi facendo

