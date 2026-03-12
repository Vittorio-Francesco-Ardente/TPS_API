# SOAP API

## Introduzione

**SOAP (Simple Object Access Protocol)** è un protocollo standard utilizzato per lo scambio di informazioni strutturate tra applicazioni in una rete.  
È stato progettato per permettere la comunicazione tra sistemi distribuiti indipendentemente dal linguaggio di programmazione, dal sistema operativo o dalla piattaforma utilizzata.

SOAP è stato sviluppato alla fine degli anni '90 ed è stato successivamente standardizzato dal **W3C (World Wide Web Consortium)**.  
Il protocollo è ampiamente utilizzato nella realizzazione di **Web Services** in ambienti enterprise, dove sono richiesti standard rigorosi, affidabilità e sicurezza.

A differenza di altre tecnologie più moderne, SOAP non è semplicemente uno stile architetturale ma un **protocollo completo**, con regole precise su come devono essere strutturati i messaggi e su come devono essere gestite le comunicazioni tra client e server.

Il protocollo utilizza messaggi **XML** per strutturare le informazioni e può funzionare sopra diversi protocolli di trasporto, anche se nella pratica viene utilizzato principalmente con **HTTP o HTTPS**.

---

# Storia e contesto

SOAP nasce in un periodo in cui le aziende avevano la necessità di far comunicare sistemi diversi tra loro.

Negli anni 2000 molte applicazioni aziendali erano:

- sviluppate in linguaggi diversi
- eseguite su sistemi operativi differenti
- distribuite su infrastrutture separate

Per risolvere questo problema sono stati introdotti i **Web Services**, che permettono alle applicazioni di comunicare tramite protocolli standardizzati.

SOAP è diventato uno dei protocolli principali utilizzati per implementare questi servizi.

Per diversi anni è stato lo **standard dominante per le API aziendali**, prima della diffusione delle architetture REST.

Ancora oggi è molto utilizzato in settori come:

- sistemi bancari
- servizi finanziari
- integrazioni tra software aziendali
- pubbliche amministrazioni
- sistemi legacy

---

# A cosa serve SOAP

SOAP viene utilizzato per permettere la **comunicazione tra applicazioni remote** attraverso una rete.

Le applicazioni possono scambiarsi informazioni tramite messaggi strutturati e inviare richieste per eseguire operazioni su un server remoto.

Tra i principali utilizzi troviamo:

- integrazione tra sistemi aziendali
- comunicazione tra servizi in architetture distribuite
- implementazione di servizi web interoperabili
- scambio di dati tra applicazioni sviluppate con tecnologie diverse

Una delle caratteristiche fondamentali di SOAP è la sua **interoperabilità**.  
Questo significa che un'applicazione scritta in un linguaggio può comunicare con un'altra scritta in un linguaggio completamente diverso.

Ad esempio:

- un client sviluppato in **Java**
- può comunicare con un server sviluppato in **C#**
- tramite messaggi SOAP.

---

# Architettura e modello di comunicazione

SOAP segue generalmente un modello **client-server**.

Il processo di comunicazione può essere descritto nel seguente modo:

1. Il **client** invia una richiesta SOAP al server.
2. La richiesta contiene un messaggio XML con l’operazione da eseguire.
3. Il **server** riceve il messaggio e lo interpreta.
4. Il server esegue l’operazione richiesta.
5. Il server restituisce una **risposta SOAP** al client.

Schema semplificato della comunicazione:
Client -> Richiesta SOAP (XML) -> Server -> Elaborazione della richiesta -> Risposta SOAP (XML) -> Client


---

# Struttura di un messaggio SOAP

Un messaggio SOAP è un documento **XML** con una struttura ben definita.

Gli elementi principali sono:

- Envelope
- Header
- Body
- Fault (opzionale)

## Envelope

L'elemento **Envelope** rappresenta il contenitore principale del messaggio SOAP.

Definisce:

- l'inizio del messaggio
- la struttura del documento
- lo spazio dei nomi SOAP utilizzato

Tutti i messaggi SOAP devono essere racchiusi all'interno dell'Envelope.

---

## Header

L'elemento **Header** è opzionale e contiene informazioni aggiuntive relative al messaggio.

Può includere dati come:

- autenticazione
- sicurezza
- gestione delle transazioni
- informazioni di routing

L'header è particolarmente utile nei sistemi complessi dove è necessario gestire diversi livelli di controllo sulla comunicazione.

---

## Body

Il **Body** contiene il contenuto principale del messaggio.

All'interno del body vengono inserite:

- le operazioni richieste
- i parametri necessari
- i dati restituiti dal server

Il body è la parte fondamentale della richiesta SOAP.

---

## Fault

Il **Fault** è un elemento utilizzato per gestire gli errori.

Se durante l'elaborazione della richiesta si verifica un problema, il server restituisce un messaggio SOAP contenente informazioni sull'errore.

Questo consente al client di capire cosa è andato storto e come gestire la situazione.

---

# Esempio di messaggio SOAP

Di seguito è riportato un esempio semplificato di richiesta SOAP.

```xml
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
   <soap:Header>
   </soap:Header>

   <soap:Body>
      <getUser>
         <id>10</id>
      </getUser>
   </soap:Body>
</soap:Envelope>
