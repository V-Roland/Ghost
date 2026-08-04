import { CosmosClient } from '@azure/cosmos';
import { containerDefinitions, databaseId, requireCosmosEnv, throughput } from './cosmosConfig.js';

requireCosmosEnv();

const client = new CosmosClient({
  endpoint: process.env.COSMOS_ENDPOINT,
  key: process.env.COSMOS_KEY
});

async function main() {
  console.log(`Initializing Cosmos DB database: ${databaseId}`);

  const { database } = await client.databases.createIfNotExists({ id: databaseId });

  for (const definition of containerDefinitions) {
    const containerRequest = {
      id: definition.id,
      partitionKey: {
        paths: [definition.partitionKey],
        kind: 'Hash'
      }
    };

    if (definition.uniqueKeyPolicy) {
      containerRequest.uniqueKeyPolicy = definition.uniqueKeyPolicy;
    }

    const { container } = await database.containers.createIfNotExists(containerRequest, { offerThroughput: throughput });
    console.log(`✓ Container ready: ${container.id} | partitionKey=${definition.partitionKey}`);
  }

  console.log('Cosmos DB initialization complete.');
}

main().catch((error) => {
  console.error('Cosmos DB initialization failed.');
  console.error(error);
  process.exit(1);
});
