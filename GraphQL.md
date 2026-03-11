# GraphQL — Guida Tecnica Completa: Linguaggio, API e Casi Reali

---

## Indice

1. [Introduzione e Motivazioni](#1-introduzione-e-motivazioni)
2. [Storia e Standardizzazione](#2-storia-e-standardizzazione)
3. [Architettura del Sistema](#3-architettura-del-sistema)
4. [Il Sistema di Tipi](#4-il-sistema-di-tipi)
5. [Schema Definition Language (SDL)](#5-schema-definition-language-sdl)
6. [Query](#6-query)
7. [Mutazioni](#7-mutazioni)
8. [Subscription](#8-subscription)
9. [Resolver](#9-resolver)
10. [Validazione ed Esecuzione](#10-validazione-ed-esecuzione)
11. [Gestione degli Errori](#11-gestione-degli-errori)
12. [Autenticazione e Autorizzazione](#12-autenticazione-e-autorizzazione)
13. [Caching](#13-caching)
14. [DataLoader e il Problema N+1](#14-dataloader-e-il-problema-n1)
15. [GraphQL vs REST](#15-graphql-vs-rest)
16. [Dati in Tempo Reale](#16-dati-in-tempo-reale)
17. [API nei principali linguaggi](#17-api-nei-principali-linguaggi)
18. [Strumenti ed Ecosistema](#18-strumenti-ed-ecosistema)
19. [Pattern Architetturali](#19-pattern-architetturali)
20. [Federazione e Schema Stitching](#20-federazione-e-schema-stitching)
21. [Best Practices](#21-best-practices)
22. [Debugging e Troubleshooting](#22-debugging-e-troubleshooting)
23. [Glossario](#23-glossario)

---

## 1. Introduzione e Motivazioni

GraphQL è un linguaggio di interrogazione e manipolazione dei dati open-source per API, accompagnato da un runtime per l'esecuzione di query su dati esistenti. A differenza di REST, che espone risorse fisse attraverso endpoint multipli, GraphQL espone un singolo endpoint capace di rispondere a qualsiasi query il client voglia formulare.

Il client descrive esattamente la forma dei dati di cui ha bisogno, e il server risponde con esattamente quei dati — né più, né meno. Questo elimina i due problemi strutturali più comuni nelle API REST: **overfetching** (ricevere più dati del necessario) e **underfetching** (dover effettuare più chiamate per raccogliere dati correlati).

### Caratteristiche tecniche fondamentali

|Attributo|Valore|
|---|---|
|Tipologia|Linguaggio di query + Runtime|
|Endpoint|Singolo (tipicamente `/graphql`)|
|Protocollo di trasporto|HTTP (POST o GET), WebSocket (subscription)|
|Formato risposta|JSON|
|Metodo HTTP prevalente|POST|
|Codice di stato HTTP|Sempre 200 OK (anche in caso di errore)|
|Operazioni principali|Query, Mutation, Subscription|

### Contesto di utilizzo

GraphQL è la scelta corretta quando si verificano una o più delle seguenti condizioni:

- Il client ha bisogno di dati eterogenei che in REST richiederebbero più chiamate (underfetching)
- Diversi client (mobile, web, TV) consumano le stesse API ma con requisiti di dati differenti
- Lo schema dei dati evolve frequentemente e si vuole evitare il versioning degli endpoint
- Si vuole offrire ai client un'interfaccia auto-documentata e introspezionabile
- La larghezza di banda è un fattore critico (applicazioni mobile su reti lente)

---

## 2. Storia e Standardizzazione

Nel 2012, Facebook si trovò davanti a un problema concreto: le sue applicazioni mobile stavano crescendo e le API REST esistenti non erano adatte a soddisfare richieste di dati altamente variabili e gerarchici dal feed di notizie.

Lee Byron, Nick Schrock e Dan Schafer svilupparono internamente GraphQL come soluzione. Per tre anni rimase una tecnologia proprietaria Facebook, usata in produzione per miliardi di richieste al giorno.

Nel 2015 Facebook rese GraphQL pubblico, rilasciando sia le specifiche che un'implementazione di riferimento. Il 7 novembre 2018 la governance del progetto fu trasferita alla **GraphQL Foundation**, ospitata dalla Linux Foundation, segnando la transizione da progetto Facebook a standard di settore aperto.

```
2012   Creazione interna a Facebook da Lee Byron, Nick Schrock e Dan Schafer
2015   Rilascio pubblico delle specifiche e di graphql-js (implementazione di riferimento)
2016   Adozione da parte di GitHub, Twitter, Shopify, Yelp e altri
2018   Nascita della GraphQL Foundation (Linux Foundation)
2019   Pubblicazione della GraphQL specification 2018
2021   GraphQL specification: ottobre 2021
```

---

## 3. Architettura del Sistema

L'architettura GraphQL è composta da tre elementi principali: client, server GraphQL e sorgenti di dati.

```
+------------------+        +---------------------------+        +------------------+
|                  |        |                           |        |                  |
|     CLIENT       +------->+     SERVER GRAPHQL        +------->+   DATABASE SQL   |
|                  |        |                           |        +------------------+
|  Browser         |        |  Schema SDL               |        |                  |
|  App Mobile      |        |  Resolver Functions       +------->+   REST API       |
|  Altro Server    |        |  Validation Engine        |        +------------------+
|                  |        |  Execution Engine         |        |                  |
+------------------+        |                           +------->+   Microservizio  |
                            +---------------------------+        +------------------+
```

### Il Server GraphQL

Il server GraphQL non è un semplice proxy. Tra le sue responsabilità:

- Definire e validare lo schema SDL (la "fonte di verità" dell'API)
- Ricevere le query dal client via HTTP POST (o GET per query semplici)
- Validare la query ricevuta contro lo schema prima dell'esecuzione
- Orchestrare i resolver per raccogliere i dati dalle sorgenti appropriate
- Assemblare la risposta JSON nella forma richiesta dal client
- Gestire autenticazione, autorizzazione e rate limiting tramite middleware
- Esporre l'endpoint di introspezione (`__schema`, `__type`) per la documentazione automatica

### Client e Sorgenti di Dati

Un client GraphQL invia le proprie query descrivendo la struttura dei dati desiderata. Il server può aggregare dati da fonti eterogenee — database relazionali, NoSQL, REST API di terze parti, microservizi, file system — presentandoli al client come un grafo uniforme e coerente.

---

## 4. Il Sistema di Tipi

GraphQL è fortemente tipizzato. Ogni dato nel sistema deve avere un tipo definito nello schema. Questo rende l'API auto-documentata e permette la validazione statica delle query prima ancora dell'esecuzione.

### Tipi Scalari Built-in

|Tipo|Descrizione|
|---|---|
|`Int`|Intero a 32 bit con segno|
|`Float`|Numero in virgola mobile a doppia precisione|
|`String`|Sequenza di caratteri UTF-8|
|`Boolean`|`true` o `false`|
|`ID`|Identificatore univoco, serializzato come stringa|

### Tipi Personalizzati

È possibile definire scalari custom (es. `Date`, `URL`, `Email`) e tipi composti.

```graphql
# Tipo Oggetto
type Utente {
  id: ID!           # Il "!" indica non-nullable (obbligatorio)
  nome: String!
  email: String!
  eta: Int          # Nullable (opzionale)
  articoli: [Articolo!]!  # Lista non-nullable di elementi non-nullable
}

# Enum
enum Ruolo {
  ADMIN
  EDITORE
  LETTORE
}

# Input Type (usato nelle mutazioni)
input CreaUtenteInput {
  nome: String!
  email: String!
  ruolo: Ruolo
}

# Interface
interface Nodo {
  id: ID!
}

# Union
union RisultatoRicerca = Articolo | Utente | Tag
```

### Modificatori di Tipo

```
String      → nullable (può essere null)
String!     → non-nullable (non può mai essere null)
[String]    → lista nullable di elementi nullable
[String!]   → lista nullable di elementi non-nullable
[String!]!  → lista non-nullable di elementi non-nullable
```

---

## 5. Schema Definition Language (SDL)

Lo SDL è il linguaggio con cui si definisce lo schema GraphQL. È indipendente dal linguaggio di implementazione del server e costituisce il contratto tra client e server.

### Struttura dello Schema

Ogni schema GraphQL ha tre tipi radice speciali che definiscono i punti di ingresso delle operazioni:

```graphql
type Query {
  # Punto di ingresso per le letture (obbligatorio)
  utente(id: ID!): Utente
  articoli(limit: Int, offset: Int): [Articolo!]!
  ricerca(termine: String!): [RisultatoRicerca]
}

type Mutation {
  # Punto di ingresso per le scritture (opzionale)
  creaUtente(input: CreaUtenteInput!): Utente!
  aggiornaArticolo(id: ID!, titolo: String): Articolo
  eliminaUtente(id: ID!): Boolean!
}

type Subscription {
  # Punto di ingresso per gli aggiornamenti in tempo reale (opzionale)
  nuovoArticolo: Articolo!
  utenteAggiornato(id: ID!): Utente!
}
```

### Schema Completo di Esempio

```graphql
type Autore {
  id: ID!
  nome: String!
  email: String!
  libri: [Libro!]!
}

type Libro {
  id: ID!
  titolo: String!
  prezzo: Float
  anno: Int
  autore: Autore!
}

input CreaLibroInput {
  titolo: String!
  prezzo: Float
  anno: Int
  autoreId: ID!
}

type Query {
  tuttiAutori: [Autore!]!
  autore(id: ID!): Autore
  libroPerId(id: ID!): Libro
  libriPerAutore(autoreId: ID!): [Libro!]!
}

type Mutation {
  creaLibro(input: CreaLibroInput!): Libro!
  eliminaLibro(id: ID!): Boolean!
}
```

---

## 6. Query

Una query è la richiesta di lettura che il client invia al server GraphQL. Il client specifica esattamente i campi che vuole ricevere, e il server risponde con una struttura JSON che rispecchia la struttura della query.

### Sintassi di Base

```graphql
# Query con argomenti
query {
  autore(id: "1") {
    nome
    email
    libri {
      titolo
      prezzo
    }
  }
}
```

Risposta:

```json
{
  "data": {
    "autore": {
      "nome": "Italo Calvino",
      "email": "calvino@example.com",
      "libri": [
        { "titolo": "Il barone rampante", "prezzo": 12.50 },
        { "titolo": "Le città invisibili", "prezzo": 10.00 }
      ]
    }
  }
}
```

### Query con Variabili

Le variabili separano la struttura della query dai dati passati a runtime. È la pratica corretta per query dinamiche — non usare mai interpolazione di stringhe.

```graphql
# Definizione della query con variabili tipizzate
query GetAutore($id: ID!) {
  autore(id: $id) {
    nome
    email
    libri {
      titolo
    }
  }
}
```

```json
// Variabili passate separatamente nella richiesta HTTP
{
  "id": "1"
}
```

### Alias e Fragment

```graphql
# Alias: richiedere lo stesso campo con argomenti diversi
query DueAutori {
  primoAutore: autore(id: "1") { nome }
  secondoAutore: autore(id: "2") { nome }
}

# Fragment: riutilizzare selezioni di campi
fragment CampiLibro on Libro {
  titolo
  prezzo
  anno
}

query {
  libroPerId(id: "10") {
    ...CampiLibro
    autore { nome }
  }
}
```

### Inline Fragment e Union

```graphql
# Necessari per i tipi Union o Interface
query Ricerca {
  ricerca(termine: "Calvino") {
    ... on Autore {
      nome
      email
    }
    ... on Libro {
      titolo
      prezzo
    }
  }
}
```

---

## 7. Mutazioni

Le mutazioni sono le operazioni GraphQL che modificano lo stato del server: creazione, aggiornamento, eliminazione. Sono analoghe ai metodi POST, PUT, PATCH e DELETE delle API REST.

A differenza delle query (che possono essere eseguite in parallelo), le mutazioni vengono eseguite **in serie** — una dopo l'altra — per garantire la coerenza dei dati.

### Sintassi

```graphql
mutation CreaLibro($input: CreaLibroInput!) {
  creaLibro(input: $input) {
    id
    titolo
    prezzo
    autore {
      nome
    }
  }
}
```

```json
{
  "input": {
    "titolo": "Se una notte d'inverno un viaggiatore",
    "prezzo": 13.00,
    "anno": 1979,
    "autoreId": "1"
  }
}
```

Risposta:

```json
{
  "data": {
    "creaLibro": {
      "id": "42",
      "titolo": "Se una notte d'inverno un viaggiatore",
      "prezzo": 13.00,
      "autore": {
        "nome": "Italo Calvino"
      }
    }
  }
}
```

### Mutazioni Multiple in Serie

```graphql
mutation {
  primaOperazione: creaLibro(input: { titolo: "Libro A", autoreId: "1" }) {
    id
  }
  secondaOperazione: eliminaLibro(id: "99")
}
```

Le due mutazioni vengono eseguite nell'ordine dichiarato. `secondaOperazione` parte solo dopo che `primaOperazione` è completata.

---

## 8. Subscription

Le subscription permettono al client di ricevere aggiornamenti dal server in tempo reale ogni volta che si verifica un evento specifico. Mantengono una connessione persistente con il server, tipicamente implementata tramite WebSocket.

```
CLIENT                         SERVER
  |                               |
  |-- subscribe: nuovoArticolo -->|
  |                               |
  |<-- { data: Articolo A } ------|  (evento: articolo pubblicato)
  |                               |
  |<-- { data: Articolo B } ------|  (evento: altro articolo pubblicato)
  |                               |
  |-- unsubscribe --------------->|
```

### Definizione

```graphql
# Nello schema
type Subscription {
  nuovoArticolo: Articolo!
  commentoAggiunto(articoloId: ID!): Commento!
}
```

### Client (Apollo Client)

```javascript
const SUBSCRIPTION_NUOVO_ARTICOLO = gql`
  subscription {
    nuovoArticolo {
      id
      titolo
      autore {
        nome
      }
    }
  }
`;

// React Hook
const { data, loading } = useSubscription(SUBSCRIPTION_NUOVO_ARTICOLO);
```

### Server (con graphql-ws)

```javascript
import { useServer } from 'graphql-ws/lib/use/ws';
import { WebSocketServer } from 'ws';

const wsServer = new WebSocketServer({ port: 4001 });

useServer(
  {
    schema,
    onSubscribe: (ctx, msg) => {
      // Logica di autenticazione per le subscription
    },
  },
  wsServer
);
```

---

## 9. Resolver

I resolver sono le funzioni che implementano la logica di recupero dati per ogni campo dello schema. Ogni campo in ogni tipo può avere il proprio resolver. Se un resolver non è definito, GraphQL utilizza un resolver di default che restituisce la proprietà con lo stesso nome dall'oggetto padre.

### Firma del Resolver

```javascript
// Ogni resolver riceve quattro argomenti:
fieldName: (parent, args, context, info) => { ... }

// parent  → il valore restituito dal resolver padre (oggetto corrente)
// args    → gli argomenti passati al campo nella query
// context → oggetto condiviso tra tutti i resolver (db, utente autenticato, logger, ...)
// info    → informazioni sull'esecuzione (campo, percorso, schema, ...)
```

### Esempio Completo

```javascript
const resolvers = {
  // Resolver per il tipo radice Query
  Query: {
    tuttiAutori: async (parent, args, context) => {
      return await context.db.Autore.findMany();
    },

    autore: async (parent, args, context) => {
      const { id } = args;
      return await context.db.Autore.findById(id);
    },

    libroPerId: async (parent, args, context) => {
      return await context.db.Libro.findById(args.id);
    },
  },

  // Resolver per i campi del tipo Autore
  // Necessari per i campi che non sono dati scalari semplici
  Autore: {
    libri: async (parent, args, context) => {
      // parent è l'oggetto Autore già recuperato dal resolver Query
      return await context.db.Libro.findMany({
        where: { autoreId: parent.id }
      });
    },
  },

  // Resolver per il tipo Mutation
  Mutation: {
    creaLibro: async (parent, args, context) => {
      if (!context.utente) throw new Error('Non autenticato');
      const { input } = args;
      return await context.db.Libro.create(input);
    },

    eliminaLibro: async (parent, args, context) => {
      await context.db.Libro.delete(args.id);
      return true;
    },
  },

  // Resolver per le Subscription
  Subscription: {
    nuovoArticolo: {
      subscribe: (parent, args, context) => {
        return context.pubsub.asyncIterator(['NUOVO_ARTICOLO']);
      },
    },
  },
};
```

### Catena di Risoluzione

```
Query { autore(id: "1") { nome libri { titolo } } }

1. Query.autore("1") → restituisce oggetto { id: "1", nome: "Calvino", ... }
2. Autore.nome        → restituisce "Calvino" (scalare → fine)
3. Autore.libri       → restituisce array di oggetti Libro
4. Libro.titolo       → restituisce "Il barone rampante" (scalare → fine)
   Libro.titolo       → restituisce "Le città invisibili" (scalare → fine)
```

---

## 10. Validazione ed Esecuzione

Prima di eseguire qualsiasi query, il server GraphQL la valida staticamente contro lo schema. Solo le query valide vengono eseguite.

### Pipeline di Esecuzione

```
RICHIESTA HTTP POST /graphql
           │
           ▼
┌─────────────────────┐
│   Parsing           │  La stringa di query viene analizzata in un AST
│   (AST)             │  (Abstract Syntax Tree)
└─────────┬───────────┘
           ▼
┌─────────────────────┐
│   Validazione       │  L'AST viene confrontato con lo schema.
│                     │  Campi inesistenti, tipi errati, argomenti
│                     │  mancanti → errore restituito senza esecuzione
└─────────┬───────────┘
           ▼
┌─────────────────────┐
│   Esecuzione        │  I resolver vengono chiamati in ordine.
│                     │  I campi scalari terminano la catena.
│                     │  I campi oggetto avviano resolver figli.
└─────────┬───────────┘
           ▼
┌─────────────────────┐
│   Serializzazione   │  Il risultato viene serializzato in JSON
│   JSON              │  e restituito nella risposta HTTP 200 OK
└─────────────────────┘
```

### Introspezione

GraphQL espone nativamente l'introspezione: i client possono interrogare lo schema stesso.

```graphql
# Elenco di tutti i tipi nello schema
query {
  __schema {
    types {
      name
      kind
    }
  }
}

# Dettagli di un tipo specifico
query {
  __type(name: "Autore") {
    fields {
      name
      type { name kind }
    }
  }
}
```

L'introspezione è la base su cui funzionano strumenti come GraphiQL e Apollo Studio. In produzione è buona pratica **disabilitarla** per evitare di esporre la struttura interna dell'API.

---

## 11. Gestione degli Errori

GraphQL gestisce gli errori in modo radicalmente diverso da REST. Qualsiasi risposta, con o senza errori, restituisce **HTTP 200 OK**. Gli errori vengono comunicati nel corpo JSON della risposta, nel campo `errors`.

### Struttura della Risposta

```json
{
  "data": {
    "autore": {
      "nome": "Calvino",
      "libri": null
    }
  },
  "errors": [
    {
      "message": "Errore nel recupero dei libri",
      "locations": [{ "line": 4, "column": 5 }],
      "path": ["autore", "libri"],
      "extensions": {
        "code": "INTERNAL_SERVER_ERROR",
        "exception": { "stacktrace": ["..."] }
      }
    }
  ]
}
```

### Risposta Parziale

Un aspetto chiave di GraphQL è la possibilità di **risposta parziale**: se un resolver fallisce su un campo nullable, GraphQL restituisce `null` per quel campo, include l'errore nel campo `errors`, ma continua a risolvere gli altri campi della query. Il client riceve i dati parzialmente disponibili.

```
autore.nome   → "Calvino"  ✓ (risolto con successo)
autore.libri  → null       ✗ (errore → campo null, errore incluso in errors[])
```

Se il campo che fallisce è **non-nullable** (`!`), la nullità si propaga verso l'alto fino al primo antenato nullable.

### Errori Personalizzati

```javascript
// Con Apollo Server
import { GraphQLError } from 'graphql';

const resolvers = {
  Mutation: {
    creaLibro: async (parent, { input }, context) => {
      if (!context.utente) {
        throw new GraphQLError('Non autenticato', {
          extensions: {
            code: 'UNAUTHENTICATED',
            http: { status: 401 },
          },
        });
      }
      // ...
    },
  },
};
```

### Codici di Errore Convenzionali

|Codice|Significato|
|---|---|
|`UNAUTHENTICATED`|Token mancante o non valido|
|`FORBIDDEN`|Autenticato ma non autorizzato|
|`BAD_USER_INPUT`|Argomenti non validi nella query|
|`NOT_FOUND`|Risorsa non trovata|
|`INTERNAL_SERVER_ERROR`|Errore generico del server|
|`GRAPHQL_VALIDATION_FAILED`|Query non valida rispetto allo schema|

---

## 12. Autenticazione e Autorizzazione

GraphQL non impone un meccanismo di autenticazione specifico. La pratica standard è passare un token JWT nell'header HTTP `Authorization` e decodificarlo nel middleware prima che i resolver vengano chiamati.

### Autenticazione via Context

```javascript
import jwt from 'jsonwebtoken';

const server = new ApolloServer({
  schema,
  context: async ({ req }) => {
    // Estratto ad ogni richiesta
    const token = req.headers.authorization?.replace('Bearer ', '');
    let utente = null;

    if (token) {
      try {
        utente = jwt.verify(token, process.env.JWT_SECRET);
      } catch (err) {
        // Token non valido: context.utente rimane null
      }
    }

    return {
      db,       // Accesso al database
      utente,   // Utente autenticato (o null)
      logger,   // Logger
    };
  },
});
```

### Autorizzazione nei Resolver

```javascript
const resolvers = {
  Mutation: {
    eliminaUtente: async (parent, { id }, context) => {
      // 1. Autenticazione
      if (!context.utente) {
        throw new GraphQLError('Non autenticato', {
          extensions: { code: 'UNAUTHENTICATED' }
        });
      }

      // 2. Autorizzazione
      if (context.utente.ruolo !== 'ADMIN') {
        throw new GraphQLError('Permessi insufficienti', {
          extensions: { code: 'FORBIDDEN' }
        });
      }

      return await context.db.Utente.delete(id);
    },
  },
};
```

### Direttive di Autorizzazione

Per evitare di ripetere i controlli in ogni resolver, si possono usare direttive personalizzate.

```graphql
directive @auth(ruolo: Ruolo) on FIELD_DEFINITION

type Mutation {
  eliminaUtente(id: ID!): Boolean! @auth(ruolo: ADMIN)
  creaArticolo(input: CreaArticoloInput!): Articolo! @auth(ruolo: EDITORE)
}
```

---

## 13. Caching

Il caching in GraphQL è strutturalmente più complesso rispetto a REST. In REST, ogni endpoint ha un URL univoco facilmente cachabile con HTTP standard. In GraphQL, tutte le richieste usano lo stesso endpoint POST, rendendo inapplicabile il caching HTTP tradizionale.

### Strategie di Caching

**1. Caching a livello di field (in-memory)**

```javascript
import DataLoader from 'dataloader';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 60 }); // TTL: 60 secondi

const resolvers = {
  Query: {
    autore: async (parent, { id }, context) => {
      const cacheKey = `autore:${id}`;
      const cached = cache.get(cacheKey);
      if (cached) return cached;

      const autore = await context.db.Autore.findById(id);
      cache.set(cacheKey, autore);
      return autore;
    },
  },
};
```

**2. Persisted Queries**

I client inviano un hash della query invece della query testuale. Il server risolve l'hash nella query completa dalla propria cache. Questo permette il caching HTTP su richieste GET e riduce il traffico di rete.

```
# Richiesta con query persistente
GET /graphql?operationId=abc123&variables={"id":"1"}

# Il server mappa "abc123" → query completa precedentemente registrata
```

**3. Response Caching (Redis)**

```javascript
import { responseCachePlugin } from '@apollo/server-plugin-response-cache';
import { createClient } from 'redis';

const redisClient = createClient({ url: process.env.REDIS_URL });

const server = new ApolloServer({
  schema,
  plugins: [
    responseCachePlugin({
      cache: new RedisCacheAdapter(redisClient),
    }),
  ],
});
```

**4. CDN Caching con GET**

Per query di sola lettura frequenti, si possono inviare come GET con la query nell'URL. I CDN possono poi cachare queste risposte.

```
GET /graphql?query={articoli{titolo}}&operationName=GetArticoli
```

---

## 14. DataLoader e il Problema N+1

Il problema N+1 è la principale trappola delle prestazioni in GraphQL. Si verifica quando un resolver esegue una query separata al database per ogni elemento di una lista.

### Il Problema

```
Query: { tuttiAutori { nome libri { titolo } } }

Esecuzione naïve:
  1 query  → SELECT * FROM autori              → 3 autori
  3 query  → SELECT * FROM libri WHERE autoreId = 1
             SELECT * FROM libri WHERE autoreId = 2
             SELECT * FROM libri WHERE autoreId = 3
  ─────────────────────────────────────────────────
  Totale: 1 + N query (con N = numero di autori)
```

### La Soluzione: DataLoader

DataLoader raggruppa (batch) le chiamate singole in un'unica query, usando un meccanismo di coalescing sui tick dell'event loop.

```javascript
import DataLoader from 'dataloader';

// Funzione batch: riceve un array di ID e restituisce un array di risultati
const creaLibriLoader = (db) => new DataLoader(async (autoreIds) => {
  // Una sola query per tutti gli autori
  const libri = await db.Libro.findMany({
    where: { autoreId: { in: autoreIds } }
  });

  // DataLoader richiede che i risultati siano nell'STESSO ordine degli ID
  return autoreIds.map(id => libri.filter(l => l.autoreId === id));
});

// Aggiunta al context (DEVE essere creato per ogni richiesta, non globalmente)
context: async () => ({
  db,
  loaders: {
    libriPerAutore: creaLibriLoader(db),
  }
})

// Utilizzo nel resolver
const resolvers = {
  Autore: {
    libri: (parent, args, context) => {
      // DataLoader raggruppa automaticamente tutte le chiamate
      return context.loaders.libriPerAutore.load(parent.id);
    },
  },
};
```

```
Esecuzione con DataLoader:
  1 query  → SELECT * FROM autori
  1 query  → SELECT * FROM libri WHERE autoreId IN (1, 2, 3)
  ─────────────────────────────────────────────────
  Totale: 2 query (indipendente da N)
```

---

## 15. GraphQL vs REST

### Tabella Comparativa

|Caratteristica|REST|GraphQL|
|---|---|---|
|Endpoint|Multipli (uno per risorsa)|Singolo (`/graphql`)|
|Recupero dati|Fisso (struttura definita dal server)|Flessibile (struttura definita dal client)|
|Overfetching|Comune|Eliminato|
|Underfetching|Comune (richiede più chiamate)|Eliminato|
|Versioning|Necessario (v1, v2, ...)|Non necessario (schema evolutivo)|
|Caching HTTP|Nativo (GET cacheabile)|Complesso (POST non cacheabile)|
|Tempo reale|Non nativo (richiede WebSocket/SSE separati)|Nativo (subscription)|
|Documentazione|Manuale o con OpenAPI/Swagger|Automatica (introspezione)|
|Gestione errori|Codici HTTP standard|Sempre 200, errori nel body|
|Curva di apprendimento|Bassa|Media|
|Tooling|Maturo e consolidato|Crescente, strumenti eccellenti|

### Quando Scegliere REST

- API pubblica consumata da clienti ignoti (REST è più facile da cachare con CDN)
- Operazioni semplici su singole risorse (CRUD diretto)
- Team senza esperienza GraphQL e deadline ravvicinate
- Upload di file (GraphQL richiede soluzioni aggiuntive come multipart)
- Quando il caching HTTP di livello CDN è un requisito critico

### Quando Scegliere GraphQL

- Diversi client (mobile, web, partner) con necessità di dati diverse
- Dati altamente relazionali e gerarchici
- Prodotto in rapida evoluzione con schema che cambia frequentemente
- Necessità di aggregare dati da sorgenti eterogenee (BFF pattern)
- Team front-end autonomo che vuole evolvere le query senza coinvolgere il back-end

---

## 16. Dati in Tempo Reale

GraphQL supporta tre modalità per ricevere aggiornamenti in tempo reale:

### 1. Subscription (WebSocket)

Il meccanismo nativo di GraphQL per dati in tempo reale. Il client stabilisce una connessione WebSocket persistente e il server invia eventi quando si verificano.

```
Uso ideale:
- Chat e messaggistica in tempo reale
- Feed di notifiche
- Dashboard con aggiornamenti live
- Aggiornamenti di stato di operazioni lunghe
```

```javascript
// Server: pubblicare un evento
context.pubsub.publish('NUOVO_ARTICOLO', {
  nuovoArticolo: articoloCreato
});

// La subscription definita nel resolver consegnerà l'evento
// a tutti i client iscritti a "nuovoArticolo"
```

### 2. Polling (lato client)

Non è una funzionalità GraphQL nativa, ma una strategia client-side: il client re-esegue la query a intervalli regolari.

```javascript
// Apollo Client: polling ogni 5 secondi
const { data } = useQuery(GET_ARTICOLI, {
  pollInterval: 5000,
});
```

```
Pro:   Semplice, compatibile con qualsiasi server GraphQL
Contro: Inefficiente (richieste anche se non ci sono aggiornamenti)
Uso:   Aggiornamenti poco frequenti dove la latenza non è critica
```

### 3. Live Queries (sperimentale)

Alcune implementazioni (es. Grafbase, The Guild) supportano "live queries", dove il server monitora automaticamente i cambiamenti ai dati e re-esegue la query, inviando l'aggiornamento al client senza che questi debba definire una subscription esplicita.

---

## 17. API nei principali linguaggi

### JavaScript / Node.js (Apollo Server)

```javascript
import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { gql } from 'graphql-tag';

const typeDefs = gql`
  type Libro { id: ID!, titolo: String! }
  type Query { libri: [Libro!]! }
`;

const resolvers = {
  Query: {
    libri: () => [{ id: '1', titolo: 'Il nome della rosa' }],
  },
};

const server = new ApolloServer({ typeDefs, resolvers });
const { url } = await startStandaloneServer(server, { listen: { port: 4000 } });
console.log(`Server avviato su ${url}`);
```

### Python (Strawberry)

```python
import strawberry
from typing import List

@strawberry.type
class Libro:
    id: str
    titolo: str

@strawberry.type
class Query:
    @strawberry.field
    def libri(self) -> List[Libro]:
        return [Libro(id="1", titolo="Il nome della rosa")]

schema = strawberry.Schema(query=Query)

# Con FastAPI
from strawberry.fastapi import GraphQLRouter
from fastapi import FastAPI

app = FastAPI()
graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/graphql")
```

### Go (gqlgen)

```go
// schema.graphqls
// type Query { libri: [Libro!]! }
// type Libro { id: ID!, titolo: String! }

// resolver.go
func (r *queryResolver) Libri(ctx context.Context) ([]*model.Libro, error) {
    return []*model.Libro{
        {ID: "1", Titolo: "Il nome della rosa"},
    }, nil
}
```

### Java / Spring Boot (GraphQL for Spring)

```java
@Controller
public class LibroController {

    @QueryMapping
    public List<Libro> libri() {
        return libroRepository.findAll();
    }

    @MutationMapping
    public Libro creaLibro(@Argument CreaLibroInput input) {
        return libroRepository.save(new Libro(input));
    }
}
```

### Client: JavaScript (Apollo Client con React)

```javascript
import { ApolloClient, InMemoryCache, gql, useQuery } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
});

const GET_LIBRI = gql`
  query GetLibri {
    libri {
      id
      titolo
    }
  }
`;

function ListaLibri() {
  const { loading, error, data } = useQuery(GET_LIBRI);
  if (loading) return <p>Caricamento...</p>;
  if (error) return <p>Errore: {error.message}</p>;
  return <ul>{data.libri.map(l => <li key={l.id}>{l.titolo}</li>)}</ul>;
}
```

---

## 18. Strumenti ed Ecosistema

### IDE e Strumenti di Sviluppo

|Strumento|Descrizione|
|---|---|
|**GraphiQL**|IDE browser-based integrato nella maggior parte dei server. Autocompletamento, documentazione inline, esecuzione query.|
|**Apollo Studio**|Piattaforma cloud per esplorare, testare e monitorare le API GraphQL. Schema registry, metrics, alerting.|
|**GraphQL Playground**|Alternativa a GraphiQL, ora integrato in Apollo Studio.|
|**Altair GraphQL Client**|Client desktop/browser per testare API GraphQL. Supporta variabili, headers, subscription.|
|**Insomnia**|Client REST/GraphQL. Utile per test con autenticazione e ambienti multipli.|

### Librerie Server

|Linguaggio|Libreria|Note|
|---|---|---|
|Node.js|Apollo Server|Più diffuso, ottimo ecosistema|
|Node.js|graphql-yoga|Leggero, standard Fetch API|
|Node.js|Mercurius|Ottimizzato per Fastify|
|Python|Strawberry|Basato su type hints, moderno|
|Python|Ariadne|Schema-first|
|Go|gqlgen|Code generation, type-safe|
|Java|Spring for GraphQL|Integrazione nativa Spring Boot|
|Ruby|graphql-ruby|Maturo e stabile|
|PHP|Lighthouse|Laravel-first|
|Rust|async-graphql|Performante, type-safe|

### Librerie Client

|Piattaforma|Libreria|Note|
|---|---|---|
|React / JS|Apollo Client|Più completo, caching normalizzato|
|React / JS|urql|Leggero, estensibile|
|React / JS|TanStack Query + graphql-request|Minimalista|
|iOS (Swift)|Apollo iOS|Code generation|
|Android (Kotlin)|Apollo Kotlin|Code generation|
|Flutter|Ferry, graphql_flutter||

### Generazione del Codice

```bash
# graphql-codegen: genera tipi TypeScript dalle query
npm install -g @graphql-codegen/cli

# codegen.ts
const config = {
  schema: 'http://localhost:4000/graphql',
  documents: 'src/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typescript-react-apollo'],
    },
  },
};

# Esecuzione
graphql-codegen --config codegen.ts
```

---

## 19. Pattern Architetturali

### Backend for Frontend (BFF)

Un server GraphQL funge da layer di aggregazione specifico per un frontend, orchestrando chiamate a microservizi REST o gRPC sottostanti.

```
+----------+     +------------------+     +--------------+
|          |     |                  |     | Microservizio|
|  App     +---->+  GraphQL BFF     +---->+ Utenti       |
|  Mobile  |     |                  |     +--------------+
|          |     | Aggrega e        |     | Microservizio|
+----------+     | trasforma i dati +---->+ Ordini       |
                 | per il client    |     +--------------+
                 |                  |     | Microservizio|
                 +------------------+     | Prodotti     |
                                          +--------------+
```

### Schema-First vs Code-First

**Schema-First**: si scrive prima lo SDL, poi si implementano i resolver.

```
SDL (schema.graphql) → Generazione del codice → Implementazione resolver
```

Vantaggi: contratto chiaro e condiviso tra team front-end e back-end fin dall'inizio.

**Code-First**: si definisce lo schema programmaticamente attraverso il codice.

```
Codice (classi/decoratori) → Schema SDL generato automaticamente
```

Vantaggi: un'unica fonte di verità, refactoring più semplice, type-safety nativa (es. Strawberry, Pothos, TypeGraphQL).

---

## 20. Federazione e Schema Stitching

In architetture con molti microservizi, ogni servizio può esporre il proprio sotto-schema GraphQL. Federation e Schema Stitching sono due approcci per unificarli in un unico grafo globale.

### Apollo Federation

Il gateway compone automaticamente gli schema dei servizi sottostanti in un unico grafo distribuito. Ogni servizio è autonomo e deployabile indipendentemente.

```
+-----------------+
|   Apollo Router  |  ← Unico endpoint per i client
|   (Gateway)      |
+--------+--------+
         |
   ┌─────┴──────┐
   ▼            ▼
+-------+  +--------+
|Servizio|  |Servizio|
|Utenti  |  |Ordini  |
+-------+  +--------+

# servizio-utenti
type User @key(fields: "id") {
  id: ID!
  name: String!
}

# servizio-ordini
extend type User @key(fields: "id") {
  id: ID! @external
  orders: [Order!]!
}
```

Il gateway risolve automaticamente le relazioni tra tipi definiti in servizi diversi.

---

## 21. Best Practices

### Design dello Schema

Progettare lo schema pensando al client, non al database. Lo schema è il contratto pubblico dell'API e dovrebbe rispecchiare i domini di business, non la struttura delle tabelle.

```graphql
# ❌ Schema database-centrico
type Query {
  getUserById(user_id: Int!): UserRecord
}

# ✅ Schema client-centrico
type Query {
  utente(id: ID!): Utente
}
```

Usare **Input Types** per le mutazioni: permette di aggiungere campi in futuro senza rompere le query esistenti.

```graphql
# ❌ Argomenti flat (difficile da evolvere)
mutation { creaLibro(titolo: String!, autoreId: ID!): Libro! }

# ✅ Input type (evolutivo)
mutation { creaLibro(input: CreaLibroInput!): Libro! }
```

Preferire campi **non-nullable** (`!`) dove possibile: comunica chiaramente le garanzie dell'API e semplifica il codice client.

### Paginazione

Non esporre mai liste illimitate. Usare paginazione cursor-based (Relay spec) per liste che possono crescere.

```graphql
# ❌ Lista potenzialmente illimitata
type Query {
  articoli: [Articolo!]!
}

# ✅ Paginazione con cursor (Relay Spec)
type ArticoloConnection {
  edges: [ArticoloEdge!]!
  pageInfo: PageInfo!
}

type ArticoloEdge {
  node: Articolo!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  endCursor: String
}

type Query {
  articoli(first: Int, after: String): ArticoloConnection!
}
```

### Sicurezza e Limitazione

```javascript
// 1. Limitare la profondità delle query per prevenire query recursive infinite
import depthLimit from 'graphql-depth-limit';

const server = new ApolloServer({
  validationRules: [depthLimit(7)],
});

// 2. Limitare la complessità delle query
import { createComplexityLimitRule } from 'graphql-validation-complexity';

const server = new ApolloServer({
  validationRules: [createComplexityLimitRule(1000)],
});

// 3. Disabilitare l'introspezione in produzione
const server = new ApolloServer({
  introspection: process.env.NODE_ENV !== 'production',
});
```

### Naming Conventions

```
Tipi:      PascalCase            → Utente, LibroInput, TipoRuolo
Campi:     camelCase             → nomeCompleto, dataCreazione
Enum:      SCREAMING_SNAKE_CASE  → ADMIN, SUPER_ADMIN
Query:     camelCase, nome       → utente, tuttiGliArticoli
Mutation:  camelCase, verbo      → creaUtente, aggiornaLibro, eliminaTag
```

---

## 22. Debugging e Troubleshooting

### Strumenti da riga di comando

```bash
# Eseguire una query con curl
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"query": "{ tuttiAutori { nome } }"}'

# Con variabili
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query GetAutore($id: ID!) { autore(id: $id) { nome } }",
    "variables": { "id": "1" }
  }'

# Introspezione: ottenere tutti i tipi dello schema
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __schema { types { name kind } } }"}'
```

### Problemi Comuni e Soluzioni

**La query restituisce `null` per un campo**

```
Cause probabili:
1. Il resolver restituisce undefined invece di null.
   Verificare che il resolver ritorni sempre un valore o null esplicito.

2. Il campo nella risposta del database ha un nome diverso da quello nello schema.
   Aggiungere un resolver esplicito per mappare il campo correttamente.

3. Il DataLoader non sta trovando la chiave corretta.
   Verificare che la funzione batch restituisca i risultati nello stesso ordine
   degli ID ricevuti in input.
```

**Errore: "Cannot query field X on type Y"**

```
Cause probabili:
1. Il campo non esiste nello schema. Verificare l'SDL.

2. Il campo esiste su un tipo diverso.
   Usare l'introspezione per verificare la struttura:
   query { __type(name: "NomeTipo") { fields { name } } }

3. Si sta usando un fragment su un tipo sbagliato.
   Verificare che "on TipoCorretto" corrisponda al tipo dell'oggetto padre.
```

**Errore N+1 in produzione (query lente)**

```
Diagnosi:
1. Abilitare il logging delle query al database e cercare pattern ripetitivi.
2. Usare Apollo Studio Trace per visualizzare il tempo per resolver.
3. Contare le query: se i count crescono linearmente con i dati, è N+1.

Soluzione: implementare DataLoader per il campo problematico.
```

**Mutation non autenticata: errore 200 ma dati null**

```
GraphQL ritorna sempre 200. Il rifiuto per autenticazione
arriva nel campo errors[].extensions.code === "UNAUTHENTICATED".

Il client deve sempre verificare il campo errors[] oltre ai dati.
```

### Logging e Tracing

```javascript
// Apollo Server: plugin per logging dettagliato
const server = new ApolloServer({
  schema,
  plugins: [
    {
      async requestDidStart(requestContext) {
        console.log('Query:', requestContext.request.query);
        return {
          async didEncounterErrors(ctx) {
            console.error('Errori:', ctx.errors);
          },
          async willSendResponse(ctx) {
            console.log('Risposta inviata in:', Date.now() - ctx.request.http.headers.get('x-start-time'), 'ms');
          },
        };
      },
    },
  ],
});
```

---

## 23. Glossario

|Termine|Definizione|
|---|---|
|**AST**|Abstract Syntax Tree. Rappresentazione ad albero della struttura di una query GraphQL, prodotta dal parser prima della validazione.|
|**Alias**|Permette di rinominare un campo nella risposta GraphQL, o di richiedere lo stesso campo più volte con argomenti diversi.|
|**Context**|Oggetto condiviso tra tutti i resolver di una singola richiesta. Usato per passare il database, l'utente autenticato, i DataLoader, ecc.|
|**DataLoader**|Libreria che raggruppa (batch) e deduplica le richieste al database nei resolver, risolvendo il problema N+1.|
|**Direttiva**|Annotazione applicabile a elementi SDL o query (es. `@deprecated`, `@auth`, `@skip`, `@include`).|
|**Federation**|Architettura Apollo per comporre più sotto-schema GraphQL di microservizi diversi in un unico grafo unificato.|
|**Fragment**|Blocco riutilizzabile di selezione di campi, identificabile con un nome e applicabile a un tipo specifico.|
|**Inline Fragment**|Fragment anonimo usato nelle query per selezionare campi condizionalmente su tipi concreti di un'interfaccia o unione.|
|**Input Type**|Tipo speciale usato esclusivamente come argomento nelle mutation e query, non restituibile come output.|
|**Introspezione**|Capacità di GraphQL di rispondere a query sullo schema stesso tramite i campi `__schema` e `__type`.|
|**Mutation**|Operazione GraphQL che crea, modifica o elimina dati sul server. Eseguita in serie.|
|**N+1**|Problema di prestazioni in cui si eseguono N+1 query al database invece di 1: una per la lista, poi una per ogni elemento.|
|**Non-nullable**|Campo marcato con `!` che non può mai essere null. Se il resolver fallisce, la nullità si propaga verso l'alto.|
|**Overfetching**|Ricezione di più dati del necessario da un'API. Problema tipico di REST, eliminato da GraphQL.|
|**Persisted Query**|Query pre-registrata sul server identificata da un hash. Permette caching HTTP e riduce il payload delle richieste.|
|**Query**|Operazione GraphQL di sola lettura. I campi di una query sono eseguibili in parallelo.|
|**Resolver**|Funzione che restituisce il valore per un campo specifico dello schema. Il cuore dell'implementazione GraphQL.|
|**SDL**|Schema Definition Language. Il linguaggio dichiarativo con cui si definisce lo schema GraphQL, indipendente dal linguaggio del server.|
|**Schema**|Il contratto dell'API GraphQL: definisce tutti i tipi, i campi, le relazioni e le operazioni disponibili.|
|**Subscription**|Operazione GraphQL per ricevere aggiornamenti in tempo reale dal server tramite connessione persistente (tipicamente WebSocket).|
|**Type System**|Sistema di tipi forte di GraphQL: ogni campo ha un tipo dichiarato, abilitando validazione statica e introspezione.|
|**Underfetching**|Necessità di effettuare più chiamate API per raccogliere tutti i dati necessari. Problema tipico di REST, eliminato da GraphQL.|
|**Union**|Tipo GraphQL che rappresenta un valore che può essere uno di diversi tipi oggetto distinti (senza campi in comune).|
|**Variable**|Parametro dinamico passato separatamente alla query a runtime, invece di essere interpolato nella stringa.|

---

## Riferimenti e letture consigliate

- GraphQL Specification — graphql.github.io/graphql-spec
- Apollo Server Documentation — apollographql.com/docs/apollo-server
- The Guild — Librerie e articoli tecnici (the-guild.dev)
- graphql-yoga Documentation — the-guild.dev/graphql/yoga-server
- DataLoader — github.com/graphql/dataloader
- Apollo Client Documentation — apollographql.com/docs/react
- Strawberry GraphQL (Python) — strawberry.rocks
- gqlgen (Go) — gqlgen.com
- Principi di design GraphQL — graphql.github.io/learn/best-practices

---

_Versione 1.0 — Marzo 2026_