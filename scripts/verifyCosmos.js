import { CosmosClient } from '@azure/cosmos';
import { containerDefinitions, databaseId, requireCosmosEnv } from './cosmosConfig.js';

requireCosmosEnv();

const client = new CosmosClient({ endpoint: process.env.COSMOS_ENDPOINT, key: process.env.COSMOS_KEY });

async function main() {
  const database = client.database(databaseId);
  console.log(`Verifying database: ${databaseId}`);

  for (const definition of containerDefinitions) {
    const container = database.container(definition.id);
    const { resource } = await container.read();
    const query = 'SELECT VALUE COUNT(1) FROM c';
    const { resources } = await container.items.query(query).fetchAll();
    console.log(`✓ ${resource.id}: ${resources[0]} items`);
  }
}

main().catch((error) => {
  console.error('Verification failed.');
  console.error(error);
  process.exit(1);
});
