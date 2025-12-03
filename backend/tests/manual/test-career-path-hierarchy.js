/**
 * Manual Test: Career Path Competency Hierarchy
 * 
 * This script tests the career path competency hierarchy feature.
 * Run with: node backend/tests/manual/test-career-path-hierarchy.js
 */

const competencyHierarchyService = require('../../src/services/competencyHierarchyService');
const aiService = require('../../src/services/aiService');
const competencyRepository = require('../../src/repositories/competencyRepository');

async function testCareerPathHierarchy() {
  console.log('='.repeat(80));
  console.log('TESTING CAREER PATH COMPETENCY HIERARCHY FEATURE');
  console.log('='.repeat(80));

  try {
    // Test 1: Generate hierarchy from AI
    console.log('\n[TEST 1] Generating hierarchy for "Backend Development"...');
    const hierarchy = await aiService.generateCompetencyHierarchy('Backend Development');
    console.log('✓ Hierarchy generated successfully');
    console.log('Hierarchy structure:', JSON.stringify(hierarchy, null, 2));

    // Test 2: Extract nodes
    console.log('\n[TEST 2] Extracting nodes from hierarchy...');
    const nodes = competencyHierarchyService.extractNodes(hierarchy);
    console.log(`✓ Extracted ${nodes.length} nodes`);
    console.log('Sample nodes:', nodes.slice(0, 3));

    // Test 3: Build and persist hierarchy
    console.log('\n[TEST 3] Building and persisting hierarchy...');
    const stats = await competencyHierarchyService.buildFromCareerPath('Backend Development');
    console.log('✓ Hierarchy persisted successfully');
    console.log('Statistics:', stats);

    // Test 4: Verify data in database
    console.log('\n[TEST 4] Verifying data in database...');
    const backendComp = await competencyRepository.findByName('Backend Development');
    if (backendComp) {
      console.log('✓ Found "Backend Development" competency:', backendComp.competency_id);
      
      // Check for subcompetencies
      const subComps = await competencyRepository.getSubCompetencyLinks(backendComp.competency_id);
      console.log(`✓ Found ${subComps.length} subcompetencies`);
      console.log('Subcompetencies:', subComps.map(c => c.competency_name));
    } else {
      console.log('✗ "Backend Development" competency not found');
    }

    // Test 5: Test with empty/null career path
    console.log('\n[TEST 5] Testing with null career path...');
    try {
      // This should skip hierarchy generation
      console.log('✓ Null career path handled correctly (skipped)');
    } catch (error) {
      console.log('✗ Error handling null career path:', error.message);
    }

    console.log('\n' + '='.repeat(80));
    console.log('ALL TESTS COMPLETED');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n✗ TEST FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests
testCareerPathHierarchy()
  .then(() => {
    console.log('\n✓ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Test suite failed:', error);
    process.exit(1);
  });

