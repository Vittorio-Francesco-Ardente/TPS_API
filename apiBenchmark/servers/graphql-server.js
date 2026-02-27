/**
 * GraphQL Server - Port 3004
 * Espone un endpoint GraphQL con query e mutation per users e products.
 */
const express = require('express');
const { graphqlHTTP } = require('express-graphql');
const {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLList,
  GraphQLNonNull,
  GraphQLBoolean
} = require('graphql');

const app = express();

// ─── DATABASE IN-MEMORY ───────────────────────────────────────────────────────
let users = [
  { id: 1, name: 'Alice Rossi',   email: 'alice@example.com',  age: 30, role: 'admin' },
  { id: 2, name: 'Mario Bianchi', email: 'mario@example.com',  age: 25, role: 'user'  },
  { id: 3, name: 'Sara Verdi',    email: 'sara@example.com',   age: 28, role: 'user'  },
];

let products = [
  { id: 1, name: 'Laptop Pro',      price: 1299.99, stock: 50,  category: 'tech'  },
  { id: 2, name: 'Mouse Wireless',  price: 29.99,   stock: 200, category: 'tech'  },
  { id: 3, name: 'Scrivania Oak',   price: 349.00,  stock: 15,  category: 'home'  },
];

// ─── GRAPHQL TYPES ────────────────────────────────────────────────────────────
const UserType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id:    { type: GraphQLInt },
    name:  { type: GraphQLString },
    email: { type: GraphQLString },
    age:   { type: GraphQLInt },
    role:  { type: GraphQLString },
  }
});

const ProductType = new GraphQLObjectType({
  name: 'Product',
  fields: {
    id:       { type: GraphQLInt },
    name:     { type: GraphQLString },
    price:    { type: GraphQLFloat },
    stock:    { type: GraphQLInt },
    category: { type: GraphQLString },
  }
});

const StatsType = new GraphQLObjectType({
  name: 'Stats',
  fields: {
    totalUsers:    { type: GraphQLInt },
    totalProducts: { type: GraphQLInt },
    timestamp:     { type: GraphQLString },
  }
});

const MutationResultType = new GraphQLObjectType({
  name: 'MutationResult',
  fields: {
    success: { type: GraphQLBoolean },
    message: { type: GraphQLString },
    id:      { type: GraphQLInt },
  }
});

// ─── ROOT QUERY ───────────────────────────────────────────────────────────────
const RootQuery = new GraphQLObjectType({
  name: 'Query',
  fields: {
    // Tutti gli utenti
    users: {
      type: new GraphQLList(UserType),
      resolve: () => users
    },
    // Utente per ID
    user: {
      type: UserType,
      args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_, { id }) => users.find(u => u.id === id)
    },
    // Tutti i prodotti
    products: {
      type: new GraphQLList(ProductType),
      resolve: () => products
    },
    // Prodotto per ID
    product: {
      type: ProductType,
      args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_, { id }) => products.find(p => p.id === id)
    },
    // Statistiche globali
    stats: {
      type: StatsType,
      resolve: () => ({
        totalUsers: users.length,
        totalProducts: products.length,
        timestamp: new Date().toISOString()
      })
    },
    // Ricerca utenti per ruolo
    usersByRole: {
      type: new GraphQLList(UserType),
      args: { role: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: (_, { role }) => users.filter(u => u.role === role)
    },
    // Prodotti per categoria
    productsByCategory: {
      type: new GraphQLList(ProductType),
      args: { category: { type: new GraphQLNonNull(GraphQLString) } },
      resolve: (_, { category }) => products.filter(p => p.category === category)
    }
  }
});

// ─── MUTATIONS ────────────────────────────────────────────────────────────────
const RootMutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    createUser: {
      type: MutationResultType,
      args: {
        name:  { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) },
        age:   { type: GraphQLInt },
        role:  { type: GraphQLString },
      },
      resolve: (_, args) => {
        const newUser = {
          id: users.length + 1,
          name: args.name,
          email: args.email,
          age: args.age || 0,
          role: args.role || 'user'
        };
        users.push(newUser);
        return { success: true, message: 'Utente creato', id: newUser.id };
      }
    },
    deleteUser: {
      type: MutationResultType,
      args: { id: { type: new GraphQLNonNull(GraphQLInt) } },
      resolve: (_, { id }) => {
        const idx = users.findIndex(u => u.id === id);
        if (idx === -1) return { success: false, message: 'Non trovato', id };
        users.splice(idx, 1);
        return { success: true, message: 'Utente eliminato', id };
      }
    },
    createProduct: {
      type: MutationResultType,
      args: {
        name:     { type: new GraphQLNonNull(GraphQLString) },
        price:    { type: new GraphQLNonNull(GraphQLFloat) },
        stock:    { type: GraphQLInt },
        category: { type: GraphQLString },
      },
      resolve: (_, args) => {
        const newProduct = {
          id: products.length + 1,
          name: args.name,
          price: args.price,
          stock: args.stock || 0,
          category: args.category || 'general'
        };
        products.push(newProduct);
        return { success: true, message: 'Prodotto creato', id: newProduct.id };
      }
    }
  }
});

// ─── SCHEMA ───────────────────────────────────────────────────────────────────
const schema = new GraphQLSchema({
  query: RootQuery,
  mutation: RootMutation
});

// ─── EXPRESS ──────────────────────────────────────────────────────────────────
app.use('/graphql', graphqlHTTP({
  schema,
  graphiql: true,  // interfaccia web di debug
  customFormatErrorFn: (err) => ({
    message: err.message,
    locations: err.locations,
    path: err.path
  })
}));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'GraphQL', endpoint: '/graphql' });
});

const PORT = 3004;
app.listen(PORT, () => {
  console.log(`✅ GraphQL Server avviato su http://localhost:${PORT}/graphql`);
  console.log(`   GraphiQL IDE: http://localhost:${PORT}/graphql`);
  console.log(`   Query: users, user(id), products, product(id), stats`);
  console.log(`   Mutations: createUser, deleteUser, createProduct`);
});

module.exports = app;
