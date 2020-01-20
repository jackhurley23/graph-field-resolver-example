const express = require('express');
const fetch = require('isomorphic-unfetch');
const DataLoader = require('dataloader');
const { ApolloServer, gql } = require('apollo-server-express');

const PORT = 4000;
const URI = `http://localhost:${PORT}`;

// The loader enables efficient batching of individual requests in to one call.
const personLoader = new DataLoader(keys => fetchPersonBatch(keys));

// Helper function to call a single person
const fetchPerson = id =>
  fetch(`${URI}/legacy-person?id=${id}`).then(res => res.json());

// Helper function to batch together multiple person calls
const fetchPersonBatch = ids =>
  fetch(`${URI}/legacy-persons-batch?ids=${ids}`).then(res => res.json());

// Get a person via the dataloader so graphql can batch the queries efficiently
const getPerson = id => personLoader.load(id);

// Resolvers define the technique for fetching the types defined in the
// schema. This resolver retrieves books from the "books" array above.
const resolvers = {
  Query: {
    // Top level resolver
    persons: (_, args, ctx) => {
      /**
       * This is where the search query will be made.  Uncomment the 'full' search to see the behaviour once things are fully migrated
       */

      // return fetch(`${URI}/search-full`).then(res => res.json());
      return fetch(`${URI}/search-partial`).then(res => res.json());
    }
  },
  Person: {
    // Field level resolver
    emailCount: (person, args, ctx) => {
      if (person.emailCount) {
        // If the intial call (search result) already resolves this field it will exist on the parent (first arg, 'person' in this example) object.
        // If it exists just return it so we don't go off to the legacy system unnecessarily
        return person.emailCount;
      }

      console.log('[email count resolver] id:', person.id);

      // Fetch the person from the legacy endpoint and then resolve/map the field, dealing with any funny nesting or renaming
      // These calls all get batched together. And multiple fields to the same object get deduped by dataloader
      return getPerson(person.id).then(data => data.weird.nesting.emailCount);
    },
    // Field level resolver
    noteCount: (person, args, ctx) => {
      if (person.noteCount) {
        // If the intial call (search result) already resolves this field it will exist on the parent (first arg, 'person' in this example) object.
        // If it exists just return it so we don't go off to the legacy system unnecessarily
        return person.noteCount;
      }

      console.log('[note count resolver] id:', person.id);

      // Fetch the person from the legacy endpoint and then resolve/map the field, dealing with any funny nesting or renaming
      // These calls all get batched together. And multiple fields to the same object get deduped by dataloader
      return getPerson(person.id).then(data => data.notes.noteCount);
    },
    // Field level resolver
    attachmentCount: (person, args, ctx) => {
      if (person.attachmentCount) {
        // If the intial call (search result) already resolves this field it will exist on the parent (first arg, 'person' in this example) object.
        // If it exists just return it so we don't go off to the legacy system unnecessarily
        return person.attachmentCount;
      }

      console.log('[attachment count resolver] id:', person.id);

      // Fetch the person from the legacy endpoint and then resolve/map the field, dealing with any funny nesting or renaming
      // These calls all get batched together. And multiple fields to the same object get deduped by dataloader
      return getPerson(person.id).then(data => data.renamedAttachmentCount);
    }
  }
};

// The graph schema
const typeDefs = gql`
  type Person {
    id: ID!
    firstName: String!
    lastName: String!

    emailCount: Int!
    noteCount: Int!
    attachmentCount: Int!
  }

  type Query {
    persons: [Person!]!
  }
`;

const server = new ApolloServer({ typeDefs, resolvers });

const app = express();
server.applyMiddleware({ app });

/**
 * SEARCH-PARTIAL
 * This is an example of a search api result as we begin to migrate data and only have a few fields in the elastic search instance
 * It only resolves an id, a first name and a last name.
 * But no email count, note count, attachment count
 */

app.get('/search-partial', (req, res) => {
  console.log(`[NETWORK REQUEST: SEARCH-PARTIAL]`);
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id => {
    return createPartialPerson(id);
  });

  res.json(data);
});

/**
 * SEARCH-PARTIAL
 * This is an example of a search api result once everything has been mapped across.
 * It resolves everything we need and in the shape of the graph schema (this isn't required but means that we don't need to do any transformations)
 */

app.get('/search-full', (req, res) => {
  console.log(`[NETWORK REQUEST: SEARCH-FULL]`);
  const data = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(id => {
    return createFullPersonIdeal(id);
  });

  res.json(data);
});

/**
 * LEGACY-PERSON
 * This is an example of a legacy endpoint to resolve a person.
 * It has all the data we need but in 'strange' nesting that needs to be transformed etc.
 * This endpoint also has a batched version that can be called. (See below)
 */
app.get('/legacy-person', (req, res) => {
  const id = req.query['id'];

  console.log(`[NETWORK REQUEST: LEGACY-PERSON]: id=${id}`);

  const data = createFullPersonLegacy(Number(id));

  res.json(data);
});

/**
 * LEGACY-PERSON batch
 * This is an example of a legacy endpoint to resolve a person with comma seperated query.
 * It has all the data we need but in 'strange' nesting that needs to be transformed etc.
 * This endpoint also has a batched version that can be called. (See below)
 */
app.get('/legacy-persons-batch', (req, res) => {
  const query = req.query['ids'];

  console.log(`[NETWORK REQUEST: LEGACY-PERSON-BATCH]: ids=${query}`);

  const ids = query.split(',');

  const data = ids.map(id => {
    return createFullPersonLegacy(Number(id));
  });

  res.json(data);
});

app.listen({ port: PORT }, () =>
  console.log(
    `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`
  )
);

//// DATA UTILS:

/**
 *
 * An example of a 'partial' person that would be returned from the search api before all the data is migrated
 */
const createPartialPerson = id => ({
  id,
  firstName: `firstName-${id}`,
  lastName: `lastName-${id}`
});

/**
 *
 * An example of a full person that would be returned from a legacy endpoint that doesn't quite have the schema we like.
 */
const createFullPersonLegacy = id => ({
  id,
  firstName: `firstName-${id}`,
  lastName: `lastName-${id}`,
  weird: {
    nesting: {
      emailCount: 100 + id
    }
  },
  notes: {
    noteCount: 200 + id
  },
  renamedAttachmentCount: 300 + id
});

/**
 *
 * An example of a 'full' person that would be returned from the search api ONCE all the data is migrated
 */
const createFullPersonIdeal = id => ({
  id,
  firstName: `firstName-${id}`,
  lastName: `lastName-${id}`,
  emailCount: 100 + id,
  noteCount: 200 + id,
  attachmentCount: 300 + id
});
