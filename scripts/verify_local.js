#!/usr/bin/env node

/**
 * Helper script to verify an ECDSA signature locally using the same logic
 * as the Coordinator.
 *
 * Usage:
 *   node scripts/verify_local.js body.json skills-engine-public.pem "<base64-signature>"
 *
 * Where:
 *   - body.json is the exact JSON you used for the HTTP request body
 *   - skills-engine-public.pem is the EC public key for skills-engine-service
 *   - "<base64-signature>" is the X-Signature value you sent in the request
 *
 * The script assumes the service name is "skills-engine-service" to match
 * scripts/generate_signature.js. If you need to test another service name,
 * set SERVICE_NAME in the environment.
 */

const fs = require('fs');
const path = require('path');
const { verifySignature } = require('../backend/src/utils/signature');

async function main() {
  const [, , bodyPath, publicKeyPath, signatureArg] = process.argv;

  if (!bodyPath || !publicKeyPath || !signatureArg) {
    console.error(
      'Usage: node scripts/verify_local.js <body.json> <public-key.pem> "<base64-signature>"'
    );
    process.exit(1);
  }

  const serviceName = process.env.SERVICE_NAME || 'skills-engine-service';

  let bodyRaw;
  let publicKeyRaw;

  try {
    const fullBodyPath = path.resolve(bodyPath);
    bodyRaw = fs.readFileSync(fullBodyPath, 'utf8');
  } catch (err) {
    console.error(`Failed to read body file: ${err.message}`);
    process.exit(1);
  }

  try {
    const fullPubKeyPath = path.resolve(publicKeyPath);
    publicKeyRaw = fs.readFileSync(fullPubKeyPath, 'utf8');
  } catch (err) {
    console.error(`Failed to read public key file: ${err.message}`);
    process.exit(1);
  }

  let body;
  try {
    body = JSON.parse(bodyRaw);
  } catch (err) {
    console.error(`Body file does not contain valid JSON: ${err.message}`);
    process.exit(1);
  }

  const signature = signatureArg.trim();

  try {
    const isValid = verifySignature(serviceName, publicKeyRaw, body, signature);

    console.log(`Service Name : ${serviceName}`);
    console.log(`Body File   : ${bodyPath}`);
    console.log(`Public Key  : ${publicKeyPath}`);
    console.log(`Signature   : ${signature.substring(0, 16)}...`);
    console.log('');
    console.log(`Verification result: ${isValid ? 'VALID ✅' : 'INVALID ❌'}`);

    process.exit(isValid ? 0 : 1);
  } catch (err) {
    console.error(`Verification error: ${err.message}`);
    process.exit(1);
  }
}

main();


