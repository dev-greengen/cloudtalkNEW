# CloudTalk + WhatsApp Integration System

## 📋 Overview

This system integrates **CloudTalk** (call system) with **Wasender** (WhatsApp API) to automate sending WhatsApp messages after calls and track customer responses.

## 🎯 What the system does

### 1. **CloudTalk Call Reception**
- CloudTalk sends a webhook when a call ends
- The system automatically saves call data to the database

### 2. **Automatic WhatsApp Sending**
- After each call, if there's a phone number, the system automatically sends a WhatsApp message
- The message asks the customer to send their electricity bill

### 3. **Response Tracking**
- When a customer responds via WhatsApp, the system automatically updates the `electricity_bill_received = true` field
- This indicates that the customer has responded and likely sent the bill

### 4. **Real-time Monitor**
- Web interface to view all WhatsApp messages (sent and received) in real-time
- Accessible at: `https://your-domain.vercel.app/monitor`

## 🔄 Complete Flow

```
1. CloudTalk call ends
   ↓
2. CloudTalk sends webhook → /webhook/cloudtalk
   ↓
3. System saves data to database (cloudtalk_calls)
   ↓
4. System automatically sends WhatsApp via Wasender
   ↓
5. Customer responds via WhatsApp
   ↓
6. Wasender sends webhook → /api/whatsapp-webhook
   ↓
7. System updates electricity_bill_received = true
```

## 🌐 Main Endpoints

### For CloudTalk
- **`POST /webhook/cloudtalk`** - Receives call data from CloudTalk

### For Wasender
- **`POST /api/whatsapp-webhook`** - Receives incoming WhatsApp messages from Wasender

### For Monitoring
- **`GET /monitor`** - Web interface to view messages in real-time
- **`GET /api/whatsapp-incoming`** - API to get messages (used by monitor)

## 📊 Database

The system uses **Supabase** with these main tables:

- **`webhook_requests`** - All received webhooks (CloudTalk and Wasender)
- **`cloudtalk_calls`** - CloudTalk call data
  - `phone_number` - Customer phone number
  - `electricity_bill_received` - Whether customer responded (true/false)
  - `should_send` - Whether a message should be sent
  - Other fields with call data

## ⚙️ Configuration

### Environment Variables (in Vercel)

- **`SUPABASE_URL`** - Your Supabase project URL
- **`SUPABASE_KEY`** - Supabase public key
- **`WHATSAPP_API_TOKEN`** - Wasender API token
- **`WHATSAPP_API_URL`** - Wasender API base URL (e.g., `https://www.wasenderapi.com/api`)
- **`WHATSAPP_WEBHOOK_SECRET`** - Secret to verify Wasender webhooks

### CloudTalk Configuration

1. Go to CloudTalk webhook settings
2. Add URL: `https://your-domain.vercel.app/webhook/cloudtalk`
3. Select event: "Call Ended" or similar

### Wasender Configuration

1. Go to Wasender webhook settings
2. Add URL: `https://your-domain.vercel.app/api/whatsapp-webhook`
3. Select event: "messages.received"
4. Set webhook secret (must match `WHATSAPP_WEBHOOK_SECRET`)

## 📱 WhatsApp Messages Sent

The system automatically sends this message (in Italian):

```
Buongiorno, sono Samuela della Greengen Group.

Come da nostra conversazione telefonica, per procedere con la richiesta di accesso all'Agrisolare di quest'anno, avrei bisogno di ricevere una copia delle bollette elettriche.

Può inviarmele quando le ha a disposizione?

Grazie e buona giornata.
```

## 🔍 Monitor

The monitor is accessible at `/monitor` and shows:

- **Incoming messages** (from customers)
- **Sent messages** (from system)
- **Automatic refresh** every 5 seconds
- **Data source**: Wasender API or Database (fallback)

## 🚀 Deployment

The system is deployed on **Vercel** and automatically updates when you push to GitHub.

### Useful Commands

```bash
# Manual deploy
vercel --prod

# Local test
npm run dev
```

## 📝 Important Notes

- **Wasender Rate Limit**: Trial plan allows 1 message every 60 seconds
- **Duplicate Messages**: System avoids processing the same webhook twice
- **Database Fallback**: If Wasender API fails, monitor uses database data

## 🆘 Troubleshooting

### Messages are not being sent
1. Check Vercel logs for errors
2. Verify that `WHATSAPP_API_TOKEN` and `WHATSAPP_API_URL` are configured
3. Check Wasender rate limit (1 message/minute on trial)

### Messages don't appear in monitor
1. Verify Wasender webhooks are configured correctly
2. Check that `WHATSAPP_WEBHOOK_SECRET` matches
3. Monitor uses database as fallback if API fails

### electricity_bill_received doesn't update
1. Verify Wasender webhook is active
2. Check that phone number in message matches the one in `cloudtalk_calls`
3. Check logs to see if there are update errors

## 📞 Support

For problems or questions, check Vercel logs or developer documentation (`DEVELOPER.md`).
