# gRPC — Guida completa

## 1. Cos'è gRPC?

**gRPC** (Google Remote Procedure Call) è un framework RPC (Remote Procedure Call) universale, open source e ad alte prestazioni, sviluppato da Google e rilasciato nel 2015. È costruito sopra **HTTP/2** e usa **Protocol Buffers (Protobuf)** come formato di serializzazione.

> In gRPC, un'applicazione client può chiamare direttamente metodi su un'applicazione server su un altro computer **come se fosse un oggetto locale** — semplificando enormemente lo sviluppo di applicazioni distribuite.

---

## 2. Come funziona (passo per passo)

### 2.1 Definisci un contratto `.proto`

Il punto di partenza è sempre un file `.proto` che definisce i servizi e i tipi di dato condivisi tra client e server:

```proto
syntax = "proto3";

service UserService {
  rpc GetUser (UserRequest) returns (UserResponse);
}

message UserRequest {
  int32 id = 1;
}

message UserResponse {
  int32 id = 1;
  string name = 2;
}
```

Questo file:
- definisce il **servizio** e i suoi metodi
- definisce i **tipi** dei messaggi
- è **condiviso** tra client e server come contratto unico

### 2.2 Generazione automatica del codice

Dal file `.proto` vengono generati automaticamente:
- il codice **server**
- lo **stub client**
- le **classi dei messaggi**

Non è necessario scrivere manualmente la serializzazione/deserializzazione.

### 2.3 Flusso di comunicazione

Quando il client chiama `stub.GetUser({ id: 5 })`, succede questo:

```
1. Oggetto JS → serializzato in Protobuf (binario)
2. Inviato via HTTP/2
3. Server deserializza il messaggio
4. Esegue la funzione corrispondente
5. Risposta serializzata e rimandataal client
6. Client deserializza e usa l'oggetto
```

La chiamata sembra locale, ma è completamente remota.

---

## 3. Efficienza e quantità di dati trasmessi

### 3.1 JSON (REST)

```json
{ "id": 5, "name": "Mario" }
```

- Formato **testuale**
- Ripete i **nomi dei campi** ad ogni messaggio
- Più byte trasmessi
- Parsing più lento

### 3.2 Protobuf (gRPC)

Lo stesso dato diventa una struttura binaria compatta dove:
- i nomi dei campi **NON vengono inviati**
- vengono usati **identificatori numerici** (es. `1`, `2`)
- la struttura è **binaria**
- occupa molto meno spazio

### 3.3 Confronto reale

| Tipo     | Dimensione relativa | Velocità di parsing |
|----------|---------------------|---------------------|
| JSON     | 100%                | Lenta               |
| Protobuf | ~30–60%             | Molto veloce        |

In sistemi con migliaia di richieste al secondo o microservizi interni, la differenza è sostanziale.

---

## 4. Perché è più efficiente (tecnicamente)

### 4.1 HTTP/2

gRPC si appoggia interamente su HTTP/2, che rispetto a HTTP/1.1 offre:

| Feature                   | HTTP/1.1 | HTTP/2 |
|--------------------------|----------|--------|
| Multiplexing             | ❌        | ✅      |
| Header compressi (HPACK) | ❌        | ✅      |
| Connessione persistente  | Parziale | ✅      |
| Server push              | ❌        | ✅      |

Il **multiplexing** è particolarmente rilevante: permette di inviare più richieste contemporaneamente su una sola connessione TCP, eliminando il problema del "head-of-line blocking" tipico di HTTP/1.1.

### 4.2 Binario vs testo

| Aspetto        | JSON         | Protobuf              |
|----------------|--------------|-----------------------|
| Formato        | Testo        | Binario               |
| Parsing        | Stringhe     | Strutturato nativo    |
| CPU usata      | Alta         | Bassa                 |
| Banda usata    | Alta         | Bassa                 |

---

## 5. gRPC vs REST

| Aspetto           | gRPC            | REST           |
|-------------------|-----------------|----------------|
| Formato dati      | Binario (Protobuf) | JSON/Testo  |
| Performance       | Alta            | Media          |
| Streaming nativo  | ✅ Sì           | ❌ Difficile   |
| Tipizzazione      | Forte (contratto) | Debole       |
| Supporto browser  | ❌ No diretto   | ✅ Sì          |
| Debug manuale     | Difficile       | Facile         |
| Contratto API     | `.proto` obbligatorio | Opzionale (OpenAPI) |

### Quando usare gRPC ✅
- Microservizi (comunicazione backend ↔ backend)
- Alta frequenza di chiamate
- Streaming realtime
- Mobile app con risorse limitate
- Sistemi distribuiti che richiedono tipizzazione forte

### Quando NON usare gRPC ❌
- API pubbliche consumate da browser
- Siti web semplici
- Progetti piccoli con poca infrastruttura
- Quando serve leggibilità e debug manuale

