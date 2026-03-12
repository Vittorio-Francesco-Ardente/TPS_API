# Webhooks — Guida completa

## Indice
1. [Cos'è un Webhook?](#1-cosè-un-webhook)
2. [Come funziona (passo per passo)](#2-come-funziona-passo-per-passo)
   - 2.1 [Registrazione dell'endpoint](#21-registrazione-dellendpoint)
   - 2.2 [Ricezione dell'evento](#22-ricezione-dellevento)
   - 2.3 [Flusso di comunicazione](#23-flusso-di-comunicazione)
3. [Struttura del payload](#3-struttura-del-payload)
   - 3.1 [Payload tipico](#31-payload-tipico)
   - 3.2 [Headers importanti](#32-headers-importanti)
   - 3.3 [Confronto con polling](#33-confronto-con-polling)
4. [Sicurezza](#4-sicurezza)
   - 4.1 [Firma HMAC](#41-firma-hmac)
   - 4.2 [HTTPS e validazione](#42-https-e-validazione)
5. [Webhooks vs REST vs WebSocket](#5-webhooks-vs-rest-vs-websocket)
6. [Tipi di eventi Webhook](#6-tipi-di-eventi-webhook)
7. [Gestione degli errori e retry](#7-gestione-degli-errori-e-retry)
8. [Implementazione in JavaScript (Node.js)](#8-implementazione-in-javascript-nodejs)
   - 8.1 [Installazione](#81-installazione)
   - 8.2 [Server Express per ricevere Webhook](#82-server-express-per-ricevere-webhook)
   - 8.3 [Verifica della firma](#83-verifica-della-firma)
   - 8.4 [Client per registrare un Webhook](#84-client-per-registrare-un-webhook)
9. [Caso reale: sistema di pagamenti e-commerce](#9-caso-reale-sistema-di-pagamenti-e-commerce)
10. [Riassunto](#10-riassunto)

---

## 1. Cos'è un Webhook?

Un **Webhook** (detto anche *reverse API* o *HTTP callback*) è un meccanismo che permette a un'applicazione di **notificare automaticamente** un'altra applicazione quando si verifica un determinato evento, inviando una richiesta HTTP verso un URL predefinito.

> Invece di chiedere continuamente "ci sono novità?" (polling), con i Webhook è il sistema remoto a **bussare alla tua porta** non appena accade qualcosa di rilevante.

La differenza fondamentale rispetto a una REST API classica è la direzione della comunicazione:
- **REST API**: sei tu a chiamare il server per ottenere dati
- **Webhook**: è il server a chiamare te quando i dati cambiano

---

## 2. Come funziona (passo per passo)

### 2.1 Registrazione dell'endpoint

Il primo passo è fornire al servizio esterno un URL pubblico (il tuo endpoint) su cui vuoi ricevere le notifiche:

```http
POST https://api.stripe.com/v1/webhook_endpoints
Content-Type: application/x-www-form-urlencoded

url=https://tuodominio.com/webhooks/stripe
&enabled_events[]=payment_intent.succeeded
&enabled_events[]=customer.subscription.deleted
```

Questo URL:
- deve essere **pubblicamente raggiungibile**
- deve rispondere con HTTP **200** per confermare la ricezione
- è specifico per ogni servizio che lo chiama

### 2.2 Ricezione dell'evento

Quando si verifica l'evento registrato, il servizio esterno invia una richiesta `POST` con un payload JSON al tuo endpoint:

```
POST https://tuodominio.com/webhooks/stripe
Content-Type: application/json
Stripe-Signature: t=1614556800,v1=abc123...

{
  "id": "evt_1234567890",
  "type": "payment_intent.succeeded",
  "data": { ... }
}
```

### 2.3 Flusso di comunicazione

```
1. Utente completa un acquisto su Stripe
2. Stripe genera un evento "payment_intent.succeeded"
3. Stripe invia una POST al tuo endpoint registrato
4. Il tuo server riceve il payload JSON
5. Verifica la firma HMAC per autenticità
6. Elabora l'evento (aggiorna DB, invia email, ecc.)
7. Risponde con HTTP 200 per confermare la ricezione
```

Il tutto avviene in **tempo reale**, senza polling o attese.

---

## 3. Struttura del payload

### 3.1 Payload tipico

Un evento Webhook ha generalmente questa struttura:

```json
{
  "id": "evt_1234567890abcdef",
  "type": "payment_intent.succeeded",
  "created": 1614556800,
  "livemode": true,
  "data": {
    "object": {
      "id": "pi_9876543210",
      "amount": 4999,
      "currency": "eur",
      "status": "succeeded",
      "customer": "cus_ABC123"
    }
  },
  "metadata": {
    "order_id": "ORD-789"
  }
}
```

I campi comuni a quasi tutti i Webhook:

| Campo     | Descrizione                                      |
|-----------|--------------------------------------------------|
| `id`      | Identificatore univoco dell'evento               |
| `type`    | Tipo di evento (es. `payment.succeeded`)         |
| `created` | Timestamp Unix di quando si è verificato         |
| `data`    | L'oggetto principale coinvolto nell'evento       |

### 3.2 Headers importanti

I Webhook includono sempre header HTTP rilevanti per la sicurezza e il routing:

| Header                  | Scopo                                          |
|-------------------------|------------------------------------------------|
| `Content-Type`          | Solitamente `application/json`                 |
| `X-Signature` / simili  | Firma HMAC per verificare l'autenticità        |
| `X-Event-Type`          | Tipo di evento (in alcuni servizi)             |
| `User-Agent`            | Identifica il servizio mittente                |

### 3.3 Confronto con polling

| Aspetto             | Polling                        | Webhook                        |
|---------------------|-------------------------------|--------------------------------|
| Chi inizia          | Il tuo server                  | Il servizio remoto             |
| Frequenza           | Ogni N secondi (fissa)         | Solo quando accade un evento   |
| Latenza             | Fino a N secondi               | Quasi zero                     |
| Carico server       | Alto (richieste continue)      | Basso (solo su eventi reali)   |
| Complessità         | Semplice                       | Richiede endpoint pubblico     |

---

## 4. Sicurezza

### 4.1 Firma HMAC

Il rischio principale è che **chiunque** potrebbe inviare richieste false al tuo endpoint. La soluzione standard è la **firma HMAC** (Hash-based Message Authentication Code).

Come funziona:

```
1. Quando registri il Webhook, ricevi un "secret" segreto
2. Ad ogni evento, il servizio firma il payload con quel secret
3. Tu ricalcoli la firma lato server e la confronti
4. Se le firme coincidono → il messaggio è autentico
```

Esempio di verifica in Node.js:

```js
const crypto = require('crypto');

function verificaFirma(payload, signature, secret) {
  const firma = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(firma),
    Buffer.from(signature)
  );
}
```

> Usa sempre `timingSafeEqual` invece di `===` per evitare attacchi timing-based.

### 4.2 HTTPS e validazione

Oltre alla firma HMAC, segui sempre queste best practice:

- **HTTPS obbligatorio**: non accettare mai Webhook su HTTP in produzione
- **Valida il timestamp**: rifiuta eventi con timestamp troppo vecchi (replay attack)
- **Idempotenza**: gestisci il caso in cui lo stesso evento arrivi più volte
- **Whitelist IP**: se il servizio pubblica gli IP sorgente, accetta solo quelli
- **Timeout rapido**: rispondi entro 5–10 secondi o il mittente potrebbe ritentare

---

## 5. Webhooks vs REST vs WebSocket

| Aspetto              | REST API            | Webhook              | WebSocket              |
|----------------------|---------------------|----------------------|------------------------|
| Direzione            | Client → Server     | Server → Client      | Bidirezionale          |
| Tipo di comunicazione| Pull (su richiesta) | Push (su evento)     | Push continuo          |
| Connessione          | Stateless           | Stateless            | Stateful (persistente) |
| Latenza              | Media               | Bassa                | Molto bassa            |
| Complessità          | Bassa               | Media                | Alta                   |
| Supporto browser     | ✅ Sì               | ⚠️ Solo lato server  | ✅ Sì                  |
| Caso d'uso tipico    | CRUD, query         | Notifiche eventi     | Chat, gaming, live     |

### Quando usare Webhooks ✅
- Notifiche di pagamento (Stripe, PayPal)
- Aggiornamenti da CI/CD (GitHub Actions, GitLab)
- Integrazioni tra SaaS (Zapier, n8n)
- Sincronizzazione dati tra sistemi diversi
- Alert e monitoraggio in tempo reale

### Quando NON usare Webhooks ❌
- Quando hai bisogno di una risposta immediata e sincrona
- Comunicazione bidirezionale continua (usa WebSocket)
- Il tuo server non è pubblicamente raggiungibile
- Hai bisogno di storico o di interrogare dati su richiesta

---

## 6. Tipi di eventi Webhook

I Webhook si distinguono per il **tipo di evento** che scatenano. Ogni servizio definisce il proprio catalogo:

| Categoria            | Esempi di eventi                                      |
|----------------------|-------------------------------------------------------|
| **Pagamenti**        | `payment.succeeded`, `payment.failed`, `refund.created` |
| **Utenti**           | `user.created`, `user.deleted`, `subscription.updated` |
| **Repository**       | `push`, `pull_request.opened`, `issue.closed`         |
| **E-commerce**       | `order.placed`, `order.shipped`, `inventory.low`      |
| **Form / CMS**       | `form.submitted`, `entry.published`, `media.uploaded` |

```json
// Esempio eventi GitHub
{
  "action": "opened",
  "number": 42,
  "pull_request": {
    "title": "Fix login bug",
    "user": { "login": "mario-dev" },
    "base": { "ref": "main" }
  },
  "repository": {
    "full_name": "azienda/progetto"
  }
}
```

---

## 7. Gestione degli errori e retry

### Logica di retry

Se il tuo endpoint risponde con un codice di errore (5xx) o non risponde entro il timeout, la maggior parte dei servizi **riprova automaticamente** con un backoff esponenziale:

```
Tentativo 1 → immediato
Tentativo 2 → dopo 5 minuti
Tentativo 3 → dopo 30 minuti
Tentativo 4 → dopo 2 ore
Tentativo 5 → dopo 24 ore
... poi abbandona
```

### Idempotenza

Poiché lo stesso evento può arrivare **più di una volta**, il tuo handler deve essere idempotente:

```js
async function gestisciPagamento(evento) {
  const eventoGiaElaborato = await db.eventi.findOne({
    id: evento.id
  });

  if (eventoGiaElaborato) {
    console.log('Evento già processato, skip');
    return; // Non elaborare di nuovo
  }

  // Elabora l'evento
  await elaboraPagamento(evento.data);

  // Salva l'ID per evitare duplicati
  await db.eventi.insert({ id: evento.id, processedAt: new Date() });
}
```

### Coda asincrona (pattern consigliato)

```
Webhook arriva
      │
      ▼
Endpoint risponde 200 immediatamente
      │
      ▼
Payload inserito in una coda (Redis, RabbitMQ, SQS)
      │
      ▼
Worker elabora in background (senza rischio timeout)
```

Questo pattern disaccoppia la ricezione dall'elaborazione e rende il sistema più robusto.

---

## 8. Implementazione in JavaScript (Node.js)

### 8.1 Installazione

```bash
npm install express crypto
```

### 8.2 Server per ricevere un Webhook

```js
const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

app.post('/webhooks/stripe', (req, res) => {
  const evento = req.body;

  // Gestisci l'evento in base al tipo
  if (evento.type === 'payment_intent.succeeded') {
    console.log('Pagamento riuscito:', evento.data.object.id);
  }

  // Rispondi sempre con 200 per confermare la ricezione
  res.json({ received: true });
});

app.listen(3000, () => console.log('In ascolto su porta 3000'));
```

### 8.3 Verifica della firma (sicurezza)

Per verificare che il Webhook venga davvero da Stripe e non da qualcun altro:

```js
function verificaFirma(payload, signature, secret) {
  const firmaAttesa = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(firmaAttesa),
    Buffer.from(signature)
  );
}
```

> Il `secret` ti viene fornito da Stripe al momento della registrazione dell'endpoint.

---

## 9. Caso reale: sistema di pagamenti e-commerce

Un esempio concreto: un utente completa un acquisto su un sito, Stripe invia un Webhook, e il backend aggiorna l'ordine e manda la mail di conferma.

```
Utente paga
    │
    ▼
Stripe invia POST → /webhooks/stripe
    │
    ▼
Il server verifica la firma, risponde 200
    │
    ├──► Aggiorna lo stato dell'ordine nel DB
    ├──► Invia email di conferma all'utente
    └──► Scala le scorte nel magazzino
```

Ogni azione è indipendente e può essere gestita da un servizio diverso. Se una fallisce, le altre non ne risentono.

> Questo pattern è usato in produzione da Stripe, GitHub, Shopify e molti altri.

---

## 10. Riassunto

I Webhook sono il meccanismo più semplice ed efficace per ricevere notifiche push in tempo reale da servizi esterni.

| Caratteristica        | Descrizione                                              |
|-----------------------|----------------------------------------------------------|
| Protocollo base       | HTTP/1.1 o HTTP/2                                        |
| Formato dati          | JSON (solitamente)                                       |
| Direzione             | Server → Client (push)                                   |
| Autenticazione        | Firma HMAC + HTTPS                                       |
| Affidabilità          | Retry automatico con backoff esponenziale                |
| Pattern consigliato   | Risposta rapida 200 + elaborazione asincrona in coda     |
| Ideale per            | Notifiche eventi, integrazioni SaaS, pagamenti, CI/CD    |
| Non ideale per        | Comunicazione sincrona, risposte immediate, bidirezionale|

> **I Webhook sono semplici da consumare ma richiedono attenzione su sicurezza e idempotenza.** Con una firma HMAC verificata e una coda asincrona, diventano uno strumento estremamente potente per costruire sistemi reattivi e disaccoppiati.
