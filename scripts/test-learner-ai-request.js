/**
 * Test script for Learner AI MS request to Skills Engine
 * 
 * This script tests the request that Learner AI sends to Skills Engine
 * to get leaf skills (MGS) for competencies.
 * 
 * Usage:
 *   node scripts/test-learner-ai-request.js
 * 
 * Or with custom competencies:
 *   node scripts/test-learner-ai-request.js "Python Programming" "Data Analysis"
 */

const http = require('http');

// Default port (change if your server runs on a different port)
const PORT = process.env.PORT || 3000;
const HOST = 'localhost';

// Get competencies from command line arguments or use defaults
const competencies = process.argv.slice(2).length > 0 
  ? process.argv.slice(2)
  : ['Python Programming', 'Data Analysis']; // Default test competencies

// Request payload matching the Learner AI format
const requestBody = JSON.stringify({
  requester_service: 'learnerAi',
  payload: {
    competencies: competencies
  },
  response: {}
});

const options = {
  hostname: HOST,
  port: PORT,
  path: '/api/fill-content-metrics/',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestBody)
  }
};

console.log('🧪 Testing Learner AI MS Request to Skills Engine');
console.log('='.repeat(60));
console.log(`📍 Endpoint: http://${HOST}:${PORT}/api/fill-content-metrics/`);
console.log(`📋 Requester Service: learnerAi`);
console.log(`📝 Competencies: ${competencies.join(', ')}`);
console.log('='.repeat(60));
console.log('\n📤 Request Body:');
console.log(JSON.stringify(JSON.parse(requestBody), null, 2));
console.log('\n⏳ Sending request...\n');

const req = http.request(options, (res) => {
  let responseData = '';

  console.log(`📊 Response Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`📋 Response Headers:`, res.headers);
  console.log('\n📥 Response Body:');

  res.on('data', (chunk) => {
    responseData += chunk;
  });

  res.on('end', () => {
    try {
      const parsed = JSON.parse(responseData);
      console.log(JSON.stringify(parsed, null, 2));
      
      // Pretty print the response
      if (parsed.response) {
        console.log('\n✅ Response Summary:');
        if (parsed.response.competencies) {
          console.log('\n📚 Competencies Breakdown:');
          Object.keys(parsed.response.competencies).forEach(compName => {
            const mgs = parsed.response.competencies[compName];
            if (mgs.error) {
              console.log(`  ❌ ${compName}: ${mgs.error}`);
            } else {
              console.log(`  ✅ ${compName}: ${Array.isArray(mgs) ? mgs.length : 0} MGS found`);
              if (Array.isArray(mgs) && mgs.length > 0) {
                console.log(`     Skills: ${mgs.map(s => s.skill_name || s.name || 'N/A').join(', ')}`);
              }
            }
          });
        }
        if (parsed.response.nodes) {
          console.log(`\n📦 Total Nodes (all MGS): ${parsed.response.nodes.length}`);
        }
      }
    } catch (e) {
      console.log(responseData);
      console.error('\n❌ Failed to parse response as JSON:', e.message);
    }
  });
});

req.on('error', (error) => {
  console.error(`\n❌ Request Error: ${error.message}`);
  console.error('\n💡 Make sure the Skills Engine server is running:');
  console.error(`   cd backend && npm start`);
  process.exit(1);
});

req.write(requestBody);
req.end();

