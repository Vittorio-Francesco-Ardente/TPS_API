API Benchmark Project
API styles
Scope
Benchmarks
Docs
Team

Il nostro obiettivo: confrontare tecnologie di comunicazione tra API (SOAP, GraphQL, gRPC, Webhooks, MQTT) con esempi concreti e benchmark ripetibili, per capirne casi d’uso, architetture e prestazioni.

Indice
Panoramica
Obiettivi del progetto
Tecnologie analizzate
SOAP
GraphQL
gRPC
Webhooks
MQTT
Architettura e Struttura del repository
Benchmark
Metriche misurate
Metodologia
Riproducibilità e ambiente
Possibili applicazioni
Confronto rapido (feature matrix)
Esempi minimi
Ruoli
Come contribuire
Licenza
Sitografia (fonti verificate)
Panoramica
Progetto di gruppo per studiare, implementare e confrontare API con modelli e protocolli diversi:

SOAP (XML, standard enterprise)
GraphQL (query flessibili, schema tipizzato)
gRPC (RPC ad alte prestazioni con HTTP/2 + Protobuf)
Webhooks (event-driven via callback HTTP)
MQTT (publish/subscribe leggero per IoT)
Obiettivi del progetto
Analizzare modello di comunicazione e architettura
Implementare un esempio funzionante per ogni tecnologia
Realizzare un sistema di benchmark comparabile
Misurare:
Tempo di risposta
Latenza
Throughput
Efficienza nel trasferimento dati (overhead vs payload)
Evidenziare vantaggi, limiti e casi d’uso tipici
Tecnologie analizzate
SOAP
Protocollo per lo scambio di messaggi strutturati, basato su XML, normalmente su HTTP/1.1 (può usare anche SMTP). Standard maturo e diffuso in ambito enterprise, con estensioni WS-*.

Caratteristiche principali:

Forte standardizzazione (W3C SOAP 1.2)
Envelope/Body XML, WSDL per descrizione servizi
Fault model integrato
Ottimo supporto a sicurezza e affidabilità in contesti enterprise (WS-Security, WS-ReliableMessaging)
GraphQL
Linguaggio di query per API che consente al client di chiedere esattamente i dati necessari, su uno schema fortemente tipizzato.

Caratteristiche principali:

Un unico endpoint tipico (routing logico su schema)
Evita over/under-fetching
Schema e tipi forti, introspezione
Supporto a mutations e subscriptions (in genere via WebSocket)
gRPC
Framework RPC ad alte prestazioni. Usa HTTP/2 come trasporto e Protocol Buffers (binario) per serializzazione.

Caratteristiche principali:

Prestazioni elevate e overhead ridotto
Tipizzazione forte e contratti .proto
Streaming client, server e bidirezionale
Ottimo per comunicazioni service-to-service
Webhooks
Callback HTTP inviate quando si verifica un evento. Il server sorgente “spinge” i dati al consumer registrato.

Caratteristiche principali:

Event-driven
Push near real-time
Integrazione semplice tra servizi
Richiede gestione della sicurezza (firme HMAC, retry/backoff, idempotenza)
MQTT
Protocollo publish/subscribe molto leggero, progettato per reti inaffidabili e dispositivi con risorse limitate. Basato su broker.

Caratteristiche principali:

Overhead minimo, ideale per IoT
QoS 0/1/2, retained messages, last will
Comunicazione asincrona
Topic-based routing
Architettura e Struttura del repository
Mermaid — panoramica del sistema e dei flussi principali:

mermaid

flowchart LR
  subgraph Bench[Benchmark Runner]
    LG[Load Generator]:::box
    METRICS[Collector & Reporter]:::box
  end

  LG -->|HTTP/1.1 + XML| SOAP[(SOAP Service)]
  LG -->|HTTP/1.1 + JSON| GQL[(GraphQL API)]
  LG -->|HTTP/2 + Protobuf| GRPC[(gRPC Service)]

  SRC[Event Source] -->|HTTP POST| WH[Webhook Receiver]
  PUB[MQTT Publisher] -->|MQTT| BR[(MQTT Broker)] --> SUB[MQTT Subscriber]

  METRICS -.->|CSV/JSON| DOCS[(docs/results)]
  classDef box fill:#eef7ff,stroke:#6ea8fe,stroke-width:1px,color:#0b3b8c
Struttura tipica del repo:

text

/soap/           # Esempio SOAP + README specifico
/graphql/        # Esempio GraphQL + README specifico
/grpc/           # Esempio gRPC + README specifico
/webhooks/       # Esempio Webhooks + README specifico
/mqtt/           # Esempio MQTT + README specifico
/benchmark/      # Strumenti di benchmark (runner, scripts, report generator)
/docs/           # Documentazione e risultati benchmark
Suggerimento: ogni cartella tecnologia include un README con:

Setup e dipendenze
Come avviare server/client
Endpoint o schema, payload d’esempio
Note su sicurezza e osservabilità
Benchmark
Metriche misurate
Tempo di risposta (response time): tempo end-to-end per richiesta
Latenza: dal primo byte inviato al primo byte ricevuto (TTFB)
Throughput: richieste/secondo o messaggi/secondo
Efficienza nel trasferimento: byte utili vs overhead protocollo/headers
Error rate: percentuale richieste fallite/timeouts
Percentili: p50/p90/p95/p99 per catturare code path “lenti”
Metodologia
Per garantire confronti corretti e ripetibili:

