# API Benchmark Project

## Panoramica
Questo progetto è stato realizzato da un gruppo di **cinque studenti** con l’obiettivo di studiare e confrontare diverse **tecnologie di comunicazione tra API**.

L’idea principale del progetto è analizzare **funzionalità, architettura e prestazioni** di diverse tipologie di API attraverso implementazioni pratiche e test di benchmark.

Le tecnologie analizzate sono:

- **SOAP**
- **GraphQL**
- **gRPC**
- **Webhooks**
- **MQTT**

Attraverso questo progetto vogliamo comprendere il funzionamento di queste tecnologie, i loro principali **casi d’uso** e il loro comportamento in termini di **performance**.

---

## Obiettivi del progetto

Gli obiettivi principali sono:

- Studiare il **modello di comunicazione** e l’architettura delle diverse API
- Implementare un **esempio funzionante** per ogni tecnologia
- Realizzare un **sistema di benchmark** per confrontare le prestazioni
- Misurare diversi parametri, tra cui:
  - Tempo di risposta
  - Latenza
  - Throughput
  - Efficienza nel trasferimento dei dati
- Evidenziare **vantaggi e svantaggi** di ogni tecnologia

---

## Tecnologie analizzate

### SOAP
**SOAP (Simple Object Access Protocol)** è un protocollo utilizzato per lo scambio di informazioni strutturate tra servizi web.  
Utilizza messaggi basati su **XML** e generalmente comunica tramite **HTTP o SMTP**.

**Caratteristiche principali:**

- Forte standardizzazione  
- Messaggi basati su XML  
- Gestione degli errori integrata  
- Ampio utilizzo in sistemi enterprise  

---

### GraphQL
**GraphQL** è un linguaggio di query per API sviluppato da Facebook.  
Permette ai client di richiedere **esattamente i dati necessari**, evitando il problema dell’over-fetching o dell’under-fetching.

**Caratteristiche principali:**

- Query flessibili  
- Un unico endpoint  
- Schema fortemente tipizzato  
- Recupero dei dati più efficiente  

---

### gRPC
**gRPC** è un framework **Remote Procedure Call (RPC)** ad alte prestazioni sviluppato da Google.  
Utilizza **HTTP/2** come protocollo di trasporto e **Protocol Buffers** per la serializzazione dei dati.

**Caratteristiche principali:**

- Prestazioni elevate  
- Serializzazione binaria efficiente  
- Supporto allo streaming  
- Tipizzazione forte  

---

### Webhooks
I **Webhooks** permettono alle applicazioni di inviare dati automaticamente quando si verifica un determinato evento.

**Caratteristiche principali:**

- Comunicazione basata su eventi  
- Callback HTTP  
- Aggiornamenti in tempo reale  
- Molto utilizzati nelle integrazioni tra servizi  

---

### MQTT
**MQTT (Message Queuing Telemetry Transport)** è un protocollo leggero basato sul modello **publish/subscribe**, progettato per dispositivi con risorse limitate e reti con banda ridotta.

**Caratteristiche principali:**

- Protocollo molto leggero  
- Ideale per IoT  
- Comunicazione asincrona  
- Basato su broker  

---

## Struttura del progetto

Il repository è organizzato in diverse sezioni, ognuna dedicata a una specifica tecnologia API.

- Ogni cartella contiene l’implementazione dell’API.  
- La cartella **benchmark** contiene gli strumenti utilizzati per confrontare le prestazioni.

---

## Benchmark

Il sistema di benchmark è stato progettato per simulare diverse richieste e confrontare le API in termini di prestazioni.

I test includono:

- Test di **tempo di risposta**
- Test di **carico**
- Analisi della **latenza**
- Confronto del **consumo di banda**

I risultati dei benchmark verranno documentati nella sezione **docs** del progetto.

---

## Possibili applicazioni

Questo progetto può essere utile per:

- Studenti che vogliono comprendere le differenze tra diverse API
- Sviluppatori che vogliono scegliere la tecnologia più adatta
- Studi comparativi sulle prestazioni dei sistemi distribuiti

---

## Ruoli

- API SOAP: IQBAL UMAR
- API GRAPHQL: COLCOL JEROME
- API GRPC: GAMBA ALESSANDRO
- API WEBHOOKS: PREVITALI MATTIA
- API MQTT: ARDENTE VITTORIO FRANCESCO
