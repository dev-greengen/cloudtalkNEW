# Piano di Remediation - Security Assessment Livello 1

## 📋 Riepilogo Esecutivo

**Livello di Rischio:** Medio  
**Settore:** Energia  
**Dimensione:** < 100 dipendenti  
**Maturità Cybersecurity:** Base

---

## 🎯 Priorità di Remediation (Quick Wins)

### 1. **GATEWAY/ROUTER** (Priorità CRITICA - Immediata)
**IP:** 192.168.1.1  
**Criticità:** Telnet esposto, servizi di gestione accessibili

**Azioni:**
- ✅ Disabilitare Telnet (porta 23)
- ✅ Limitare SSH/HTTPS solo a VLAN di management
- ✅ Implementare ACL per IP sorgenti autorizzati
- ✅ Hardening firmware o sostituzione con firewall dedicato
- ✅ Se router ISP-managed: richiedere aggiornamento/sostituzione

---

### 2. **SEGMENTAZIONE RETE** (Priorità ALTA - Urgente)
**Obiettivo:** Isolare dispositivi per tipo e funzione

**Azioni:**
- ✅ Creare VLAN separate:
  - LAN Utenti (PC/endpoint)
  - Server/Infrastruttura
  - Stampanti
  - IoT/Smart Devices
  - CCTV/Telecamere
  - Management (solo admin)
- ✅ Configurare firewall rules tra VLAN
- ✅ Bloccare comunicazioni non necessarie tra segmenti

---

### 3. **ENDPOINT WINDOWS** (Priorità ALTA - Urgente)
**IP critici:** 192.168.1.10, 192.168.1.14, 192.168.1.12, 192.168.1.104

**Azioni:**
- ✅ **SMB/NetBIOS:**
  - Disabilitare dove non necessario
  - Rendere SMB signing **"required"** (non solo "enabled")
  - Disabilitare SMBv1 e guest access
  - Limitare SMB a subnet/VLAN specifiche
- ✅ **Accesso Remoto (AnyDesk su 192.168.1.12):**
  - Verificare autorizzazione e configurazione
  - Abilitare MFA
  - Implementare allowlist IP
  - Abilitare logging centralizzato
- ✅ **VNC (192.168.1.104):**
  - Disabilitare se non indispensabile
  - Se necessario: solo via VPN + MFA + subnet admin
  - Autenticazione robusta, cifratura, lockout
- ✅ Applicare baseline hardening (CIS/Microsoft)

---

### 4. **STAMPANTI/MFP** (Priorità MEDIO-ALTA)
**IP:** 192.168.1.8 (Canon)

**Azioni:**
- ✅ Spostare in VLAN dedicata
- ✅ Accesso solo da print-server/host autorizzati
- ✅ Disabilitare porte 515 (LPD) e 9100 (JetDirect) se non necessarie
- ✅ Forzare HTTPS e password robuste
- ✅ Disabilitare credenziali default
- ✅ Aggiornare firmware
- ✅ Abilitare logging e autenticazione per stampa/scansione

---

### 5. **DISPOSITIVI IoT/SMART** (Priorità ALTA)
**IP critici:** 192.168.1.19, 192.168.1.88

**Azioni:**
- ✅ **Segmentazione forte:**
  - VLAN IoT separata
  - Nessun accesso verso server/PC
  - Solo comunicazioni necessarie in uscita controllata
- ✅ **Inventario e gestione:**
  - Catalogare tutti i dispositivi IoT
  - Aggiornare firmware
  - Disabilitare UPnP dove presente
  - Password uniche e robuste
- ✅ **Blocco porte anomale:**
  - Bloccare 6668, 8899 tra VLAN
  - Consentire solo da jump-host amministrativi se necessario

---

### 6. **SISTEMI CCTV/NVR** (Priorità ALTA)
**IP:** 192.168.1.102 (Hikvision)

