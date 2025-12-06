const path = require('path');
// Load backend/.env so this script sees the same variables as src/index.js
require('dotenv').config({
  path: path.join(__dirname, '..', '..', '.env')
});

const axios = require('axios');
const migrationTemplate = require('./migrationTemplate.json');
const { generateSignature } = require('../utils/signature');
const Logger = require('../utils/logger');

const SERVICE_NAME = process.env.SERVICE_NAME || 'skills-engine-service';
const logger = new Logger('CoordinatorMigrationOnce');

/**
 * One-off script to send the migrationTemplate to Coordinator:
 *   POST /register/:serviceId/migration
 *
 * Usage from project root:
 *   node backend/src/registration/sendMigrationOnce.js <serviceId>
 */
async function main() {
  const coordinatorUrl = process.env.COORDINATOR_URL;
  const privateKey =
    process.env.COORDINATOR_PRIVATE_KEY || process.env.SKILLS_ENGINE_PRIVATE_KEY;
  const serviceId = process.argv[2];

  if (!serviceId) {
    throw new Error('Usage: node backend/src/registration/sendMigrationOnce.js <serviceId>');
  }
  if (!coordinatorUrl) {
    throw new Error('COORDINATOR_URL environment variable is required');
  }
  if (!privateKey) {
    throw new Error(
      'COORDINATOR_PRIVATE_KEY (or SKILLS_ENGINE_PRIVATE_KEY) environment variable is required'
    );
  }

  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  const url = `${cleanCoordinatorUrl}/register/${serviceId}/migration`;

  // Body is exactly the migration file wrapper: { migrationFile: { ... } }
  const body = migrationTemplate;

  // Sign the full body exactly like in registration
  const signature = generateSignature(SERVICE_NAME, privateKey, body);

  logger.info('Sending migration to Coordinator', { url, serviceId });

  const response = await axios.post(url, body, {
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Name': SERVICE_NAME,
      'X-Signature': signature
    },
    timeout: 30000
  });

  logger.info('Migration response from Coordinator', {
    status: response.status,
    data: response.data
  });

  // Also print to stdout for convenience
  // eslint-disable-next-line no-console
  console.log('Status:', response.status);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(response.data, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Migration failed:', err.message);
    if (err.response) {
      // eslint-disable-next-line no-console
      console.error('Response:', err.response.status, err.response.data);
    }
    process.exit(1);
  });
}

module.exports = { main };


