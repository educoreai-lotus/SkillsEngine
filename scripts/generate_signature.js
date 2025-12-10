#!/usr/bin/env node

/**
 * Helper script to generate ECDSA signature headers for Coordinator requests.
 *
 * Usage:
 *   node scripts/generate_signature.js body.json skills-engine-private.pem
 *
 * Where:
 *   - body.json is a file containing the exact JSON you will send in the HTTP body
 *   - skills-engine-private.pem is the EC private key used by Skills Engine
 *
 * This script always signs as:
 *   serviceName = "skills-engine-service"
 *
 * Output:
 *   - X-Service-Name: skills-engine-service
 *   - X-Signature:    <base64-signature>
 */

const fs = require('fs');
const path = require('path');
const { generateSignature } = require('../backend/src/utils/signature');

async function main() {
    const [, , bodyPath, keyPath] = process.argv;

    if (!bodyPath || !keyPath) {
        console.error('Usage: node scripts/generate_signature.js <body.json> <skills-engine-private.pem>');
        process.exit(1);
    }

    const serviceName = 'skills-engine-service';

    let bodyRaw;
    let privateKeyRaw;
    try {
        const fullPath = path.resolve(bodyPath);
        bodyRaw = fs.readFileSync(fullPath, 'utf8');
    } catch (err) {
        console.error(`Failed to read body file: ${err.message}`);
        process.exit(1);
    }

    try {
        const keyFullPath = path.resolve(keyPath);
        privateKeyRaw = fs.readFileSync(keyFullPath, 'utf8');
    } catch (err) {
        console.error(`Failed to read private key file: ${err.message}`);
        process.exit(1);
    }

    let body;
    try {
        body = JSON.parse(bodyRaw);
    } catch (err) {
        console.error(`Body file does not contain valid JSON: ${err.message}`);
        process.exit(1);
    }

    try {
        const signature = generateSignature(serviceName, privateKeyRaw, body);

        console.log('Use these headers in your HTTP request:');
        console.log('');
        console.log(`X-Service-Name: ${serviceName}`);
        console.log(`X-Signature: ${signature}`);
    } catch (err) {
        console.error(`Failed to generate signature: ${err.message}`);
        process.exit(1);
    }
}

main();


