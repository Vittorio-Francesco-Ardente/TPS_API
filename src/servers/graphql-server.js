/**
 * GraphQL Server - Port 3002
 * Rotte esposte:
 *   GET  /health   → health check HTTP
 *   POST /graphql  → endpoint GraphQL con:
 *       Query    : products { id name price stock category }
 *       Mutation : createProduct(name, price, stock, category, description)
 *
 * Il campo 'description' nella mutation è il padding per payload variabile.
 * Viene accettato dallo schema, passato al resolver, ma NON salvato nel DB.
 */
const express        = require('express');
const { graphqlHTTP } = require('express-graphql');
const os             = require('os');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLBoolean,
} = require('graphql');

const NUM_CORES = os.cpus().length;

const cors = require('cors');
const app = express();
app.use(cors());

// ─── DATABASE IN-MEMORY ───────────────────────────────────────────────────────
let users = [
  { id: 1, name: 'Alice Rossi',   email: 'alice@example.com',  age: 30, role: 'admin' },
  { id: 2, name: 'Mario Bianchi', email: 'mario@example.com',  age: 25, role: 'user'  },
  { id: 3, name: 'Sara Verdi',    email: 'sara@example.com',   age: 28, role: 'user'  },
];

let products = [
  { id: 1, name: 'Laptop Pro',     price: 1299.99, stock: 50,  category: 'tech' },
  { id: 2, name: 'Mouse Wireless', price: 29.99,   stock: 200, category: 'tech' },
  { id: 3, name: 'Scrivania Oak',  price: 349.00,  stock: 15,  category: 'home' },
];

// ─── GRAPHQL TYPES ────────────────────────────────────────────────────────────
const ProductType = new GraphQLObjectType({
  name: 'Product',
  fields: {
    id:       { type: GraphQLInt    },
    name:     { type: GraphQLString },
    price:    { type: GraphQLFloat  },
    stock:    { type: GraphQLInt    },
    category: { type: GraphQLString },
  }
});

const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id:    { type: GraphQLInt    },
    name:  { type: GraphQLString },
    email: { type: GraphQLString },
    age:   { type: GraphQLInt    },
    role:  { type: GraphQLString },
  }
});

const StatsType = new GraphQLObjectType({
  name: 'Stats',
  fields: {
    totalUsers:    { type: GraphQLInt    },
    totalProducts: { type: GraphQLInt    },
    timestamp:     { type: GraphQLString },
  }
});

// MutationResult esteso: include receivedBytes e descriptionLen per debug
const MutationResultType = new GraphQLObjectType({
  name: 'MutationResult',
  fields: {
    success:        { type: GraphQLBoolean },
    message:        { type: GraphQLString  },
    id:             { type: GraphQLInt     },
    receivedBytes:  { type: GraphQLInt     },  // dimensione payload ricevuto
    descriptionLen: { type: GraphQLInt     },  // lunghezza del padding
  }
});

// ─── ROOT QUERY ───────────────────────────────────────────────────────────────
const RootQuery = new GraphQLObjectType({
  name: 'Query',
  fields: {

    // ── GET equivalente: lista prodotti ──────────────────────────────────────
    products: {
      type: new GraphQLList(ProductType),
      resolve: () => products
    },

    product: {
      type: ProductType,
      args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_, { id }) => products.find(p => p.id === id)
    },

    // ── mantenute per compatibilità ───────────────────────────────────────────
    users: {
      type: new GraphQLList(UserType),
      resolve: () => users
    },

    stats: {
      type: StatsType,
      resolve: () => ({
        totalUsers:    users.length,
        totalProducts: products.length,
        timestamp:     new Date().toISOString()
      })
    },
  }
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────
const RootMutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {

    // ── POST equivalente: createProduct con payload variabile ─────────────────
    // 'description' è il campo di padding — accettato dallo schema GraphQL ma
    // NON salvato nel DB. Serve esclusivamente a variare la dimensione del body.
    createProduct: {
      type: MutationResultType,
      args: {
        name:        { type: new GraphQLNonNull(GraphQLString) },
        price:       { type: new GraphQLNonNull(GraphQLFloat)  },
        stock:       { type: GraphQLInt    },
        category:    { type: GraphQLString },
        description: { type: GraphQLString },  // ← campo padding
      },
      resolve: (_, args) => {
        const newProduct = {
          id:       products.length + 1,
          name:     args.name,
          price:    args.price,
          stock:    args.stock    || 0,
          category: args.category || 'general',
          // description esclusa dal record salvato
        };
        products.push(newProduct);

        return {
          success:        true,
          message:        'Prodotto creato',
          id:             newProduct.id,
          receivedBytes:  JSON.stringify(args).length,
          descriptionLen: args.description ? args.description.length : 0,
        };
      }
    },

    // ── mantenute per compatibilità ───────────────────────────────────────────
    createUser: {
      type: MutationResultType,
      args: {
        name:  { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) },
        age:   { type: GraphQLInt    },
        role:  { type: GraphQLString },
      },
      resolve: (_, args) => {
        const newUser = {
          id:    users.length + 1,
          name:  args.name,
          email: args.email,
          age:   args.age  || 0,
          role:  args.role || 'user'
        };
        users.push(newUser);
        return { success: true, message: 'Utente creato', id: newUser.id, receivedBytes: 0, descriptionLen: 0 };
      }
    },
  }
});

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const schema = new GraphQLSchema({ query: RootQuery, mutation: RootMutation });

// ─── EXPRESS ──────────────────────────────────────────────────────────────────
app.use('/graphql', graphqlHTTP({
  schema,
  graphiql: true,
  customFormatErrorFn: (err) => ({
    message:   err.message,
    locations: err.locations,
    path:      err.path
  })
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'GraphQL', endpoint: '/graphql' });
});

// ─── METRICS ──────────────────────────────────────────────────────────────────
// Stessa logica del REST server: campionamento delta CPU + memoria istantanea.
// Vedi commento nel rest-server.js per la spiegazione completa.
let _lastCpuUsage = process.cpuUsage();
let _lastCpuTime  = Date.now();

app.get('/metrics', (req, res) => {
  const mem       = process.memoryUsage();
  const now       = Date.now();
  const cpuDelta  = process.cpuUsage(_lastCpuUsage);
  const elapsedMs = now - _lastCpuTime || 1;

  const cpuUserPct   = (cpuDelta.user   / (elapsedMs * 1000 * NUM_CORES)) * 100;
  const cpuSystemPct = (cpuDelta.system / (elapsedMs * 1000 * NUM_CORES)) * 100;

  _lastCpuUsage = process.cpuUsage();
  _lastCpuTime  = now;

  res.json({
    server: 'GraphQL',
    timestamp: now,
    cores: NUM_CORES,
    memory: {
      rss:       +(mem.rss       / 1048576).toFixed(2),
      heapTotal: +(mem.heapTotal / 1048576).toFixed(2),
      heapUsed:  +(mem.heapUsed  / 1048576).toFixed(2),
      external:  +(mem.external  / 1048576).toFixed(2),
    },
    cpu: {
      userPct:   +cpuUserPct.toFixed(2),
      systemPct: +cpuSystemPct.toFixed(2),
      totalPct:  +(cpuUserPct + cpuSystemPct).toFixed(2),
    },
  });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = 3002;
app.listen(PORT, () => {
  console.log(`✅ GraphQL Server avviato su http://localhost:${PORT}/graphql`);
  console.log(`   Query    : products, product(id), users, stats`);
  console.log(`   Mutation : createProduct(name,price,stock,category,description*)`);
  console.log(`              * 'description' = campo padding per payload variabile`);
});

module.exports = app;
