/**
 * SOAP Server - Port 3006
 * Endpoints:
 *   GET /health
 *   GET /metrics
 *   SOAP /soap?wsdl + operation CreateProduct
 */

const express = require('express');
const http = require('http');
const os = require('os');
const soap = require('soap');

const NUM_CORES = os.cpus().length;
const PORT = 3006;

const app = express();

const db = {
	products: [
		{ id: 1, name: 'Laptop Pro', price: 1299.99, stock: 50, category: 'tech' },
		{ id: 2, name: 'Mouse Wireless', price: 29.99, stock: 200, category: 'tech' },
		{ id: 3, name: 'Scrivania Oak', price: 349.0, stock: 15, category: 'home' },
	],
};

let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

app.get('/health', (_req, res) => {
	res.json({ status: 'ok', server: 'SOAP', wsdl: '/soap?wsdl' });
});

app.get('/metrics', (_req, res) => {
	const mem = process.memoryUsage();
	const now = Date.now();
	const cpuDelta = process.cpuUsage(lastCpuUsage);
	const elapsedMs = now - lastCpuTime || 1;

	const cpuUserPct = (cpuDelta.user / (elapsedMs * 1000 * NUM_CORES)) * 100;
	const cpuSystemPct = (cpuDelta.system / (elapsedMs * 1000 * NUM_CORES)) * 100;

	lastCpuUsage = process.cpuUsage();
	lastCpuTime = now;

	res.json({
		server: 'SOAP',
		timestamp: now,
		cores: NUM_CORES,
		memory: {
			rss: +(mem.rss / 1048576).toFixed(2),
			heapTotal: +(mem.heapTotal / 1048576).toFixed(2),
			heapUsed: +(mem.heapUsed / 1048576).toFixed(2),
			external: +(mem.external / 1048576).toFixed(2),
		},
		cpu: {
			userPct: +cpuUserPct.toFixed(2),
			systemPct: +cpuSystemPct.toFixed(2),
			totalPct: +(cpuUserPct + cpuSystemPct).toFixed(2),
		},
	});
});

const service = {
	BenchmarkService: {
		BenchmarkPort: {
			CreateProduct(args) {
				const newProduct = {
					id: db.products.length + 1,
					name: args.name || 'Prodotto Bench',
					price: Number(args.price ?? 0),
					stock: Number(args.stock ?? 0),
					category: args.category || 'general',
				};

				db.products.push(newProduct);

				return {
					success: true,
					id: newProduct.id,
					message: 'Prodotto creato',
					receivedBytes: JSON.stringify(args || {}).length,
					notesLen: typeof args.notes === 'string' ? args.notes.length : 0,
				};
			},
		},
	},
};

const wsdl = `<?xml version="1.0" encoding="UTF-8"?>
<definitions
	name="BenchmarkService"
	targetNamespace="http://benchmark.example.com/soap"
	xmlns:tns="http://benchmark.example.com/soap"
	xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
	xmlns:xsd="http://www.w3.org/2001/XMLSchema"
	xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/">

	<types>
		<xsd:schema targetNamespace="http://benchmark.example.com/soap">
			<xsd:element name="CreateProductRequest">
				<xsd:complexType>
					<xsd:sequence>
						<xsd:element name="name" type="xsd:string" minOccurs="0" />
						<xsd:element name="price" type="xsd:double" minOccurs="0" />
						<xsd:element name="stock" type="xsd:int" minOccurs="0" />
						<xsd:element name="category" type="xsd:string" minOccurs="0" />
						<xsd:element name="notes" type="xsd:string" minOccurs="0" />
					</xsd:sequence>
				</xsd:complexType>
			</xsd:element>

			<xsd:element name="CreateProductResponse">
				<xsd:complexType>
					<xsd:sequence>
						<xsd:element name="success" type="xsd:boolean" />
						<xsd:element name="id" type="xsd:int" />
						<xsd:element name="message" type="xsd:string" />
						<xsd:element name="receivedBytes" type="xsd:int" />
						<xsd:element name="notesLen" type="xsd:int" />
					</xsd:sequence>
				</xsd:complexType>
			</xsd:element>
		</xsd:schema>
	</types>

	<message name="CreateProductInput">
		<part name="parameters" element="tns:CreateProductRequest" />
	</message>

	<message name="CreateProductOutput">
		<part name="parameters" element="tns:CreateProductResponse" />
	</message>

	<portType name="BenchmarkPortType">
		<operation name="CreateProduct">
			<input message="tns:CreateProductInput" />
			<output message="tns:CreateProductOutput" />
		</operation>
	</portType>

	<binding name="BenchmarkBinding" type="tns:BenchmarkPortType">
		<soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http" />
		<operation name="CreateProduct">
			<soap:operation soapAction="CreateProduct" />
			<input>
				<soap:body use="literal" />
			</input>
			<output>
				<soap:body use="literal" />
			</output>
		</operation>
	</binding>

	<service name="BenchmarkService">
		<port name="BenchmarkPort" binding="tns:BenchmarkBinding">
			<soap:address location="http://localhost:${PORT}/soap" />
		</port>
	</service>
</definitions>`;

const server = http.createServer(app);
soap.listen(server, '/soap', service, wsdl);

server.listen(PORT, () => {
	console.log(`✅ SOAP Server avviato su http://localhost:${PORT}`);
	console.log('   GET /health');
	console.log('   GET /metrics');
	console.log('   WSDL: http://localhost:3006/soap?wsdl');
	console.log('   SOAP operation: CreateProduct');
});

