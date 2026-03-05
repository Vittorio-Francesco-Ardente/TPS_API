# MQTT — Guida Tecnica Completa: Protocollo, API e Casi Reali

---

## Indice

1. [Introduzione e Motivazioni](#1-introduzione-e-motivazioni)
2. [Storia e Standardizzazione](#2-storia-e-standardizzazione)
3. [Architettura del Sistema](#3-architettura-del-sistema)
4. [Il Modello Publish/Subscribe](#4-il-modello-publishsubscribe)
5. [Struttura dei Topic](#5-struttura-dei-topic)
6. [Quality of Service](#6-quality-of-service)
7. [Formato dei Pacchetti](#7-formato-dei-pacchetti)
8. [Gestione della Connessione](#8-gestione-della-connessione)
9. [Session Persistence](#9-session-persistence)
10. [Retained Messages](#10-retained-messages)
11. [Last Will and Testament](#11-last-will-and-testament)
12. [Keep Alive](#12-keep-alive)
13. [Sicurezza](#13-sicurezza)
14. [MQTT 5.0](#14-mqtt-50)
15. [Broker MQTT](#15-broker-mqtt)
16. [API nei principali linguaggi](#16-api-nei-principali-linguaggi)
17. [Pattern Architetturali](#17-pattern-architetturali)
18. [MQTT vs REST](#18-mqtt-vs-rest)
19. [MQTT over WebSocket](#19-mqtt-over-websocket)
20. [Casi Reali](#20-casi-reali)
21. [Best Practices](#21-best-practices)
22. [Debugging e Troubleshooting](#22-debugging-e-troubleshooting)
23. [Glossario](#23-glossario)

---

## 1. Introduzione e Motivazioni

MQTT (Message Queuing Telemetry Transport) è un protocollo di messaggistica leggero, basato sul paradigma publish/subscribe, progettato per operare in condizioni di rete degradate e su dispositivi con risorse computazionali limitate.

Il protocollo si posiziona come soluzione di elezione per l'Internet of Things, ma la sua efficienza lo ha reso adottato in contesti molto più ampi: sistemi SCADA industriali, piattaforme di messaggistica mobile, infrastrutture di monitoring e, più recentemente, architetture edge computing.

### Caratteristiche tecniche fondamentali

| Attributo | Valore |
|---|---|
| Protocollo di trasporto | TCP/IP |
| Porta standard | 1883 |
| Porta TLS | 8883 |
| Overhead minimo | 2 byte (fixed header) |
| Paradigma | Publish / Subscribe |
| Livelli QoS | 0, 1, 2 |
| Versioni attive | 3.1.1 (ISO/IEC 20922), 5.0 |

### Contesto di utilizzo

MQTT è la scelta corretta quando si verificano una o più delle seguenti condizioni:

- La larghezza di banda disponibile è fortemente limitata (reti GPRS, satellitari, LPWAN)
- I dispositivi operano con alimentazione a batteria e ogni byte trasmesso ha un costo energetico
- La rete è soggetta a interruzioni frequenti e la riconnessione deve essere trasparente
- Un numero elevato di sorgenti dati deve convergere verso uno o più consumatori (fan-in)
- La latenza di consegna deve essere minimale e stabile

---

## 2. Storia e Standardizzazione

Nel 1999, Andy Stanford-Clark (IBM) e Arlen Nipper (Cirrus Link Solutions) si trovarono davanti a un problema concreto: monitorare in tempo reale una rete di oleodotti attraverso il deserto arabico. La connessione avveniva via satellite — costosa, a bassa banda, inaffidabile. I protocolli esistenti erano troppo verbosi e non tolleravano le interruzioni di segnale.

Nacque così MQTT: un protocollo pensato per l'estremo, per sopravvivere dove altri fallivano.

Per un decennio rimase una specifica proprietaria IBM. Nel 2010 venne rilasciato come open source. Nel 2013 OASIS aprì il processo di standardizzazione, che si concluse nel 2014 con MQTT 3.1.1, poi adottato come standard ISO/IEC 20922. Nel 2019 OASIS pubblicò MQTT 5.0, con importanti aggiunte per scenari enterprise e cloud-native.

```
1999   Creazione da parte di Stanford-Clark e Nipper (IBM/Eurotech)
2010   Rilascio open source
2013   Inizio processo di standardizzazione OASIS
2014   MQTT 3.1.1 — Standard ISO/IEC 20922
2019   MQTT 5.0 — Funzionalità avanzate per scenari enterprise
```

---

## 3. Architettura del Sistema

L'architettura MQTT è composta da tre ruoli distinti: publisher, broker e subscriber.

```
+------------------+        +------------------+        +------------------+
|                  |        |                  |        |                  |
|    PUBLISHER     +------->+      BROKER      +------->+   SUBSCRIBER     |
|                  |        |                  |        |                  |
|  Sensore IoT     |        |  Mosquitto       |        |  Dashboard       |
|  Gateway PLC     |        |  HiveMQ          |        |  Sistema SCADA   |
|  Microcontroller |        |  EMQX            |        |  Applicazione    |
|                  |        |  AWS IoT Core    |        |  Mobile          |
+------------------+        +------------------+        +------------------+
```

### Il Broker

Il broker è il componente centrale e non è un semplice relay. Tra le sue responsabilità:

- Autenticazione e autorizzazione dei client in ingresso
- Routing dei messaggi verso i subscriber appropriati in base ai topic
- Gestione delle sessioni persistenti e dei messaggi in coda (QoS 1 e 2)
- Conservazione dei retained message
- Pubblicazione del Last Will and Testament in caso di disconnessione anomala
- Esposizione di metriche di sistema tramite il topic `$SYS/`

Il broker non ha conoscenza del significato dei messaggi. Si occupa esclusivamente del trasporto.

### Publisher e Subscriber

Un client MQTT può assumere contemporaneamente il ruolo di publisher e di subscriber. Non esiste distinzione tecnica tra i due ruoli: un singolo client può pubblicare su alcuni topic e ricevere messaggi da altri.

---

## 4. Il Modello Publish/Subscribe

Il paradigma publish/subscribe introduce un disaccoppiamento strutturale tra le parti comunicanti, assente nel classico modello request/response.

```
MODELLO REQUEST/RESPONSE (HTTP):

  Client --------[GET /temperatura]--------> Server
  Client <-------[200 OK: {"temp": 22.5}]--- Server

  Il client conosce l'indirizzo del server.
  Il server deve essere raggiungibile nel momento della richiesta.
  La comunicazione e' sincrona e bloccante.


MODELLO PUBLISH/SUBSCRIBE (MQTT):

  Sensore ----[publish: "sensors/temp" = 22.5]----> Broker
                                                        |
  Dashboard <--[msg: 22.5]---------------------------- Broker
  Sistema SCADA <--[msg: 22.5]------------------------ Broker
  Archivio DB <--[msg: 22.5]-------------------------- Broker

  Publisher e subscriber non si conoscono reciprocamente.
  La comunicazione e' asincrona e non bloccante.
  Piu' subscriber possono ricevere lo stesso messaggio.
```

### Disaccoppiamento su tre livelli

**Spaziale**: publisher e subscriber non si conoscono. Il publisher non sa quanti o quali subscriber riceveranno il messaggio. Il subscriber non conosce la sorgente del dato.

**Temporale**: publisher e subscriber non devono essere connessi simultaneamente. Con QoS 1 o 2 e sessione persistente, i messaggi vengono accodati dal broker e consegnati alla successiva connessione del subscriber.

**Della sincronizzazione**: l'operazione di publish non blocca il publisher. Il broker si fa carico della consegna in modo indipendente.

---

## 5. Struttura dei Topic

I topic sono stringhe UTF-8 che definiscono il canale di comunicazione. Utilizzano `/` come separatore gerarchico e non richiedono definizione preventiva — vengono creati implicitamente al primo utilizzo.

### Gerarchia e convenzioni

```
Struttura consigliata:
  {dominio}/{entita}/{id}/{grandezza}

Esempi industriali:
  plant/line-A/motor-01/rpm
  plant/line-A/motor-01/temperature
  plant/line-A/motor-01/vibration
  plant/line-B/motor-01/rpm

Esempi domotici:
  home/floor1/livingroom/temperature
  home/floor1/livingroom/humidity
  home/floor2/bedroom/occupancy

Esempi veicoli connessi:
  fleet/vehicle-VIN1234/gps/coordinates
  fleet/vehicle-VIN1234/engine/rpm
  fleet/vehicle-VIN1234/fuel/level
```

### Wildcard

Le wildcard sono valide esclusivamente nelle subscription, mai nella pubblicazione.

**`+` — Single Level Wildcard**

Sostituisce esattamente un livello della gerarchia.

```
Subscription:  plant/+/motor-01/temperature

Corrisponde a:
  plant/line-A/motor-01/temperature   [match]
  plant/line-B/motor-01/temperature   [match]
  plant/line-C/motor-01/temperature   [match]

Non corrisponde a:
  plant/line-A/sector-2/motor-01/temperature   [livelli extra]
  plant/temperature                             [livelli mancanti]
```

**`#` — Multi Level Wildcard**

Sostituisce zero o piu' livelli. Deve obbligatoriamente essere l'ultimo elemento del topic.

```
Subscription:  plant/line-A/#

Corrisponde a:
  plant/line-A/motor-01/temperature   [match]
  plant/line-A/motor-01/rpm           [match]
  plant/line-A/sensors/zone3/raw      [match]
  plant/line-A                        [match — zero livelli aggiuntivi]

Non corrisponde a:
  plant/line-B/motor-01/temperature   [ramo diverso]
```

### Topic di sistema: `$SYS`

Il broker pubblica automaticamente metriche interne su topic che iniziano con `$SYS/`:

```
$SYS/broker/clients/connected      numero di client attualmente connessi
$SYS/broker/clients/total          totale storico di client connessi
$SYS/broker/messages/received      messaggi totali ricevuti dal broker
$SYS/broker/messages/sent          messaggi totali inviati dal broker
$SYS/broker/uptime                 uptime del broker in secondi
$SYS/broker/version                versione del software broker
```

I topic `$SYS` non vengono inclusi dalla subscription `#`. Richiedono una subscription esplicita.

---

## 6. Quality of Service

Il livello di QoS definisce la garanzia di consegna di un messaggio tra publisher e broker, e tra broker e subscriber. I due tratti vengono negoziati indipendentemente.

### QoS 0 — At Most Once

```
Publisher                Broker
    |                       |
    |------- PUBLISH ------>|
    |                       |
         (nessun ACK)
```

Nessuna garanzia. Il messaggio viene inviato una sola volta e non viene mai ritrasmesso. In caso di perdita di rete durante la trasmissione, il messaggio viene perso senza che nessuna delle parti ne sia consapevole.

Utilizzo tipico: telemetria ad alta frequenza dove la perdita occasionale di un campione e' accettabile (letture GPS ogni secondo, temperature di processo, accelerometri).

### QoS 1 — At Least Once

```
Publisher                Broker
    |                       |
    |------- PUBLISH ------>|  (con PacketID)
    |<------ PUBACK --------|
    |                       |
    Se nessun PUBACK arriva entro il timeout,
    il Publisher ritrasmette con DUP flag = 1.
```

Il messaggio arriva al broker almeno una volta, ma possono verificarsi duplicati. Il subscriber deve essere progettato per gestirli (idempotenza).

Utilizzo tipico: notifiche di stato, aggiornamenti di configurazione, comandi reversibili.

### QoS 2 — Exactly Once

```
Publisher                Broker
    |                       |
    |------- PUBLISH ------>|  Step 1: invio
    |<------ PUBREC --------|  Step 2: broker ha ricevuto
    |------- PUBREL ------->|  Step 3: publisher conferma
    |<------ PUBCOMP -------|  Step 4: consegna completata
    |                       |
    Il four-way handshake garantisce esattamente una consegna.
```

Nessun duplicato, nessuna perdita. Il costo e' il doppio dei round-trip rispetto a QoS 1.

Utilizzo tipico: comandi attuatori critici, transazioni finanziarie, comandi che non possono essere eseguiti due volte (apertura valvole, avvio macchinari).

### Degradazione del QoS

Quando un publisher invia con QoS 2 e un subscriber e' iscritto con QoS 0, il broker consegna con QoS 0 (il livello minore tra i due). Questo comportamento e' intenzionale e definito dalla specifica.

```
Publisher  QoS 2 -->  Broker  QoS 0 -->  Subscriber
                             ^
                             Il livello di consegna finale
                             e' min(QoS_publish, QoS_subscribe)
```

### Tabella comparativa

| | QoS 0 | QoS 1 | QoS 2 |
|---|---|---|---|
| Garanzia di consegna | Nessuna | Almeno una volta | Esattamente una volta |
| Messaggi scambiati | 1 | 2 | 4 |
| Possibili duplicati | Si | Si | No |
| Throughput relativo | Massimo | Medio | Minore |
| Impatto sulla memoria broker | Nullo | Basso | Medio |

---

## 7. Formato dei Pacchetti

Ogni pacchetto MQTT ha una struttura binaria composta da tre sezioni.

```
+------------------------------------------------+
|  Fixed Header  (obbligatorio, 2-5 byte)        |
|  +--------------------+---------------------+  |
|  | Tipo pacchetto     | Flags               |  |
|  | (4 bit)            | (4 bit)             |  |
|  +--------------------+---------------------+  |
|  | Remaining Length (1-4 byte, var-length)  |  |
+------------------------------------------------+
|  Variable Header  (dipende dal tipo)           |
+------------------------------------------------+
|  Payload  (dipende dal tipo)                   |
+------------------------------------------------+
```

Il Remaining Length utilizza una codifica a lunghezza variabile: ogni byte usa 7 bit per il valore e 1 bit per indicare se segue un altro byte. Consente di rappresentare messaggi fino a 256 MB con soli 4 byte.

### Tabella dei tipi di pacchetto

| ID | Nome | Direzione | Funzione |
|---|---|---|---|
| 1 | CONNECT | Client → Broker | Richiesta di connessione |
| 2 | CONNACK | Broker → Client | Risposta alla connessione |
| 3 | PUBLISH | Bidirezionale | Pubblicazione messaggio |
| 4 | PUBACK | Bidirezionale | Conferma QoS 1 |
| 5 | PUBREC | Bidirezionale | Ricevuto QoS 2 (step 1) |
| 6 | PUBREL | Bidirezionale | Rilasciato QoS 2 (step 2) |
| 7 | PUBCOMP | Bidirezionale | Completato QoS 2 (step 3) |
| 8 | SUBSCRIBE | Client → Broker | Iscrizione topic |
| 9 | SUBACK | Broker → Client | Conferma iscrizione |
| 10 | UNSUBSCRIBE | Client → Broker | Cancellazione iscrizione |
| 11 | UNSUBACK | Broker → Client | Conferma cancellazione |
| 12 | PINGREQ | Client → Broker | Heartbeat |
| 13 | PINGRESP | Broker → Client | Risposta heartbeat |
| 14 | DISCONNECT | Client → Broker | Disconnessione pulita |

---

## 8. Gestione della Connessione

### Il pacchetto CONNECT

```
Campo               Tipo         Note
-------------------------------------------------------------------
Protocol Name       UTF-8        "MQTT" (versione 3.1.1 e 5.0)
Protocol Level      Byte         4 per v3.1.1, 5 per v5.0
Connect Flags       Byte         Bitmap (vedi sotto)
Keep Alive          Uint16       Intervallo heartbeat in secondi
Client Identifier   UTF-8        Identificatore univoco del client
Will Topic          UTF-8*       Topic del Last Will
Will Payload        Bytes*       Contenuto del Last Will
Username            UTF-8*       Credenziale di accesso
Password            Bytes*       Credenziale di accesso

(*) presenti solo se il corrispondente flag e' attivo
```

### Connect Flags

```
Bit 7: UsernameFlag     se 1, include Username nel payload
Bit 6: PasswordFlag     se 1, include Password nel payload
Bit 5: WillRetain       il LWT deve essere retained
Bit 4: WillQoS (MSB)    QoS del Last Will (bit alto)
Bit 3: WillQoS (LSB)    QoS del Last Will (bit basso)
Bit 2: WillFlag         se 1, include LWT nel payload
Bit 1: CleanSession     controlla la persistenza della sessione
Bit 0: Riservato        deve essere 0
```

### Codici di risposta CONNACK (v3.1.1)

| Codice | Significato |
|---|---|
| 0x00 | Connessione accettata |
| 0x01 | Versione del protocollo non supportata |
| 0x02 | Client Identifier rifiutato (formato non valido) |
| 0x03 | Server non disponibile |
| 0x04 | Username o password malformati |
| 0x05 | Non autorizzato |

---

## 9. Session Persistence

### Clean Session true

Il broker non mantiene alcuno stato per questo client tra una connessione e l'altra. Alla disconnessione vengono eliminati subscription attive e messaggi in coda.

```
Sessione A:
  Client si connette, si iscrive a "factory/+/alarms", riceve messaggi.

  [Interruzione di rete]

Sessione B:
  Client si riconnette.
  Il broker non ha memoria della sessione precedente.
  Il client deve riscriversi manualmente a tutti i topic.
  I messaggi QoS 1/2 inviati durante l'assenza sono andati persi.
```

Adatto a: client senza stato, browser, applicazioni di monitoraggio che mostrano solo dati in tempo reale.

### Clean Session false

Il broker mantiene la sessione legata al Client Identifier. Alla reconnessione, subscription e messaggi in coda vengono ripristinati automaticamente.

```
Sessione A:
  Client si connette, si iscrive a "factory/+/alarms" con QoS 1.
  Riceve messaggi normalmente.

  [Interruzione di corrente — il dispositivo si spegne]

  [Durante l'assenza, il broker riceve 14 allarmi e li accoda]

Sessione B:
  Client si riconnette con lo stesso Client Identifier.
  Il broker notifica session_present = 1 nel CONNACK.
  I 14 messaggi vengono consegnati immediatamente.
  Il client non deve riscriversi.
```

Adatto a: dispositivi industriali, gateway, sistemi embedded mission-critical.

---

## 10. Retained Messages

Un retained message e' il messaggio piu' recente pubblicato su un topic con il flag `retain = true`. Il broker lo conserva indefinitamente e lo consegna immediatamente a ogni nuovo subscriber che si iscrive a quel topic.

```
Senza retained:

  [Publisher pubblica "22.5" su "sensor/temp"]

  [2 ore dopo]

  [Nuovo subscriber si iscrive a "sensor/temp"]
  --> il subscriber attende il prossimo publish per avere un valore


Con retained:

  [Publisher pubblica "22.5" su "sensor/temp" con retain=true]
  [Il broker salva "22.5" come retained per "sensor/temp"]

  [2 ore dopo]

  [Nuovo subscriber si iscrive a "sensor/temp"]
  --> il broker consegna immediatamente "22.5"
  --> il subscriber ha subito un valore valido
```

I retained message risolvono il problema del "cold start" dei subscriber: all'avvio ricevono immediatamente lo stato corrente senza dover aspettare il prossimo ciclo di pubblicazione.

### Eliminazione di un retained message

```python
# Pubblicare un payload vuoto con retain=true elimina il retained message
client.publish("sensor/temperature", payload=b"", retain=True)
```

---

## 11. Last Will and Testament

Il Last Will and Testament (LWT) e' un meccanismo che consente a un client di definire, al momento della connessione, un messaggio che il broker pubblichera' automaticamente in caso di disconnessione anomala.

### Flusso operativo

```
Fase 1 — Connessione:
  Client invia CONNECT con:
    will_topic   = "devices/sensor-01/status"
    will_payload = '{"status": "offline", "reason": "unexpected"}'
    will_qos     = 1
    will_retain  = true

  Il broker memorizza il LWT associato a questa sessione.

Fase 2a — Disconnessione normale:
  Client invia esplicitamente DISCONNECT.
  Il broker elimina il LWT senza pubblicarlo.

Fase 2b — Disconnessione anomala:
  Il client smette di rispondere al keep-alive.
  Il broker rileva il timeout (keep_alive * 1.5 secondi).
  Il broker pubblica automaticamente il LWT su "devices/sensor-01/status".
  Tutti i subscriber ricevono '{"status": "offline", "reason": "unexpected"}'.
```

### Pattern di presenza online/offline

Il LWT abilita un pattern di presence detection robusto, largamente utilizzato nei sistemi IoT:

```
Al momento della connessione:
  1. Registra LWT con payload {"status": "offline"} e retain=true
  2. Pubblica immediatamente {"status": "online"} con retain=true

Risultato:
  - Il topic "devices/{id}/status" contiene sempre lo stato piu' aggiornato
  - I nuovi subscriber lo ricevono immediatamente (retained)
  - In caso di crash, il broker sovrascrive l'online con l'offline (LWT)
```

---

## 12. Keep Alive

Il keep-alive e' un parametro impostato dal client nel pacchetto CONNECT. Definisce il numero massimo di secondi che possono trascorrere senza che il client invii alcun pacchetto al broker.

Se il client ha traffico da trasmettere, il keep-alive viene soddisfatto naturalmente. Se non ci sono messaggi, il client invia un `PINGREQ` e il broker risponde con un `PINGRESP`.

```
Client                       Broker
  |                             |
  |------- CONNECT ----------->| (keepAlive = 60)
  |                             |
  | [traffico normale per 60s]  |
  |                             |
  |------- PINGREQ ----------->|
  |<------ PINGRESP -----------|
  |                             |
  | [altri 60 secondi]          |
  |                             |
  | [nessun pacchetto!]         |
  |                             |  dopo 90s (60 * 1.5)
  |                             |  il broker considera il client
  |                             |  disconnesso e pubblica il LWT
```

Il broker applica un margine di tolleranza di 1.5 volte il valore di keep-alive prima di dichiarare il client non raggiungibile. Con keepAlive = 60s, il timeout effettivo e' 90 secondi.

---

## 13. Sicurezza

### Autenticazione con username e password

Il meccanismo nativo di MQTT prevede username e password trasmessi in chiaro nel pacchetto CONNECT. In assenza di crittografia a livello di trasporto, le credenziali sono intercettabili.

```
CONNECT {
  username: "device_sensor_01",
  password: "credential"
}
```

Questo metodo e' accettabile esclusivamente su connessioni TLS.

### Crittografia con TLS

```
Porta 1883   MQTT senza crittografia (solo reti fisicamente sicure)
Porta 8883   MQTT con TLS
Porta 443    MQTT over WebSocket con TLS
```

Connessione con TLS in Python:

```python
import ssl
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.tls_set(
    ca_certs   = "/etc/ssl/certs/ca.crt",
    certfile   = "/etc/ssl/certs/client.crt",
    keyfile    = "/etc/ssl/private/client.key",
    tls_version= ssl.PROTOCOL_TLS,
    cert_reqs  = ssl.CERT_REQUIRED
)
client.username_pw_set("device_user", "credential")
client.connect("secure-broker.internal", 8883, keepalive=60)
```

### Mutual TLS (mTLS)

Nell'autenticazione mTLS il broker verifica l'identita' del client tramite un certificato X.509 specifico per quel dispositivo. Ogni dispositivo possiede un certificato univoco firmato da una CA aziendale. E' il modello adottato da AWS IoT Core, Azure IoT Hub e la maggior parte delle piattaforme IoT enterprise.

```
Client              Broker
  |                   |
  |--- ClientHello -->|
  |<-- ServerHello ---|
  |<-- Certificate ---|  il broker presenta il suo certificato
  |--- Certificate -->|  il client presenta il suo certificato
  |--- Finished ----->|
  |<-- Finished ------|
  |                   |
  connessione cifrata e autenticata bilateralmente
```

### Access Control Lists (ACL)

Il broker puo' applicare regole di autorizzazione granulari per topic:

```
# Configurazione ACL per Mosquitto

# Il sensore della linea A puo' solo pubblicare la propria telemetria
user sensor_line_a
topic write  factory/line-A/+/telemetry
topic read   factory/line-A/+/commands

# Il sistema SCADA puo' leggere tutta la telemetria e inviare comandi
user scada_system
topic read   factory/#
topic write  factory/+/+/commands

# Il broker di bridge puo' fare tutto
user bridge_broker
topic readwrite #

# L'utente di monitoring puo' leggere ma non scrivere
user monitoring
topic read   factory/#
topic read   $SYS/#
```

---

## 14. MQTT 5.0

MQTT 5.0 introduce funzionalita' progettate per scenari enterprise e architetture cloud-native.

### Reason Codes dettagliati

In MQTT 3.1.1 il CONNACK restituisce un codice generico. MQTT 5.0 fornisce codici specifici per ogni condizione di errore:

```
0x00  Success
0x80  Unspecified error
0x81  Malformed Packet
0x82  Protocol Error
0x83  Implementation Specific Error
0x84  Unsupported Protocol Version
0x85  Client Identifier Not Valid
0x86  Bad User Name or Password
0x87  Not Authorized
0x88  Server Unavailable
0x89  Server Busy
0x8A  Banned
0x8C  Bad Authentication Method
0x90  Topic Name Invalid
0x95  Packet Too Large
0x97  Quota Exceeded
0x99  Payload Format Invalid
0x9A  Retain Not Supported
0x9B  QoS Not Supported
0x9C  Use Another Server
0x9D  Server Moved
0x9F  Connection Rate Exceeded
```

### Message Expiry Interval

I messaggi possono avere un TTL (Time to Live). Il broker non consegnera' un messaggio scaduto ai subscriber offline.

```python
from paho.mqtt.properties import Properties
from paho.mqtt.packettypes import PacketTypes

props = Properties(PacketTypes.PUBLISH)
props.MessageExpiryInterval = 3600  # scade dopo 1 ora

client.publish("alerts/critical", payload, properties=props)
```

### User Properties

Coppie chiave-valore arbitrarie che possono essere aggiunte a qualsiasi pacchetto. Consentono di trasportare metadati senza modificare il payload applicativo.

```python
props = Properties(PacketTypes.PUBLISH)
props.UserProperty = [
    ("firmware-version", "3.1.2"),
    ("hardware-revision", "C"),
    ("location-id",       "plant-A-floor-2"),
    ("protocol-version",  "v2"),
]
client.publish("sensors/device-001/telemetry", payload, properties=props)
```

### Shared Subscriptions

Le shared subscription abilitano il load balancing tra piu' istanze dello stesso consumer, senza richiedere coordinazione applicativa.

```
Pattern: $share/{GroupName}/{TopicFilter}

Scenario: 3 worker subscribono a $share/processors/jobs/queue

  Publisher invia 9 messaggi su "jobs/queue"

  Distribuzione round-robin gestita dal broker:
  Worker-1: messaggio 1, 4, 7
  Worker-2: messaggio 2, 5, 8
  Worker-3: messaggio 3, 6, 9
```

Questo pattern e' equivalente a un message queue tradizionale (tipo RabbitMQ work queue), ma implementato nativamente nel protocollo MQTT.

### Topic Aliases

Riducono l'overhead di rete per topic con stringhe lunghe. Il client negozia un alias numerico con il broker e lo usa in sostituzione del topic nelle pubblicazioni successive.

```
Prima dell'alias:
  PUBLISH "factory/building-A/floor-3/room-102/sensor/temperature" = 22.5
  PUBLISH "factory/building-A/floor-3/room-102/sensor/temperature" = 22.7
  PUBLISH "factory/building-A/floor-3/room-102/sensor/temperature" = 22.3

Con topic alias:
  PUBLISH "factory/building-A/floor-3/room-102/sensor/temperature" alias=3 = 22.5
  PUBLISH alias=3 = 22.7
  PUBLISH alias=3 = 22.3
```

### Pattern Request/Response formalizzato

MQTT 5.0 introduce proprieta' dedicate per il pattern request/response, evitando le soluzioni ad-hoc necessarie con v3.1.1.

```python
import uuid

# --- Lato richiedente ---

correlation_id  = str(uuid.uuid4()).encode()
response_topic  = f"responses/{client_id}/{uuid.uuid4().hex}"

client.subscribe(response_topic, qos=1)

req_props = Properties(PacketTypes.PUBLISH)
req_props.ResponseTopic     = response_topic
req_props.CorrelationData   = correlation_id

client.publish(
    "services/unit-converter/celsius-to-fahrenheit",
    payload = "22.5",
    properties = req_props
)

# --- Lato responder ---

def on_message(client, userdata, msg):
    value_c = float(msg.payload)
    value_f = value_c * 9/5 + 32

    resp_props = Properties(PacketTypes.PUBLISH)
    resp_props.CorrelationData = msg.properties.CorrelationData

    client.publish(
        msg.properties.ResponseTopic,
        payload    = str(value_f),
        properties = resp_props
    )
```

---

## 15. Broker MQTT

### Confronto tra broker principali

| Broker | Licenza | Implementazione | Caratteristica distintiva |
|---|---|---|---|
| Eclipse Mosquitto | EPL/EDL | C | Minimo footprint, ideale per embedded e Raspberry Pi |
| HiveMQ | Commercial / CE | Java | Clustering nativo, MQTT 5.0 completo, enterprise support |
| EMQX | Apache 2.0 | Erlang/OTP | Scalabilita' estrema (100M connessioni dichiarate) |
| VerneMQ | Apache 2.0 | Erlang/OTP | Architettura distribuita Dynamo-style |
| RabbitMQ | MPL 2.0 | Erlang/OTP | MQTT come plugin, non nativo |
| AWS IoT Core | SaaS | — | Integrazione nativa con l'ecosistema AWS |
| Azure IoT Hub | SaaS | — | Integrazione con Azure Digital Twins e Stream Analytics |

### Installazione e test rapido con Mosquitto

```bash
# Ubuntu/Debian
sudo apt-get install mosquitto mosquitto-clients

# macOS
brew install mosquitto

# Docker
docker run -d \
  --name mosquitto \
  -p 1883:1883 \
  -p 9001:9001 \
  eclipse-mosquitto

# Subscriber universale (terminale 1)
mosquitto_sub -h localhost -t "#" -v

# Publisher di test (terminale 2)
mosquitto_pub -h localhost -t "test/greeting" -m "Hello MQTT"
```

---

## 16. API nei principali linguaggi

### 16.1 Python — paho-mqtt

```bash
pip install paho-mqtt
```

#### Publisher con gestione completa della sessione

```python
import paho.mqtt.client as mqtt
import json
import time
import random
import logging

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

BROKER_HOST = "broker.hivemq.com"
BROKER_PORT = 1883
CLIENT_ID   = "sensor-temperature-plant-A-01"

# ─── Callbacks ───────────────────────────────────────────────────────────────

def on_connect(client, userdata, flags, rc):
    codes = {
        0: "Connessione accettata",
        1: "Versione protocollo non supportata",
        2: "Client Identifier rifiutato",
        3: "Server non disponibile",
        4: "Credenziali non valide",
        5: "Non autorizzato",
    }
    if rc == 0:
        log.info("Connesso al broker. %s", codes.get(rc))
        # Pubblica lo stato online con retain
        client.publish(
            f"devices/{CLIENT_ID}/status",
            json.dumps({"status": "online", "ts": time.time()}),
            qos=1,
            retain=True
        )
    else:
        log.error("Connessione rifiutata: %s (codice %d)", codes.get(rc, "Sconosciuto"), rc)

def on_disconnect(client, userdata, rc):
    if rc == 0:
        log.info("Disconnessione pulita.")
    else:
        log.warning("Disconnessione inattesa (rc=%d). Il client tentera' la riconnessione.", rc)

def on_publish(client, userdata, mid):
    log.debug("Messaggio %d confermato dal broker.", mid)

# ─── Configurazione client ────────────────────────────────────────────────────

client = mqtt.Client(
    client_id  = CLIENT_ID,
    clean_session = True,
    protocol   = mqtt.MQTTv311
)

client.on_connect    = on_connect
client.on_disconnect = on_disconnect
client.on_publish    = on_publish

# Last Will and Testament
client.will_set(
    topic   = f"devices/{CLIENT_ID}/status",
    payload = json.dumps({"status": "offline", "reason": "unexpected_disconnect"}),
    qos     = 1,
    retain  = True
)

client.username_pw_set("sensor_user", "credential")

# Riconnessione automatica con backoff
client.reconnect_delay_set(min_delay=1, max_delay=60)

# ─── Connessione ─────────────────────────────────────────────────────────────

client.connect(BROKER_HOST, BROKER_PORT, keepalive=60)
client.loop_start()

# ─── Loop di pubblicazione ────────────────────────────────────────────────────

try:
    seq = 0
    while True:
        seq += 1
        payload = json.dumps({
            "temperature": round(random.uniform(18.0, 35.0), 2),
            "humidity":    round(random.uniform(30.0, 90.0), 2),
            "pressure":    round(random.uniform(1000, 1030), 1),
            "unit":        "SI",
            "seq":         seq,
            "ts":          time.time()
        })

        result = client.publish(
            topic   = "plant/line-A/sensor-01/environment",
            payload = payload,
            qos     = 1,
            retain  = False
        )

        result.wait_for_publish()
        log.info("Pubblicato seq=%d", seq)
        time.sleep(10)

except KeyboardInterrupt:
    log.info("Interruzione manuale. Avvio shutdown.")

finally:
    client.publish(
        f"devices/{CLIENT_ID}/status",
        json.dumps({"status": "offline", "reason": "graceful_shutdown"}),
        qos=1,
        retain=True
    ).wait_for_publish()

    client.loop_stop()
    client.disconnect()
    log.info("Disconnessione completata.")
```

#### Subscriber con routing per topic

```python
import paho.mqtt.client as mqtt
import json
import logging
from datetime import datetime

logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] %(message)s"
)
log = logging.getLogger(__name__)

CLIENT_ID = "scada-dashboard-01"

# ─── Handler per tipo di messaggio ───────────────────────────────────────────

def handle_telemetry(topic: str, payload: dict):
    log.info("[TELEMETRY] %s -> temp=%.2f, hum=%.2f",
             topic,
             payload.get("temperature", -1),
             payload.get("humidity", -1))

def handle_device_status(topic: str, payload: dict):
    device_id = topic.split("/")[1]
    status    = payload.get("status", "unknown")
    log.info("[PRESENCE] Device %s is now %s", device_id, status.upper())

def handle_alert(topic: str, payload: dict):
    log.warning("[ALERT] %s | %s: %s",
                payload.get("location", "?"),
                payload.get("type", "?"),
                payload.get("value", "?"))

# ─── Dispatch table ──────────────────────────────────────────────────────────

HANDLERS = {
    "plant":   handle_telemetry,
    "devices": handle_device_status,
    "alerts":  handle_alert,
}

# ─── Callbacks ───────────────────────────────────────────────────────────────

def on_connect(client, userdata, flags, rc):
    if rc != 0:
        log.error("Connessione fallita (rc=%d)", rc)
        return

    session_restored = bool(flags.get("session present"))
    log.info("Connesso. Sessione precedente ripristinata: %s", session_restored)

    if not session_restored:
        subscriptions = [
            ("plant/+/+/environment", 0),   # QoS 0: telemetria ad alta frequenza
            ("devices/+/status",      1),   # QoS 1: stato dispositivi
            ("alerts/#",              2),   # QoS 2: allarmi critici
        ]
        client.subscribe(subscriptions)
        log.info("Iscrizioni effettuate.")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        log.warning("Payload non valido su %s: %s", msg.topic, e)
        return

    root_segment = msg.topic.split("/")[0]
    handler      = HANDLERS.get(root_segment)

    if handler:
        handler(msg.topic, payload)
    else:
        log.debug("[UNHANDLED] %s: %s", msg.topic, payload)

# ─── Configurazione ───────────────────────────────────────────────────────────

client = mqtt.Client(
    client_id     = CLIENT_ID,
    clean_session = False,   # Mantieni sessione: nessun messaggio QoS 1/2 viene perso
    protocol      = mqtt.MQTTv311
)

client.on_connect = on_connect
client.on_message = on_message
client.username_pw_set("scada_user", "credential")
client.reconnect_delay_set(min_delay=1, max_delay=30)

client.connect("broker.hivemq.com", 1883, keepalive=60)
client.loop_forever()
```

---

### 16.2 JavaScript / Node.js — mqtt.js

```bash
npm install mqtt
```

```javascript
'use strict';

const mqtt   = require('mqtt');
const crypto = require('crypto');

const CLIENT_ID = `node-gateway-${crypto.randomBytes(4).toString('hex')}`;
const BROKER    = 'mqtt://broker.hivemq.com:1883';

// ─── Configurazione ──────────────────────────────────────────────────────────

const options = {
    clientId:        CLIENT_ID,
    clean:           true,
    connectTimeout:  4000,
    username:        'gateway_user',
    password:        'credential',
    reconnectPeriod: 2000,
    will: {
        topic:   `devices/${CLIENT_ID}/status`,
        payload: JSON.stringify({ status: 'offline', reason: 'unexpected' }),
        qos:     1,
        retain:  true
    }
};

// ─── Connessione ─────────────────────────────────────────────────────────────

const client = mqtt.connect(BROKER, options);

// ─── Event Handlers ──────────────────────────────────────────────────────────

client.on('connect', () => {
    console.log('[INFO] Connesso al broker.');

    client.publish(
        `devices/${CLIENT_ID}/status`,
        JSON.stringify({ status: 'online', pid: process.pid, ts: Date.now() }),
        { qos: 1, retain: true }
    );

    client.subscribe(
        {
            'sensors/+/temperature': { qos: 1 },
            'commands/gateway/+':    { qos: 2 },
            'broadcast/#':           { qos: 0 }
        },
        (err, granted) => {
            if (err) {
                console.error('[ERROR] Subscription fallita:', err.message);
                return;
            }
            granted.forEach(g =>
                console.log(`[INFO] Iscritto a "${g.topic}" con QoS ${g.qos}`)
            );
        }
    );
});

client.on('message', (topic, payload, packet) => {
    let data;
    try {
        data = JSON.parse(payload.toString());
    } catch {
        data = payload.toString();
    }

    console.log(`[MSG] ${new Date().toISOString()} | ${topic}`);
    console.log('      Payload:', JSON.stringify(data));
    console.log(`      QoS: ${packet.qos} | Retain: ${packet.retain}`);

    if (topic.startsWith('commands/gateway/')) {
        const command = topic.split('/').pop();
        processCommand(command, data);
    }
});

client.on('reconnect', () => console.log('[INFO] Riconnessione in corso...'));
client.on('offline',   () => console.log('[WARN] Client offline.'));
client.on('error',     (err) => console.error('[ERROR]', err.message));

// ─── Logica applicativa ──────────────────────────────────────────────────────

function processCommand(command, payload) {
    const handlers = {
        'restart':     () => console.log('[CMD] Restart richiesto.'),
        'update-config': () => console.log('[CMD] Aggiornamento config:', payload),
        'ping':          () => client.publish(
            `devices/${CLIENT_ID}/pong`,
            JSON.stringify({ ts: Date.now() }),
            { qos: 1 }
        )
    };

    const handler = handlers[command];
    if (handler) {
        handler();
    } else {
        console.warn(`[WARN] Comando sconosciuto: ${command}`);
    }
}

// ─── Publish periodico ───────────────────────────────────────────────────────

let seq = 0;
const publishInterval = setInterval(() => {
    const data = {
        value: parseFloat((Math.random() * 30 + 10).toFixed(2)),
        unit:  'celsius',
        seq:   ++seq,
        ts:    Date.now()
    };

    client.publish(
        'sensors/node-gw-01/temperature',
        JSON.stringify(data),
        { qos: 1 },
        (err) => {
            if (err) console.error('[ERROR] Publish fallito:', err.message);
            else      console.log(`[INFO] Pubblicato seq=${seq}, value=${data.value}`);
        }
    );
}, 5000);

// ─── Graceful shutdown ───────────────────────────────────────────────────────

process.on('SIGINT', () => {
    console.log('\n[INFO] Shutdown in corso...');
    clearInterval(publishInterval);

    client.publish(
        `devices/${CLIENT_ID}/status`,
        JSON.stringify({ status: 'offline', reason: 'graceful' }),
        { qos: 1, retain: true },
        () => {
            client.end(false, {}, () => {
                console.log('[INFO] Disconnessione completata.');
                process.exit(0);
            });
        }
    );
});
```

---

### 16.3 Java — Eclipse Paho

```xml
<dependency>
    <groupId>org.eclipse.paho</groupId>
    <artifactId>org.eclipse.paho.client.mqttv3</artifactId>
    <version>1.2.5</version>
</dependency>
```

```java
package com.example.mqtt;

import org.eclipse.paho.client.mqttv3.*;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.Map;
import java.util.logging.Logger;

public class MqttSensorClient {

    private static final Logger log      = Logger.getLogger(MqttSensorClient.class.getName());
    private static final String BROKER   = "tcp://broker.hivemq.com:1883";
    private static final String CLIENT   = "java-sensor-plant-A-01";
    private static final String TOPIC    = "plant/line-A/sensor-java/telemetry";
    private static final ObjectMapper om = new ObjectMapper();

    public static void main(String[] args) throws Exception {

        MemoryPersistence persistence = new MemoryPersistence();
        MqttClient client = new MqttClient(BROKER, CLIENT, persistence);

        // ─── Opzioni di connessione ────────────────────────────────────────

        MqttConnectOptions opts = new MqttConnectOptions();
        opts.setCleanSession(true);
        opts.setConnectionTimeout(10);
        opts.setKeepAliveInterval(60);
        opts.setAutomaticReconnect(true);
        opts.setUserName("java_user");
        opts.setPassword("credential".toCharArray());

        String lwtPayload = om.writeValueAsString(
            Map.of("status", "offline", "reason", "unexpected")
        );
        opts.setWill(
            "devices/" + CLIENT + "/status",
            lwtPayload.getBytes(),
            1,
            true
        );

        // ─── Callback ─────────────────────────────────────────────────────

        client.setCallback(new MqttCallback() {

            @Override
            public void connectionLost(Throwable cause) {
                log.warning("Connessione persa: " + cause.getMessage());
            }

            @Override
            public void messageArrived(String topic, MqttMessage message) throws Exception {
                log.info(String.format("[%s] %s: %s",
                    Instant.now(), topic, new String(message.getPayload())
                ));
            }

            @Override
            public void deliveryComplete(IMqttDeliveryToken token) {
                log.fine("Consegna confermata: " + token.getMessageId());
            }
        });

        // ─── Connessione ──────────────────────────────────────────────────

        log.info("Connessione a " + BROKER);
        client.connect(opts);
        log.info("Connesso.");

        // Pubblica stato online
        MqttMessage onlineMsg = new MqttMessage(
            om.writeValueAsBytes(Map.of("status", "online", "ts", Instant.now().toEpochMilli()))
        );
        onlineMsg.setQos(1);
        onlineMsg.setRetained(true);
        client.publish("devices/" + CLIENT + "/status", onlineMsg);

        // Iscrizione ai comandi
        client.subscribe("commands/" + CLIENT + "/#", 2);

        // ─── Publish loop ────────────────────────────────────────────────

        for (int seq = 1; seq <= 20; seq++) {
            Map<String, Object> data = Map.of(
                "temperature", Math.round((18.0 + Math.random() * 17.0) * 100.0) / 100.0,
                "humidity",    Math.round((30.0 + Math.random() * 60.0) * 100.0) / 100.0,
                "seq",         seq,
                "ts",          Instant.now().toEpochMilli()
            );

            MqttMessage msg = new MqttMessage(om.writeValueAsBytes(data));
            msg.setQos(1);
            client.publish(TOPIC, msg);
            log.info("Pubblicato seq=" + seq);

            Thread.sleep(5000);
        }

        // ─── Disconnessione pulita ────────────────────────────────────────

        client.publish(
            "devices/" + CLIENT + "/status",
            om.writeValueAsBytes(Map.of("status", "offline", "reason", "graceful")),
            1,
            true
        );

        Thread.sleep(500);
        client.disconnect();
        client.close();
        log.info("Disconnessione completata.");
    }
}
```

---

### 16.4 Go — paho.mqtt.golang

```bash
go get github.com/eclipse/paho.mqtt.golang
```

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "math/rand"
    "os"
    "os/signal"
    "syscall"
    "time"

    mqtt "github.com/eclipse/paho.mqtt.golang"
)

const (
    brokerURL = "tcp://broker.hivemq.com:1883"
    clientID  = "go-sensor-plant-a-01"
    pubTopic  = "plant/line-A/sensor-go/telemetry"
    subTopic  = "commands/go-sensor/#"
)

type Telemetry struct {
    Temperature float64 `json:"temperature"`
    Humidity    float64 `json:"humidity"`
    Sequence    int     `json:"seq"`
    Timestamp   int64   `json:"ts"`
}

type DeviceStatus struct {
    Status string `json:"status"`
    Reason string `json:"reason,omitempty"`
}

func publishStatus(c mqtt.Client, status, reason string) error {
    payload, err := json.Marshal(DeviceStatus{Status: status, Reason: reason})
    if err != nil {
        return err
    }
    token := c.Publish("devices/"+clientID+"/status", 1, true, payload)
    token.Wait()
    return token.Error()
}

func main() {
    lwtPayload, _ := json.Marshal(DeviceStatus{Status: "offline", Reason: "unexpected"})

    opts := mqtt.NewClientOptions()
    opts.AddBroker(brokerURL)
    opts.SetClientID(clientID)
    opts.SetUsername("go_user")
    opts.SetPassword("credential")
    opts.SetCleanSession(true)
    opts.SetKeepAlive(60 * time.Second)
    opts.SetAutoReconnect(true)
    opts.SetMaxReconnectInterval(30 * time.Second)
    opts.SetWill("devices/"+clientID+"/status", string(lwtPayload), 1, true)

    opts.SetOnConnectHandler(func(c mqtt.Client) {
        fmt.Println("[INFO] Connesso al broker.")
        if err := publishStatus(c, "online", ""); err != nil {
            fmt.Fprintf(os.Stderr, "[ERROR] Publish status: %v\n", err)
        }
        if t := c.Subscribe(subTopic, 2, commandHandler); t.Wait() && t.Error() != nil {
            fmt.Fprintf(os.Stderr, "[ERROR] Subscribe: %v\n", t.Error())
        }
    })

    opts.SetConnectionLostHandler(func(_ mqtt.Client, err error) {
        fmt.Printf("[WARN] Connessione persa: %v\n", err)
    })

    client := mqtt.NewClient(opts)
    if t := client.Connect(); t.Wait() && t.Error() != nil {
        fmt.Fprintf(os.Stderr, "[FATAL] Connessione: %v\n", t.Error())
        os.Exit(1)
    }

    ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer stop()

    ticker := time.NewTicker(10 * time.Second)
    defer ticker.Stop()

    seq := 0
    fmt.Println("[INFO] Pubblicazione in corso. Premere Ctrl+C per terminare.")

    for {
        select {
        case <-ticker.C:
            seq++
            t := Telemetry{
                Temperature: 18.0 + rand.Float64()*17.0,
                Humidity:    30.0 + rand.Float64()*60.0,
                Sequence:    seq,
                Timestamp:   time.Now().UnixMilli(),
            }
            payload, _ := json.Marshal(t)
            token := client.Publish(pubTopic, 1, false, payload)
            token.Wait()
            if token.Error() != nil {
                fmt.Fprintf(os.Stderr, "[ERROR] Publish: %v\n", token.Error())
            } else {
                fmt.Printf("[INFO] Pubblicato seq=%d, temp=%.2f\n", seq, t.Temperature)
            }

        case <-ctx.Done():
            fmt.Println("[INFO] Shutdown in corso...")
            if err := publishStatus(client, "offline", "graceful"); err != nil {
                fmt.Fprintf(os.Stderr, "[WARN] Publish offline status: %v\n", err)
            }
            time.Sleep(500 * time.Millisecond)
            client.Disconnect(500)
            fmt.Println("[INFO] Disconnessione completata.")
            return
        }
    }
}

func commandHandler(_ mqtt.Client, msg mqtt.Message) {
    fmt.Printf("[CMD] Comando ricevuto su %s: %s\n", msg.Topic(), msg.Payload())
}
```

---

## 17. Pattern Architetturali

### Command and Control

```
+-------------+          +--------+          +-----------+
|  Operatore  |          | BROKER |          | Attuatore |
+------+------+          +---+----+          +-----+-----+
       |                     |                     |
       |-- publish ---------->|                     |
       |   "plant/valve-01   |                     |
       |   /commands/open"   |-- subscribe ------->|
       |   payload: {        |   "plant/valve-01   |
       |     position: 100   |   /commands/+"      |
       |   }                 |                     |
       |                     |<-- publish ----------|
       |<-- subscribe -------|   "plant/valve-01   |
       |   "plant/valve-01   |   /status"          |
       |   /status"          |   payload: {        |
       |                     |     position: 100,  |
       |                     |     ts: ...         |
       |                     |   }                 |
```

### Fan-In (Aggregazione)

N sorgenti, un consumatore. Tipico dei sistemi di monitoring.

```python
# Aggregatore: si iscrive a tutti i sensori di una linea
client.subscribe("plant/line-A/+/telemetry", qos=0)

readings = {}

def on_message(client, userdata, msg):
    sensor_id = msg.topic.split("/")[2]
    data = json.loads(msg.payload)
    readings[sensor_id] = {
        "value": data["temperature"],
        "ts":    data["ts"]
    }

    # Ogni 10 letture, pubblica il riepilogo
    if len(readings) >= 10:
        avg = sum(r["value"] for r in readings.values()) / len(readings)
        client.publish(
            "plant/line-A/aggregate/temperature",
            json.dumps({"avg": round(avg, 2), "n": len(readings), "ts": time.time()}),
            qos=1,
            retain=True
        )
        readings.clear()
```

### Bridge tra broker

Due broker Mosquitto possono essere configurati come bridge per replicare messaggi tra reti separate (es. rete di fabbrica e cloud).

```
# /etc/mosquitto/conf.d/bridge.conf

connection cloud_bridge
address cloud-broker.example.com:8883

# Credenziali per il broker remoto
remote_username bridge_service
remote_password credential

# Replica telemetria dalla rete locale al cloud (direzione out)
topic plant/# out 1

# Ricevi comandi dal cloud (direzione in)
topic commands/# in 2

# TLS per la connessione al broker remoto
bridge_cafile   /etc/ssl/certs/ca.crt
bridge_certfile /etc/ssl/certs/bridge.crt
bridge_keyfile  /etc/ssl/private/bridge.key
```

---

## 18. MQTT vs REST

| Caratteristica | MQTT | REST/HTTP |
|---|---|---|
| Paradigma | Publish/Subscribe | Request/Response |
| Connessione | Persistente (TCP) | Per singola richiesta |
| Header minimo | 2 byte | 200-800 byte |
| Direzione | Bidirezionale nativa | Prevalentemente client → server |
| Push server | Nativo | SSE o WebSocket necessari |
| Scalabilita' | Elevata per n:m | Elevata per 1:1 |
| Autenticazione | Username/Password, TLS, mTLS | Bearer token, OAuth, API Key |
| Caching | Retained messages | HTTP Cache-Control |
| Discovery | Non previsto | REST HATEOAS, OpenAPI |
| Browser | Via WebSocket | Nativo |
| Ideale per | IoT, telemetria, real-time | API pubbliche, CRUD, web |

---

## 19. MQTT over WebSocket

MQTT puo' essere trasportato su WebSocket, rendendo il protocollo accessibile nativamente dai browser senza alcun plugin.

```
Porta 9001   WebSocket non cifrato
Porta 443    WebSocket cifrato (WSS)

URL formato: ws://broker.example.com:9001/mqtt
             wss://broker.example.com:443/mqtt
```

Esempio con MQTT.js nel browser:

```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>MQTT Browser Dashboard</title>
    <script src="https://unpkg.com/mqtt@4/dist/mqtt.min.js"></script>
</head>
<body>
    <pre id="log"></pre>
    <script>
    const log = (msg) => {
        const el = document.getElementById('log');
        el.textContent += `${new Date().toISOString()} | ${msg}\n`;
    };

    const client = mqtt.connect('wss://broker.hivemq.com:8884/mqtt', {
        clientId:       `browser-${Math.random().toString(16).slice(2, 10)}`,
        clean:          true,
        connectTimeout: 4000,
        reconnectPeriod: 2000,
    });

    client.on('connect', () => {
        log('Connesso al broker.');
        client.subscribe('plant/#', { qos: 1 }, (err) => {
            if (!err) log('Iscrizione attiva su plant/#');
        });
    });

    client.on('message', (topic, payload) => {
        let data;
        try { data = JSON.parse(payload.toString()); }
        catch { data = payload.toString(); }
        log(`[${topic}] ${JSON.stringify(data)}`);
    });

    client.on('error',     (err) => log(`ERRORE: ${err.message}`));
    client.on('reconnect', ()    => log('Riconnessione...'));
    client.on('offline',   ()    => log('Client offline.'));
    </script>
</body>
</html>
```

---

## 20. Casi Reali

Questa sezione analizza cinque scenari reali in cui MQTT ha rappresentato la scelta tecnologica determinante, con dettagli sull'implementazione e le motivazioni tecniche.

---

### 20.1 Facebook Messenger (2011)

Prima che Facebook sviluppasse soluzioni proprietarie, il team di Messenger adotto' MQTT per la consegna dei messaggi in tempo reale verso i client mobili.

**Problema**: Centinaia di milioni di dispositivi mobili, connessioni dati instabili, batterie da preservare, latenza da minimizzare.

**Perche' MQTT**: Rispetto al long-polling HTTP, MQTT eliminava il costo di apertura di una nuova connessione TCP per ogni messaggio ricevuto. La connessione TCP persistente, combinata con il meccanismo di keep-alive, permetteva al dispositivo di stare in ascolto consumando un minimo di banda e batteria.

**Impatto misurabile**: Il team riporto' una riduzione del consumo di dati di oltre il 50% rispetto al polling HTTP e una riduzione significativa della latenza di consegna nei mercati emergenti con reti 2G/3G.

**Struttura topic ipotetica**:
```
users/{user_id}/inbox
users/{user_id}/presence
conversations/{conversation_id}/messages
```

---

### 20.2 Amazon — AWS IoT Core

AWS IoT Core e' uno dei piu' grandi broker MQTT managed al mondo, progettato per gestire miliardi di messaggi al giorno provenienti da decine di milioni di dispositivi IoT.

**Architettura dichiarata da AWS**:

```
Dispositivo IoT
    |
    | TLS + mTLS (certificato X.509 per dispositivo)
    v
AWS IoT Core (MQTT Broker managed)
    |
    +--- AWS Lambda          (compute event-driven)
    +--- Amazon Kinesis      (stream processing)
    +--- Amazon S3           (archiviazione raw)
    +--- Amazon DynamoDB     (storage strutturato)
    +--- Amazon SNS/SQS      (notifiche e code)
    +--- Amazon Timestream   (time-series database)
```

**Funzionalita' specifiche di AWS IoT Core**:

- Device Shadow: ogni dispositivo ha un documento JSON (lo "shadow") che rappresenta il suo stato corrente e desiderato. Permette di inviare comandi a un dispositivo offline che verranno applicati alla successiva connessione.
- Fleet Provisioning: provisioning automatico di certificati e configurazione per nuovi dispositivi.
- Rules Engine: routing SQL-like dei messaggi MQTT verso i servizi AWS.

**Esempio di Device Shadow**:

```json
{
  "state": {
    "reported": {
      "temperature": 22.5,
      "firmware":    "3.1.2",
      "online":      true
    },
    "desired": {
      "firmware": "3.2.0"
    },
    "delta": {
      "firmware": "3.2.0"
    }
  },
  "metadata": { ... },
  "timestamp": 1700000000,
  "version":   47
}
```

Il dispositivo si iscrive a `$aws/things/{thing_name}/shadow/update/delta` e riceve automaticamente le differenze tra stato desiderato e riportato.

---

### 20.3 Industria 4.0 — Monitoraggio CNC in tempo reale

Un produttore europeo di componenti aeronautici ha implementato un sistema MQTT per il monitoraggio in tempo reale di 340 macchine CNC su 4 stabilimenti.

**Problema precedente**: Il sistema legacy raccoglieva dati via OPC-UA ogni 5 minuti. L'analisi dei guasti avveniva post-factum, con costi di fermo macchina elevati.

**Architettura implementata**:

```
340 macchine CNC
    |
    | OPC-UA (protocollo nativo macchine)
    v
Gateway Edge (per stabilimento)
    |
    | MQTT over TLS (WAN aziendale)
    v
EMQX Broker (cluster 3 nodi, on-premise datacenter)
    |
    +--- InfluxDB          (time-series: telemetria a 1Hz)
    +--- Kafka             (stream per ML pipeline)
    +--- Sistema alerting  (QoS 2 per allarmi critici)
    +--- Grafana           (dashboard operatori)
```

**Schema topic**:

```
plant/{plant_id}/line/{line_id}/machine/{machine_id}/spindle/rpm
plant/{plant_id}/line/{line_id}/machine/{machine_id}/spindle/load
plant/{plant_id}/line/{line_id}/machine/{machine_id}/axis/x/position
plant/{plant_id}/line/{line_id}/machine/{machine_id}/axis/y/position
plant/{plant_id}/line/{line_id}/machine/{machine_id}/coolant/temperature
plant/{plant_id}/line/{line_id}/machine/{machine_id}/alarms
plant/{plant_id}/line/{line_id}/machine/{machine_id}/status
```

**Configurazione QoS per tipo di dato**:

| Tipo dato | QoS | Frequenza | Motivazione |
|---|---|---|---|
| RPM, posizioni assi | 0 | 1 Hz | Alta frequenza, perdita accettabile |
| Temperatura, vibrazioni | 1 | 0.1 Hz | Rilevante, duplicati gestibili |
| Allarmi critici | 2 | Event-driven | Zero tolleranza per perdite |
| Comandi attuatori | 2 | On-demand | Zero tolleranza per duplicati |

**Risultato**: riduzione del MTTR (Mean Time To Repair) del 37% grazie all'individuazione anticipata delle anomalie tramite analisi delle vibrazioni in tempo reale.

---

### 20.4 Smart Metering — Enel X e reti AMI

Le reti AMI (Advanced Metering Infrastructure) utilizzano MQTT o protocolli derivati per la comunicazione bidirezionale tra milioni di contatori intelligenti e i sistemi di gestione.

**Sfida tecnica**: Il contatore smart comunica tipicamente via rete cellulare (NB-IoT o LTE-M), con connettivita' intermittente e costi di dati elevati. La latenza di consegna dei dati deve rispettare finestre temporali regolamentate.

**Struttura del payload del contatore**:

```json
{
  "meter_id":     "IT001E12345678",
  "timestamp":    "2024-01-15T10:30:00Z",
  "readings": {
    "active_energy_import":  12543.21,
    "active_energy_export":  0.0,
    "reactive_energy":       234.5,
    "instantaneous_power":   3.2,
    "voltage_L1":            231.4,
    "current_L1":            13.8
  },
  "quality_flags": {
    "estimated":        false,
    "clock_synced":     true,
    "tamper_detected":  false
  }
}
```

**Protocollo usato nella pratica**: DLMS/COSEM over MQTT e' lo stack comune, dove MQTT gestisce il trasporto mentre DLMS/COSEM definisce il modello dati del contatore.

**Direzione inversa — comandi al contatore**:

```
Subscription del contatore: meters/{meter_id}/commands/#

Comandi supportati:
  meters/{id}/commands/connect-disconnect   (intervento sull'alimentazione)
  meters/{id}/commands/firmware-update      (OTA update)
  meters/{id}/commands/read-on-demand       (lettura istantanea)
  meters/{id}/commands/config-tariff        (cambio piano tariffario)
```

---

### 20.5 Veicoli connessi — Flotta di trasporto pubblico

Un operatore di trasporto pubblico ha implementato un sistema MQTT per il monitoraggio in tempo reale di una flotta di 1.200 autobus.

**Requisiti**:
- Posizione GPS ogni 5 secondi (per l'infomobilita' ai passeggeri)
- Telemetria motore ogni 30 secondi (per manutenzione predittiva)
- Alert immediato per guasti critici (portiere, freni, motore)
- Comandi bidirezionali (aggiornamento display, apertura portiere)

**Struttura topic**:

```
fleet/{operator_id}/vehicle/{vehicle_id}/gps
fleet/{operator_id}/vehicle/{vehicle_id}/engine/telemetry
fleet/{operator_id}/vehicle/{vehicle_id}/passenger-count
fleet/{operator_id}/vehicle/{vehicle_id}/doors/status
fleet/{operator_id}/vehicle/{vehicle_id}/alerts
fleet/{operator_id}/vehicle/{vehicle_id}/commands
```

**Payload GPS** (minimizzato per ridurre i costi dati):

```json
{
  "lat":  45.4654,
  "lon":  9.1866,
  "spd":  42.3,
  "hdg":  187,
  "ts":   1700000000
}
```

**Configurazione QoS**:

```
GPS updates:      QoS 0  (alta frequenza, perdita accettabile)
Telemetria motore: QoS 1  (dati importanti per manutenzione)
Alert guasti:     QoS 2  (critico, nessuna perdita accettabile)
Comandi portiere: QoS 2  (critico, nessun duplicato accettabile)
```

**Gestione disconnessione in galleria o zona senza copertura**:

Con `clean_session = false` e QoS 1/2 per la telemetria critica, il broker accoda i messaggi durante la perdita di segnale. Al rientro in copertura, il veicolo riceve tutti i comandi in attesa (es. cambio percorso) e il broker riceve tutta la telemetria accumulata nel buffer locale del gateway bordo.

**Codice del gateway bordo veicolo** (pattern di accumulo locale):

```python
import paho.mqtt.client as mqtt
import json
import time
import collections

VEHICLE_ID = "BUS-1234"
BROKER     = "iot.transport-operator.it"

# Buffer locale per i messaggi da inviare
pending_messages = collections.deque(maxlen=500)
is_connected     = False

def on_connect(client, userdata, flags, rc):
    global is_connected
    if rc == 0:
        is_connected = True
        print(f"[INFO] Connesso. Svuotamento buffer ({len(pending_messages)} messaggi).")
        # Invia tutti i messaggi accumulati offline
        while pending_messages:
            topic, payload, qos = pending_messages.popleft()
            client.publish(topic, payload, qos=qos)
    else:
        is_connected = False

def on_disconnect(client, userdata, rc):
    global is_connected
    is_connected = False
    print(f"[WARN] Disconnesso (rc={rc}). Modalita' buffer attiva.")

def publish_or_buffer(topic, payload, qos=1):
    if is_connected:
        client.publish(topic, payload, qos=qos)
    else:
        pending_messages.append((topic, payload, qos))
        print(f"[BUFFER] Accumulato: {topic} ({len(pending_messages)} in coda)")

client = mqtt.Client(client_id=f"gw-{VEHICLE_ID}", clean_session=False)
client.on_connect    = on_connect
client.on_disconnect = on_disconnect
client.will_set(
    f"fleet/operator-01/vehicle/{VEHICLE_ID}/status",
    json.dumps({"status": "offline"}),
    qos=1, retain=True
)

client.connect_async(BROKER, 1883, keepalive=30)
client.loop_start()

# Loop principale del gateway
while True:
    gps_data     = get_gps_reading()      # lettura dal modulo GPS
    engine_data  = get_engine_telemetry() # lettura da CAN bus

    publish_or_buffer(
        f"fleet/operator-01/vehicle/{VEHICLE_ID}/gps",
        json.dumps(gps_data),
        qos=0  # GPS: QoS 0, alta frequenza
    )

    if time.time() % 30 < 1:
        publish_or_buffer(
            f"fleet/operator-01/vehicle/{VEHICLE_ID}/engine/telemetry",
            json.dumps(engine_data),
            qos=1
        )

    time.sleep(5)
```

---

## 21. Best Practices

### Progettazione dei topic

Una gerarchia di topic ben progettata e' la base di un sistema MQTT manutenibile. Le decisioni prese in fase di progetto sono difficilmente reversibili senza interrompere i client esistenti.

```
Raccomandazioni:

- Definire la gerarchia partendo dall'entita' piu' generale verso la piu' specifica
  Corretto:    plant/line-A/machine-01/sensor/temperature
  Scorretto:   temperature/plant/line-A/machine-01

- Usare identificatori univoci e stabili (ID dispositivo, numero seriale)
  Corretto:    devices/SN-29384756/telemetry
  Scorretto:   devices/my-sensor/telemetry   (non univoco)

- Separare i canali per tipo di traffico
  Corretto:    machine-01/telemetry    (dati del dispositivo verso il sistema)
               machine-01/commands     (comandi dal sistema verso il dispositivo)
               machine-01/status       (stato del dispositivo, retained)

- Non inserire dati variabili nei topic (timestamp, valori di misura)
  Scorretto:   sensors/temperature/22.5   (il valore appartiene al payload)

- Non inserire dati sensibili nei topic
  Scorretto:   users/mario.rossi@example.com/inbox   (PII nel topic)
```

### Progettazione del payload

```json
// Payload raccomandato: strutturato, autodescrittivo, con timestamp
{
  "value":     22.5,
  "unit":      "celsius",
  "quality":   "good",
  "device_id": "sensor-plant-a-01",
  "seq":       1247,
  "ts":        1700000000000
}
```

Il timestamp nel payload e' essenziale. Il timestamp di ricezione del broker non corrisponde al momento della misura, specialmente con dispositivi offline che inviano dati accumulati.

Per dispositivi con risorse molto limitate, considerare formati binari compatti come CBOR o MessagePack al posto di JSON. Un payload JSON di 80 byte puo' diventare 30 byte in CBOR.

### Client Identifier

```python
# Corretto: deterministico, basato sull'identita' del dispositivo
client_id = f"sensor-{device_serial_number}"

# Scorretto: casuale, rende impossibile la session persistence
client_id = f"client-{uuid.uuid4()}"
```

Un Client ID casuale significa che ogni riavvio crea una nuova sessione. I messaggi accodati per la sessione precedente vengono scartati dal broker.

### Selezione del QoS

Il QoS deve essere selezionato in base alla criticita' del dato, non per default. Usare QoS 2 per tutto e' un errore comune che degrada inutilmente il throughput.

```
QoS 0: dati campionati ad alta frequenza dove la perdita di un campione 
        e' tollerata (GPS ogni secondo, temperatura ogni 10 secondi)

QoS 1: dati importanti che possono essere processati in modo idempotente
        (aggiornamenti di stato, notifiche, letture contatori)

QoS 2: comandi che non devono essere eseguiti due volte o mai
        (apertura/chiusura valvole, avvio/arresto macchinari, 
         transazioni finanziarie)
```

---

## 22. Debugging e Troubleshooting

### Strumenti da riga di comando

```bash
# Subscriber universale: riceve tutto (eccetto $SYS)
mosquitto_sub -h localhost -t "#" -v

# Subscriber con autenticazione TLS
mosquitto_sub \
  -h secure.broker.internal \
  -p 8883 \
  --cafile /etc/ssl/certs/ca.crt \
  --cert   /etc/ssl/certs/client.crt \
  --key    /etc/ssl/private/client.key \
  -t "plant/#" -v

# Subscriber ai topic di sistema del broker
mosquitto_sub -h localhost -t '$SYS/#' -v

# Publisher di test con QoS e retain
mosquitto_pub \
  -h localhost \
  -t "devices/sensor-01/status" \
  -m '{"status": "online"}' \
  -q 1 \
  -r

# Publisher con file come payload
mosquitto_pub -h localhost -t "plant/line-A/config" -f config.json -q 2
```

### Problemi comuni e soluzioni

**Client che si disconnette e riconnette continuamente**

```
Cause probabili:
1. Client Identifier duplicato: un altro client usa lo stesso ID.
   Il broker disconnette il client piu' vecchio quando ne arriva uno nuovo.
   Verifica: controlla i log del broker per messaggi "client already connected".
   Soluzione: garantire unicita' degli ID.

2. Keep-alive troppo basso per la rete.
   La rete introduce latenza variabile e il broker scade il keep-alive.
   Soluzione: aumentare il valore di keep-alive (es. da 10 a 60 secondi).

3. Il broker rifiuta la connessione per ACL o credenziali.
   Il client si connette, viene disconnesso, riprova in loop.
   Verifica: controllare il CONNACK reason code nei log.
```

**Messaggi non recapitati**

```
Checklist:
[ ] Il topic della subscription corrisponde esattamente al topic di publish?
    Attenzione alle maiuscole/minuscole: MQTT e' case-sensitive.
    "Sensors/Temp" e "sensors/temp" sono topic diversi.

[ ] Le wildcard sono posizionate correttamente?
    "#" deve essere l'ultimo elemento: "a/b/#" e' valido, "a/#/b" non lo e'.

[ ] Il QoS del subscriber e' compatibile con il QoS del publisher?
    Il livello effettivo di consegna e' il minore tra i due.

[ ] Ci sono ACL sul broker che bloccano la subscription?
    Testare con un client amministratore senza restrizioni.

[ ] Il client e' effettivamente connesso? Verificare lo stato della sessione.
```

**Messaggi duplicati inattesi (QoS 1)**

```
QoS 1 garantisce "at least once". I duplicati sono parte della specifica.
Il consumer deve essere idempotente.

Strategie per l'idempotenza:
- Includere un sequence number nel payload e scartare i duplicati
- Usare l'upsert (insert-or-update) nel database invece dell'insert
- Mantenere un set degli ultimi N message ID gia' processati
- Per QoS 1 il broker assegna un Packet ID: verificare il DUP flag
```

### Logging con paho-mqtt

```python
import logging

# Abilita log completo del client paho
logging.basicConfig(level=logging.DEBUG)
client.enable_logger(logging.getLogger('paho.mqtt'))
```

### Strumenti GUI per il debug

- **MQTT Explorer** (mqtt-explorer.com): client grafico multi-piattaforma, visualizza la gerarchia dei topic in tempo reale, mostra i retained message, permette di pubblicare e ispezionare i payload.
- **MQTT.fx**: strumento desktop per test e debug, con supporto a script Groovy per automazione.
- **mqttx** (EMQX): client CLI e GUI moderno con supporto a MQTT 5.0 e script.

---

## 23. Glossario

| Termine | Definizione |
|---|---|
| ACL | Access Control List. Insieme di regole che definiscono i permessi di lettura e scrittura per topic e utenti. |
| Bridge | Configurazione che collega due broker MQTT, replicando i messaggi tra di essi. |
| Broker | Server centrale che riceve i messaggi dai publisher e li instrada ai subscriber. |
| Clean Session | Flag del CONNECT che controlla se il broker deve mantenere o eliminare lo stato della sessione alla disconnessione. |
| Client ID | Identificatore univoco di un client MQTT. Il broker lo usa per associare le sessioni persistenti. |
| CONNACK | Pacchetto di risposta del broker al CONNECT del client, contenente il codice di accettazione o rifiuto. |
| DUP Flag | Flag nel pacchetto PUBLISH che indica che si tratta di una ritrasmissione (QoS 1 o 2). |
| Fixed Header | Prima sezione di ogni pacchetto MQTT, obbligatoria, contenente tipo e lunghezza del pacchetto. |
| Keep Alive | Intervallo massimo in secondi tra due pacchetti consecutivi del client. Scaduto questo intervallo senza traffico, il broker considera il client disconnesso. |
| LWT | Last Will and Testament. Messaggio registrato al momento della connessione e pubblicato automaticamente dal broker in caso di disconnessione anomala del client. |
| mTLS | Mutual TLS. Variante di TLS in cui sia il server che il client si autenticano tramite certificato X.509. |
| Payload | Il contenuto informativo del messaggio MQTT. Puo' essere qualsiasi sequenza di byte. |
| PUBACK | Pacchetto di conferma per i messaggi QoS 1. |
| PUBCOMP | Quarto e ultimo pacchetto del four-way handshake QoS 2. Indica il completamento della consegna. |
| PUBREC | Secondo pacchetto del four-way handshake QoS 2. Indica che il broker ha ricevuto il messaggio. |
| PUBREL | Terzo pacchetto del four-way handshake QoS 2. Il publisher rilascia il messaggio. |
| QoS | Quality of Service. Definisce la garanzia di consegna: 0 (al piu' una volta), 1 (almeno una volta), 2 (esattamente una volta). |
| Retained Message | L'ultimo messaggio pubblicato su un topic con il flag retain=true. Il broker lo conserva e lo consegna immediatamente ai nuovi subscriber. |
| Session | L'insieme dello stato mantenuto dal broker per un client: subscription attive e messaggi QoS 1/2 in attesa. |
| Shared Subscription | Funzionalita' MQTT 5.0 che permette il bilanciamento del carico tra piu' subscriber su uno stesso topic. |
| SUBACK | Pacchetto di conferma dell'iscrizione a uno o piu' topic, con i livelli QoS effettivamente concessi. |
| Topic | Stringa UTF-8 gerarchica che identifica un canale di comunicazione. Usa "/" come separatore di livello. |
| Topic Alias | Funzionalita' MQTT 5.0 che sostituisce una stringa topic con un intero numerico per ridurre l'overhead. |
| User Properties | Coppie chiave-valore arbitrarie che possono essere aggiunte ai pacchetti MQTT 5.0 per trasportare metadati. |
| Wildcard | Carattere speciale utilizzabile nelle subscription. "+" sostituisce un singolo livello, "#" uno o piu' livelli. |

---

## Riferimenti e letture consigliate

- MQTT 3.1.1 Specification — OASIS Standard (docs.oasis-open.org)
- MQTT 5.0 Specification — OASIS Standard (docs.oasis-open.org)
- Eclipse Paho — Librerie client ufficiali multi-linguaggio (eclipse.org/paho)
- HiveMQ MQTT Essentials — Serie di articoli tecnici (hivemq.com/mqtt-essentials)
- Mosquitto Documentation — Configurazione broker e bridge (mosquitto.org)
- AWS IoT Core Developer Guide — Device Shadow e Fleet Provisioning (docs.aws.amazon.com)
- EMQX Documentation — Clustering e scalabilita' (docs.emqx.com)

---

*Versione 2.0 — Febbraio 2026*
