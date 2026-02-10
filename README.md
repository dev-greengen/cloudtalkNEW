# Sistema CloudTalk + WhatsApp Integration

## 📋 Panoramica

Questo sistema integra **CloudTalk** (sistema di chiamate) con **Wasender** (API WhatsApp) per automatizzare l'invio di messaggi WhatsApp dopo le chiamate e tracciare le risposte dei clienti.

## 🎯 Cosa fa il sistema

### 1. **Ricezione Chiamate CloudTalk**
- CloudTalk invia un webhook quando una chiamata finisce
- Il sistema salva automaticamente i dati della chiamata nel database

### 2. **Invio Automatico WhatsApp**
- Dopo ogni chiamata, se c'è un numero di telefono, il sistema invia automaticamente un messaggio WhatsApp
- Il messaggio chiede al cliente di inviare la bolletta elettrica

### 3. **Tracciamento Risposte**
- Quando un cliente risponde via WhatsApp, il sistema aggiorna automaticamente il campo `electricity_bill_received = true`
- Questo indica che il cliente ha risposto e probabilmente ha inviato la bolletta

### 4. **Monitor in Tempo Reale**
- Interfaccia web per vedere tutti i messaggi WhatsApp (inviati e ricevuti) in tempo reale
- Accessibile all'indirizzo: `https://tuo-dominio.vercel.app/monitor`

## 🔄 Flusso Completo

```
1. Chiamata CloudTalk finisce
   ↓
2. CloudTalk invia webhook → /webhook/cloudtalk
   ↓
3. Sistema salva dati in database (cloudtalk_calls)
   ↓
4. Sistema invia automaticamente WhatsApp via Wasender
   ↓
5. Cliente risponde via WhatsApp
   ↓
6. Wasender invia webhook → /api/whatsapp-webhook
   ↓
7. Sistema aggiorna electricity_bill_received = true
```

## 🌐 Endpoint Principali

### Per CloudTalk
- **`POST /webhook/cloudtalk`** - Riceve i dati delle chiamate da CloudTalk

### Per Wasender
- **`POST /api/whatsapp-webhook`** - Riceve i messaggi WhatsApp in arrivo da Wasender

### Per Monitoraggio
- **`GET /monitor`** - Interfaccia web per vedere i messaggi in tempo reale
- **`GET /api/whatsapp-incoming`** - API per ottenere i messaggi (usata dal monitor)

## 📊 Database

Il sistema usa **Supabase** con queste tabelle principali:

- **`webhook_requests`** - Tutti i webhook ricevuti (CloudTalk e Wasender)
- **`cloudtalk_calls`** - Dati delle chiamate CloudTalk
  - `phone_number` - Numero di telefono del cliente
  - `electricity_bill_received` - Se il cliente ha risposto (true/false)
  - `should_send` - Se dovrebbe essere inviato un messaggio
  - Altri campi con dati della chiamata

## ⚙️ Configurazione

### Variabili d'Ambiente (in Vercel)

- **`SUPABASE_URL`** - URL del tuo progetto Supabase
- **`SUPABASE_KEY`** - Chiave pubblica di Supabase
- **`WHATSAPP_API_TOKEN`** - Token API di Wasender
- **`WHATSAPP_API_URL`** - URL base dell'API Wasender (es: `https://www.wasenderapi.com/api`)
- **`WHATSAPP_WEBHOOK_SECRET`** - Secret per verificare i webhook di Wasender

### Configurazione CloudTalk

1. Vai nelle impostazioni webhook di CloudTalk
2. Aggiungi l'URL: `https://tuo-dominio.vercel.app/webhook/cloudtalk`
3. Seleziona l'evento: "Call Ended" o simile

### Configurazione Wasender

1. Vai nelle impostazioni webhook di Wasender
2. Aggiungi l'URL: `https://tuo-dominio.vercel.app/api/whatsapp-webhook`
3. Seleziona l'evento: "messages.received"
4. Imposta il webhook secret (deve corrispondere a `WHATSAPP_WEBHOOK_SECRET`)

## 📱 Messaggio WhatsApp Inviati

Il sistema invia automaticamente questo messaggio (in italiano):

```
Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.
```

## 🔍 Monitor

Il monitor è accessibile all'indirizzo `/monitor` e mostra:

- **Messaggi in arrivo** (da clienti)
- **Messaggi inviati** (dal sistema)
- **Aggiornamento automatico** ogni 5 secondi
- **Fonte dati**: API Wasender o Database (fallback)

## 🚀 Deployment

Il sistema è deployato su **Vercel** e si aggiorna automaticamente quando fai push su GitHub.

### Comandi Utili

```bash
# Deploy manuale
vercel --prod

# Test locale
npm run dev
```

## 📝 Note Importanti

- **Rate Limit Wasender**: Il piano trial permette 1 messaggio ogni 60 secondi
- **Messaggi Duplicati**: Il sistema evita di processare lo stesso webhook due volte
- **Fallback Database**: Se l'API Wasender fallisce, il monitor usa i dati dal database

## 🆘 Troubleshooting

### I messaggi non vengono inviati
1. Controlla i log di Vercel per errori
2. Verifica che `WHATSAPP_API_TOKEN` e `WHATSAPP_API_URL` siano configurati
3. Controlla il rate limit di Wasender (1 messaggio/minuto nel trial)

### I messaggi non appaiono nel monitor
1. Verifica che i webhook di Wasender siano configurati correttamente
2. Controlla che `WHATSAPP_WEBHOOK_SECRET` corrisponda
3. Il monitor usa il database come fallback se l'API fallisce

### electricity_bill_received non si aggiorna
1. Verifica che il webhook di Wasender sia attivo
2. Controlla che il numero di telefono nel messaggio corrisponda a quello in `cloudtalk_calls`
3. Guarda i log per vedere se ci sono errori nell'aggiornamento

## 📞 Supporto

Per problemi o domande, controlla i log di Vercel o la documentazione per sviluppatori (`DEVELOPER.md`).

