import 'dotenv/config';
import { CosmosClient } from '@azure/cosmos';

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.COSMOS_DATABASE_ID || 'ghost-dev';

let client;
let database;

export function getDatabase() {
  if (!endpoint || !key) {
    throw new Error('COSMOS_ENDPOINT and COSMOS_KEY must be configured.');
  }
  if (!client) {
    client = new CosmosClient({ endpoint, key });
    database = client.database(databaseId);
  }
  return database;
}

export function container(name) {
  return getDatabase().container(name);
}
