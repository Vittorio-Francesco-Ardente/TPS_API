# API Protocol Benchmark — Merged Project

Progetto unificato che combina:
- **Backend reale Node.js** (dal progetto `apiBenchmark`) per REST, GraphQL e gRPC
- **Frontend React/Vite** (dal progetto `api-protocol-benchmark-comparison`) con UI avanzata
- **Protocol Guide** per tutti e 6 i protocolli (REST, GraphQL, gRPC, SOAP, MQTT, Webhooks)
- **Visualizzatore HTML Report** generato da `api-benchmark`

---

## Struttura del Progetto

```
merged-project/
├── src/                        # Frontend React (Vite + TypeScript + Tailwind)
│   ├── App.tsx                 # App principale con tab: Client · Server · Table · Protocol Guide · HTML Report
│   ├── components/
│   │   ├── ConfigPanel.tsx     # Configurazione: 3 protocolli benchmarkabili + 3 info-only
│   │   ├── ProtocolCards.tsx   # Guida tutti e 6 i protocolli (con badge ✓ Benchmarkable)
│   │   ├── ResultsCharts.tsx   # Grafici latenza client
│   │   ├── ServerMetrics.tsx   # Metriche server-side
│   │   ├── ResultsTable.tsx    # Tabella dati dettagliata
│   │   ├── SummaryCards.tsx    # Riepilogo run
│   │   ├── ProgressBar.tsx     # Barra avanzamento benchmark
│   │   └── HistoryPanel.tsx    # Storico run precedenti
│   ├── engine/benchmark.ts     # Engine benchmark (Web Workers)
│   ├── servers/                # Worker servers per REST · GraphQL · gRPC · SOAP · MQTT · Webhooks
│   └── data/protocols.ts       # Descrizioni tutti e 6 i protocolli
│
├── servers/                    # Backend Node.js reali
│   ├── rest-server.js          # REST API → porta 3001
│   ├── graphql-server.js       # GraphQL → porta 3002
│   ├── grpc-server.js          # gRPC → porta 3003
│   └── start-all.js            # Avvia tutti e 3 i server
│
├── benchmark/
│   ├── run-benchmark.js        # Script benchmark con api-benchmark
│   └── report.html             # Report HTML pre-generato (visibile nel tab "HTML Report")
│
├── proto/
│   └── service.proto           # Protobuf schema per gRPC
│
├── public/
│   └── benchmark/
│       └── report.html         # Copia del report servita dal frontend
│
└── package.json
```

---

## Come Usarlo

### 1. Installazione dipendenze

```bash
npm install
```

### 2. Avvio Backend (terminale 1)

```bash
npm run start:servers
```

> **Nota:** I server usano CommonJS (`.cjs`) per compatibilità con `"type": "module"` richiesto da Vite.

Questo avvia:
- `REST Server` → http://localhost:3001
- `GraphQL Server` → http://localhost:3002
- `gRPC Server` → localhost:3003

### 3. Avvio Frontend (terminale 2)

```bash
npm run dev
```

Apri http://localhost:5173

### 4. (Opzionale) Genera un nuovo report HTML

```bash
# Assicurati che i server siano avviati, poi:
npm run benchmark
# Copia il report generato nella cartella public:
cp benchmark/report.html public/benchmark/report.html
```

---

## Funzionalità UI

| Tab | Descrizione |
|-----|-------------|
| **Client Metrics** | Grafici latenza, throughput, payload size lato client |
| **Server Metrics** | Parsing, validation, processing, serialization time lato server |
| **Data Table** | Tabella completa con tutti i sample |
| **Protocol Guide** | Descrizioni, pro/contro e use case di tutti e 6 i protocolli |
| **HTML Report** | Visualizzatore iframe del report `api-benchmark` pre-generato |

### Nota sui protocolli

- **REST · GraphQL · gRPC** → benchmark reale via Web Worker + server Node.js
- **SOAP · MQTT · Webhooks** → documentati nel Protocol Guide, nessun server attivo

---

## Stack Tecnologico

**Frontend:** React 19 · Vite 7 · TypeScript · Tailwind CSS 4 · Recharts  
**Backend:** Node.js · Express · express-graphql · @grpc/grpc-js  
**Benchmark:** [api-benchmark](https://github.com/PogiXD/api-benchmark-remake)
