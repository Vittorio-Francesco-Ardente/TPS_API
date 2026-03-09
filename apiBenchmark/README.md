# API Benchmark - 6 Protocolli

Progetto basato su [api-benchmark](https://github.com/matteofigus/api-benchmark) che confronta le performance di **6 diversi protocolli API** esposti su server Node.js separati.

## Architettura

```
┌─────────────────────────────────────────────────────────┐
│              api-benchmark (runner)                       │
│              benchmark/run-benchmark.js                   │
└──────┬───────────┬──────────┬──────────┬────────┬────────┘
       │           │          │          │        │
  ┌────▼───┐  ┌───▼───┐  ┌───▼───┐  ┌───▼──┐ ┌──▼───┐ ┌──────┐
  │  REST  │  │  MQTT │  │  SOAP │  │  GQL │ │Wbook │ │ gRPC │
  │ :3001  │  │ :3002 │  │ :3003 │  │:3004 │ │:3005 │ │:3006 │
  └────────┘  └───┬───┘  └───────┘  └──────┘ └──────┘ └──┬───┘
                  │ HTTP Bridge           HTTP Bridge       │
            ┌─────▼──────┐                         ┌───────▼──┐
            │ MQTT Broker│                         │gRPC :50051│
            │   :1883    │                         └──────────┘
            └────────────┘
```

## Server

| Server      | Porta HTTP | Protocollo Nativo | Descrizione |
|-------------|-----------|-------------------|-------------|
| **REST**    | 3001      | HTTP/REST         | CRUD completo su users e products |
| **MQTT**    | 3002      | MQTT :1883        | Broker Aedes + HTTP bridge publish/subscribe |
| **SOAP**    | 3003      | SOAP/WSDL         | Web Service con operazioni GetUsers, CreateUser |
| **GraphQL** | 3004      | GraphQL           | Query + Mutation + GraphiQL IDE |
| **Webhooks**| 3005      | HTTP callbacks    | Subscribe, trigger eventi, delivery log |
| **gRPC**    | 3006      | gRPC :50051       | Protobuf binary + HTTP bridge |

## Installazione

```bash
npm install
```

## Avvio

### Tutti i server insieme
```bash
npm run start:all
# oppure
node servers/start-all.js
```

### Server singoli
```bash
npm run start:rest       # REST      http://localhost:3001
npm run start:mqtt       # MQTT      http://localhost:3002
npm run start:soap       # SOAP      http://localhost:3003
npm run start:graphql    # GraphQL   http://localhost:3004
npm run start:webhooks   # Webhooks  http://localhost:3005
npm run start:grpc       # gRPC      http://localhost:3006
```

## Esecuzione Benchmark

```bash
# Avvia prima i server!
node servers/start-all.js &

# Aspetta 3-5 secondi, poi:
npm run benchmark
# oppure
node benchmark/run-benchmark.js
```

Il benchmark esegue:
1. **Confronto /health** su tutti e 6 i server
2. **Benchmark REST** (GET users, GET products, POST user)
3. **Benchmark GraphQL** (query users, products, stats)
4. **Benchmark gRPC** (via HTTP bridge)
5. **Confronto parallelo** REST vs GraphQL vs gRPC
6. **Genera report HTML** in `benchmark/report.html`

## Endpoint per protocollo

### REST (3001)
```
GET  /health
GET  /api/users
GET  /api/users/:id
POST /api/users       { name, email, age }
PUT  /api/users/:id
DELETE /api/users/:id
GET  /api/products
POST /api/products    { name, price, stock }
```

### MQTT Bridge (3002)
```
GET  /health
GET  /mqtt/users      (pubblica su topic MQTT, aspetta risposta)
GET  /mqtt/ping       (pubblica api/ping, riceve api/pong)
POST /mqtt/publish    { topic, message }
```

### SOAP (3003)
```
GET  /health
POST /soap            (endpoint SOAP)
GET  /soap?wsdl       (WSDL definition)

Operazioni SOAP:
  - GetUsers
  - GetUserById(id)
  - CreateUser(name, email, age)
  - HealthCheck
```

### GraphQL (3004)
```
GET/POST /graphql     (endpoint + GraphiQL IDE)
GET  /health

Query:
  { users { id name email age role } }
  { user(id: 1) { id name } }
  { products { id name price } }
  { stats { totalUsers totalProducts timestamp } }

Mutation:
  mutation { createUser(name:"X", email:"x@x.com") { success id } }
  mutation { createProduct(name:"Y", price:9.99) { success id } }
```

### Webhooks (3005)
```
GET  /health
POST /webhooks/subscribe        { url, events: ["user.created"], secret }
GET  /webhooks/subscriptions
DELETE /webhooks/subscriptions/:id
POST /webhooks/trigger          { event: "user.created", data: {} }
POST /webhooks/simulate/user-created
GET  /webhooks/logs
POST /webhooks/receiver         (endpoint test ricezione)
```

### gRPC Bridge (3006)
```
GET  /health
GET  /grpc/users
GET  /grpc/users/:id
POST /grpc/users       { name, email, age, role }
DELETE /grpc/users/:id
GET  /grpc/products
POST /grpc/products    { name, price, stock, category }

gRPC nativo: localhost:50051
  Service: UserService, ProductService
  Proto: proto/service.proto
```

## Uso diretto di api-benchmark

```js
const apiBenchmark = require('api-benchmark');

// Misura un singolo server
const service = { rest: 'http://localhost:3001/' };
const routes = { health: 'health' };

apiBenchmark.measure(service, routes, (err, results) => {
  console.log(results);
});

// Confronta tutti i server
const services = {
  REST:    'http://localhost:3001/',
  GraphQL: 'http://localhost:3002/',
  gRPC:    'http://localhost:3003/',
};

apiBenchmark.compare(services, { health: 'health' }, (err, results) => {
  // Genera HTML
  apiBenchmark.getHtml(results, (err, html) => {
    require('fs').writeFileSync('report.html', html);
  });
});
```

## Dipendenze

| Pacchetto | Uso |
|-----------|-----|
| `api-benchmark` | Runner benchmark |
| `express` | HTTP server (tutti) |
| `aedes` | Broker MQTT |
| `mqtt` | Client MQTT (bridge) |
| `soap` | Server/Client SOAP |
| `express-graphql` + `graphql` | Server GraphQL |
| `@grpc/grpc-js` + `@grpc/proto-loader` | Server/Client gRPC |
| `axios` | Delivery HTTP webhook |
| `body-parser` | Parsing request body |
