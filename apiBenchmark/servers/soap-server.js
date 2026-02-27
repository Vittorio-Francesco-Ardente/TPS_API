/**
 * SOAP Server - Port 3003
 * Espone un Web Service SOAP per gestione utenti e prodotti.
 * Usa il pacchetto 'soap' per Node.js.
 */
const express = require('express');
const soap = require('soap');
const bodyParser = require('body-parser');
const http = require('http');

const app = express();
app.use(bodyParser.raw({ type: () => true, limit: '5mb' }));

// ─── WSDL DEFINITION ─────────────────────────────────────────────────────────
const wsdl = `
<definitions name="UserService"
  xmlns="http://schemas.xmlsoap.org/wsdl/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:tns="http://localhost/UserService"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  targetNamespace="http://localhost/UserService">

  <types>
    <xsd:schema targetNamespace="http://localhost/UserService">
      <xsd:element name="GetUsersRequest">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetUsersResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="users" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetUserByIdRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="id" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="GetUserByIdResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="user" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="CreateUserRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="name" type="xsd:string"/>
            <xsd:element name="email" type="xsd:string"/>
            <xsd:element name="age" type="xsd:int"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="CreateUserResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="result" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="HealthCheckRequest">
        <xsd:complexType>
          <xsd:sequence/>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="HealthCheckResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="status" type="xsd:string"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>

  <message name="GetUsersInput">
    <part name="parameters" element="tns:GetUsersRequest"/>
  </message>
  <message name="GetUsersOutput">
    <part name="parameters" element="tns:GetUsersResponse"/>
  </message>
  <message name="GetUserByIdInput">
    <part name="parameters" element="tns:GetUserByIdRequest"/>
  </message>
  <message name="GetUserByIdOutput">
    <part name="parameters" element="tns:GetUserByIdResponse"/>
  </message>
  <message name="CreateUserInput">
    <part name="parameters" element="tns:CreateUserRequest"/>
  </message>
  <message name="CreateUserOutput">
    <part name="parameters" element="tns:CreateUserResponse"/>
  </message>
  <message name="HealthCheckInput">
    <part name="parameters" element="tns:HealthCheckRequest"/>
  </message>
  <message name="HealthCheckOutput">
    <part name="parameters" element="tns:HealthCheckResponse"/>
  </message>

  <portType name="UserServicePortType">
    <operation name="GetUsers">
      <input message="tns:GetUsersInput"/>
      <output message="tns:GetUsersOutput"/>
    </operation>
    <operation name="GetUserById">
      <input message="tns:GetUserByIdInput"/>
      <output message="tns:GetUserByIdOutput"/>
    </operation>
    <operation name="CreateUser">
      <input message="tns:CreateUserInput"/>
      <output message="tns:CreateUserOutput"/>
    </operation>
    <operation name="HealthCheck">
      <input message="tns:HealthCheckInput"/>
      <output message="tns:HealthCheckOutput"/>
    </operation>
  </portType>

  <binding name="UserServiceSoapBinding" type="tns:UserServicePortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="GetUsers">
      <soap:operation soapAction="GetUsers"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="GetUserById">
      <soap:operation soapAction="GetUserById"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="CreateUser">
      <soap:operation soapAction="CreateUser"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="HealthCheck">
      <soap:operation soapAction="HealthCheck"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>

  <service name="UserService">
    <port name="UserServicePort" binding="tns:UserServiceSoapBinding">
      <soap:address location="http://localhost:3003/soap"/>
    </port>
  </service>
</definitions>
`;

// ─── SERVICE IMPLEMENTATION ───────────────────────────────────────────────────
const users = [
  { id: 1, name: 'Alice Rossi', email: 'alice@example.com', age: 30 },
  { id: 2, name: 'Mario Bianchi', email: 'mario@example.com', age: 25 },
];

const serviceImpl = {
  UserService: {
    UserServicePort: {
      GetUsers: function(args) {
        return { users: JSON.stringify(users) };
      },
      GetUserById: function(args) {
        const user = users.find(u => u.id === parseInt(args.id));
        return { user: user ? JSON.stringify(user) : JSON.stringify({ error: 'Not found' }) };
      },
      CreateUser: function(args) {
        const newUser = {
          id: users.length + 1,
          name: args.name,
          email: args.email,
          age: parseInt(args.age) || 0
        };
        users.push(newUser);
        return { result: JSON.stringify({ success: true, data: newUser }) };
      },
      HealthCheck: function(args) {
        return { status: JSON.stringify({ status: 'ok', server: 'SOAP', timestamp: new Date().toISOString() }) };
      }
    }
  }
};

// ─── HTTP ENDPOINT per api-benchmark (SOAP via POST) ─────────────────────────
// api-benchmark fa richieste HTTP, il server SOAP risponde a POST /soap
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'SOAP', wsdl: 'http://localhost:3003/soap?wsdl' });
});

const PORT = 3003;
const server = http.createServer(app);

server.listen(PORT, () => {
  // Aggancia il server SOAP a Express
  soap.listen(server, '/soap', serviceImpl, wsdl, () => {
    console.log(`✅ SOAP Server avviato su http://localhost:${PORT}/soap`);
    console.log(`   WSDL: http://localhost:${PORT}/soap?wsdl`);
    console.log(`   Operazioni: GetUsers, GetUserById, CreateUser, HealthCheck`);
  });
});