Stesso hardware, rete e runtime per tutti i test
Warm-up prima di misurare (JIT/caches/connessioni)
Misure su carichi crescenti (es. 1, 10, 100, 1000 req/s)
Payload comparabili: es. 1 KB, 10 KB, 100 KB
Pattern equivalenti:
Unary request/response per tutti
Streaming test separati solo dove supportato (gRPC)
Campionamento sufficiente (durata minima 1-3 minuti per step)
Registrazione completa: comandi, versioni, commit hash, data e ora
I risultati vengono salvati in docs/ con:

Dati grezzi (JSON/CSV)
Grafici generati (PNG/SVG) o Mermaid
Note di interpretazione e limiti
Esempio di blocco risultati (placeholder da sostituire con dati reali):

mermaid

pie title Distribuzione errori per tecnologia (ESEMPIO)
  "SOAP" : 2
  "GraphQL" : 1
  "gRPC" : 0
  "Webhooks" : 3
  "MQTT" : 1
Riproducibilità e ambiente
Annotare:
CPU, RAM, OS, kernel
Versioni runtime (es. Node/Go/Python/Java), librerie client/server
Impostazioni rete (latency shaping se usato)
Sincronizzare l’orologio (NTP) e usare monotonic clock per misure
Disattivare power-saving aggressivi; pin CPU se necessario
Eseguire test in locale o su VLAN isolata per ridurre rumore
Possibili applicazioni
Didattica: capire differenze tra stili e protocolli di API
Scelta tecnologica: linee guida per selezionare l’approccio corretto
Studi comparativi: valutazione performance in sistemi distribuiti e IoT
Confronto rapido (feature matrix)
Caratteristica	SOAP	GraphQL	gRPC	Webhooks	MQTT
Formato dati	XML	JSON (tipi schema)	Protobuf (binario)	JSON/XML (varia)	Binario proprietario MQTT
Trasporto	HTTP/1.1, SMTP	Tipicamente HTTP/1.1	HTTP/2	HTTP/1.1	TCP (porta 1883/8883 TLS)
Tipizzazione	WSDL/XSD	Schema tipizzato	.proto	Nessuna fissa (contratto ad hoc)	Topic-based, payload libero
Streaming	No (standard)	Subscriptions (non standard)	Sì (client/server/bidirezionale)	No (eventi singoli)	Asincrono via broker
Pattern	RPC document/literal	Query/Mutation/Subscription	RPC	Event-driven (push)	Pub/Sub
Casi d’uso tipici	Enterprise legacy/integration	API data-centric	M2M, microservizi, low-latency S2S	Integrazioni SaaS	IoT, reti intermittenti
Nota: GraphQL subscriptions richiedono trasporti aggiuntivi (es. WebSocket). SOAP può essere esteso con WS-* per affidabilità/sicurezza avanzata.

Esempi minimi
SOAP — Envelope di richiesta:
XML

<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
  <soap:Body>
    <m:GetPrice xmlns:m="https://example.com/stock">
      <m:StockName>IBM</m:StockName>
    </m:GetPrice>
  </soap:Body>
</soap:Envelope>
GraphQL — Query:
GraphQL

query {
  user(id: "123") {
    id
    name
  }
}
gRPC — Contratto .proto:
proto

syntax = "proto3";

service Greeter {
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

message HelloRequest {
  string name = 1;
}

message HelloReply {
  string message = 1;
}
Webhook — Richiesta HTTP d’evento:
http

POST /webhooks/order HTTP/1.1
Host: receiver.example.com
Content-Type: application/json
X-Signature: sha256=...

{ "event": "order.created", "id": "evt_123", "data": { "orderId": "o_42" } }
MQTT — Pubblica un messaggio:
Bash

mosquitto_pub -h broker.example.com -t sensors/temperature -m "22.4" -q 1
Ruoli
Tecnologia	Responsabile
MQTT	ARDENTE VITTORIO FRANCESCO
GraphQL	COLCOL JEROME
gRPC	GAMBA ALESSANDRO
SOAP	IQBAL UMAR
Webhooks	PREVITALI MATTIA
Come contribuire
Apri una issue per proposte, bug o risultati anomali
Per nuove misure:
Descrivi ambiente, comandi, versioni
Allega dati grezzi (CSV/JSON) e grafici
Mantieni gli esempi minimi ma completi (build/run/test)
Evita dipendenze non necessarie nei micro-bench
Suggerimento: aggiungi un README in /benchmark con i comandi esatti per lanciare i test e generare report in docs/.

Licenza
Aggiungi una licenza al repository (consigliato):

Guida: https://choosealicense.com/
Esempi comuni: MIT, Apache-2.0, GPL-3.0
Sitografia (fonti verificate)
SOAP
W3C SOAP 1.2 (Recommendation): https://www.w3.org/TR/soap12-part1/
WSDL 1.1: https://www.w3.org/TR/wsdl
GraphQL
Sito ufficiale: https://graphql.org/
Specifica GraphQL: https://spec.graphql.org/
gRPC
Docs ufficiali: https://grpc.io/docs/
Protocol Buffers: https://protobuf.dev/
HTTP/2 (RFC 7540): https://www.rfc-editor.org/rfc/rfc7540
Webhooks
Best practices GitHub Webhooks: https://docs.github.com/webhooks
Stripe webhook signing (esempio di firma HMAC): https://stripe.com/docs/webhooks
Webhooks.fyi (catalogo e pratiche): https://webhooks.fyi/
MQTT
Sito ufficiale: https://mqtt.org/
OASIS Standard MQTT v3.1.1: https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html
OASIS Standard MQTT v5.0: https://docs.oasis-open.org/mqtt/mqtt/v5.0/os/mqtt-v5.0-os.html