---

## 6. Tipi di comunicazione gRPC

gRPC supporta quattro modalità di comunicazione:

| Tipo                       | Richieste | Risposte | Caso d'uso tipico              |
|----------------------------|-----------|----------|-------------------------------|
| **Unary**                  | 1         | 1        | CRUD classico                 |
| **Server streaming**       | 1         | Molte    | Feed live, notifiche          |
| **Client streaming**       | Molte     | 1        | Upload file, batch processing |
| **Bidirectional streaming**| Stream    | Stream   | Chat, gaming, telemetria      |

```proto
// Unary
rpc GetUser (UserRequest) returns (UserResponse);

// Server streaming
rpc ListUsers (UserRequest) returns (stream UserResponse);

// Client streaming
rpc CreateUsers (stream UserRequest) returns (UserResponse);

// Bidirectional
rpc Chat (stream Message) returns (stream Message);
```

---

## 7. API Gateway: il ponte con il mondo esterno

I browser non supportano gRPC nativo (richiedono HTTP/2 con controllo a basso livello non disponibile nelle Web API). La soluzione è un **API Gateway** che funge da traduttore.

### Flusso con API Gateway

```
Client web
   │  REST + JSON
   ▼
API Gateway ──── traduce JSON → Protobuf ────► Servizio gRPC
   ▲                                                │
   │  REST + JSON    ◄── traduce Protobuf → JSON ───┘
Client web riceve risposta
```

L'API Gateway:
- Riceve richieste HTTP/1.1 + JSON
- Le traduce in chiamate gRPC (Protobuf)
- Riceve la risposta Protobuf
- La riconverte in JSON per il client

Strumenti comuni: **Envoy Proxy**, **grpc-gateway**, **Kong**, **AWS API Gateway**.

---

## 8. Implementazione in JavaScript (Node.js)

### 8.1 Installazione

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

### 8.2 File `user.proto`

```proto
syntax = "proto3";

service UserService {
  rpc GetUser (UserRequest) returns (UserResponse);
}

message UserRequest {
  int32 id = 1;
}

message UserResponse {
  int32 id = 1;
  string name = 2;
}
```

### 8.3 Server gRPC

```js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync('user.proto');
const proto = grpc.loadPackageDefinition(packageDefinition);

function getUser(call, callback) {
  callback(null, { id: call.request.id, name: "Mario Rossi" });
}

const server = new grpc.Server();
server.addService(proto.UserService.service, {
  GetUser: getUser,
});

server.bindAsync(
  '0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  () => {
    server.start();
  }
);
```

### 8.4 Client gRPC

```js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const packageDefinition = protoLoader.loadSync('user.proto');
const proto = grpc.loadPackageDefinition(packageDefinition);

const client = new proto.UserService(
  'localhost:50051',
  grpc.credentials.createInsecure()
);

client.GetUser({ id: 10 }, (err, response) => {
  console.log(response); // { id: 10, name: 'Mario Rossi' }
});
```

> La chiamata `client.GetUser(...)` sembra una normale chiamata a metodo locale, ma in realtà viaggia via rete serializzata in Protobuf su HTTP/2.

---

## 9. Caso reale: microservizi e-commerce

Un'architettura tipica in produzione usa gRPC internamente e REST verso l'esterno:

```
Frontend (React/Vue)
        │
        │ REST + JSON
        ▼
   API Gateway
   ┌────┴─────────────────────────────┐
   │         gRPC (interno)           │
   ▼          ▼          ▼           ▼
AuthService  OrderService  PaymentService  InventoryService
```

- **Internamente**: gRPC per la comunicazione tra microservizi (performance, tipizzazione)
- **Esternamente**: REST per il frontend e le API pubbliche (compatibilità browser)

Questo pattern è estremamente comune in ambienti cloud-native (Google, Netflix, Uber).

---

## 10. Riassunto

gRPC è un sistema RPC moderno, binario e performante, basato su contratti tipizzati, ideale per backend distribuiti.

| Caratteristica     | Descrizione                                      |
|--------------------|--------------------------------------------------|
| Protocollo base    | HTTP/2                                           |
| Formato dati       | Protocol Buffers (Protobuf)                      |
| Linguaggi supporti | C++, Java, Python, Go, Node.js, Ruby, C#, PHP…  |
| Streaming          | Unary, Server, Client, Bidirezionale             |
| Ideale per         | Microservizi, sistemi distribuiti, mobile        |
| Non ideale per     | API pubbliche, browser diretti, debug manuale    |

> **gRPC è meno leggibile ma molto più efficiente di REST.** La scelta dipende dal contesto: in sistemi distribuiti ad alta frequenza, è spesso la scelta migliore.