**Azioni:**
- ✅ VLAN CCTV dedicata
- ✅ Accesso ai flussi RTSP solo da host autorizzati (VMS/monitoring)
- ✅ Cambiare credenziali default
- ✅ Abilitare HTTPS dove possibile
- ✅ Aggiornare firmware (Hikvision richiede patch puntuali)
- ✅ Evitare esposizione porte management/streaming oltre il necessario
- ✅ Bloccare porta 8000 (Hikvision control) se non necessaria

---

### 7. **PIATTAFORME MANAGEMENT** (Priorità MEDIO-ALTA)
**IP:** 192.168.1.92 (Apache Tomcat su 8088)

**Azioni:**
- ✅ Verificare versione Tomcat e applicare patching
- ✅ Disabilitare manager/host-manager se non necessari
- ✅ Restringere IP sorgenti autorizzati
- ✅ Spostare in VLAN management
- ✅ Abilitare MFA dove disponibile
- ✅ Bloccare accesso da altre VLAN

---

## 📊 Matrice di Priorità

| Priorità | Criticità | Impatto | Azione | Timeline |
|----------|-----------|---------|--------|----------|
| **1** | CRITICA | Alto | Gateway/Router | **Immediata** |
| **2** | ALTA | Alto | Segmentazione Rete | **1-2 settimane** |
| **3** | ALTA | Alto | Endpoint Windows | **2-3 settimane** |
| **4** | ALTA | Alto | IoT/Smart Devices | **2-3 settimane** |
| **5** | ALTA | Alto | CCTV/NVR | **2-3 settimane** |
| **6** | MEDIO-ALTA | Medio | Stampanti | **1 mese** |
| **7** | MEDIO-ALTA | Medio | Management (Tomcat) | **1 mese** |

---

## 🔍 Attività di Approfondimento Consigliate

### Vulnerability Scanning Avanzato
- ✅ Eseguire NSE mirati (smb-vuln*, http-vuln*, ssl-enum-ciphers, vulners) su host critici
- ✅ Integrare vulnerability scanner autenticato (OpenVAS/Nessus/Qualys) su subnet server/endpoint
- ✅ Per IoT/CCTV: raccogliere versioni firmware e confrontare con bollettini vendor

### Monitoraggio e Logging
- ✅ Implementare SIEM/logging centralizzato
- ✅ Monitorare tentativi di accesso non autorizzati
- ✅ Alerting per anomalie di rete

### Formazione e Policy
- ✅ Policy di sicurezza per accesso remoto
- ✅ Formazione utenti su phishing e best practices
- ✅ Incident response plan

---

## 📝 Checklist Rapida

### Immediato (Settimana 1)
- [ ] Disabilitare Telnet su gateway
- [ ] Configurare ACL su gateway/router
- [ ] Iniziare progettazione VLAN

### Breve Termine (Settimana 2-4)
- [ ] Implementare segmentazione VLAN
- [ ] Hardening endpoint Windows (SMB signing required)
- [ ] Isolare IoT in VLAN dedicata
- [ ] Isolare CCTV in VLAN dedicata
- [ ] Configurare firewall rules tra VLAN

### Medio Termine (Mese 2-3)
- [ ] Hardening stampanti
- [ ] Hardening Tomcat/management
- [ ] Vulnerability scanning approfondito
- [ ] Implementare logging centralizzato

---

## 🎯 Obiettivi Finali

1. **Ridurre superficie d'attacco:** Isolare dispositivi per tipo
2. **Prevenire movimento laterale:** Segmentazione forte tra VLAN
3. **Proteggere asset critici:** Server e infrastruttura isolati
4. **Compliance:** Allineamento con best practices (CIS, Microsoft)
5. **Monitoraggio:** Visibilità su eventi di sicurezza

---

## 📞 Note

- **Rischio principale identificato:** Movimento laterale e compromissione rapida della LAN
- **Vettori principali:** Gateway compromesso, endpoint Windows, dispositivi IoT
- **Impatto potenziale:** Ransomware, esfiltrazione dati, manomissioni

**Tutti gli interventi devono essere testati in ambiente di staging prima della produzione.**

