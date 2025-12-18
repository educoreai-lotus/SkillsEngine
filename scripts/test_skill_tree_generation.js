/**
 * Test Script for Skill Tree Generation
 * 
 * This script helps test the automatic skill tree generation feature
 * for last-level competencies that have no skills linked.
 * 
 * Usage:
 *   node scripts/test_skill_tree_generation.js <competency_id>
 *   OR
 *   node scripts/test_skill_tree_generation.js <competency_name>
 */

// Support running from root or backend directory
const path = require('path');
const backendPath = path.join(__dirname, '..', 'backend');
const srcPath = path.join(backendPath, 'src');

// Try to require from backend directory first (if running from root)
let competencyService, competencyRepository;
try {
  competencyService = require(path.join(srcPath, 'services', 'competencyService'));
  competencyRepository = require(path.join(srcPath, 'repositories', 'competencyRepository'));
} catch (err) {
  // If that fails, try relative to backend directory (if running from backend)
  try {
    competencyService = require('./src/services/competencyService');
    competencyRepository = require('./src/repositories/competencyRepository');
  } catch (err2) {
    // Last try: from root
    competencyService = require('../backend/src/services/competencyService');
    competencyRepository = require('../backend/src/repositories/competencyRepository');
  }
}

async function testSkillTreeGeneration(competencyIdentifier) {
  try {
    console.log('\n=== Testing Skill Tree Generation ===\n');
    
    // Step 1: Find the competency
    let competency;
    if (competencyIdentifier.includes('-')) {
      // Looks like a UUID
      competency = await competencyRepository.findById(competencyIdentifier);
    } else {
      // Looks like a name
      competency = await competencyRepository.findByName(competencyIdentifier);
    }

    if (!competency) {
      console.error(`❌ Competency not found: ${competencyIdentifier}`);
      return;
    }

    console.log(`✅ Found competency: ${competency.competency_name} (ID: ${competency.competency_id})\n`);

    // Step 2: Check if it's a leaf node
    const children = await competencyRepository.findChildren(competency.competency_id);
    const isLeafNode = !children || children.length === 0;
    
    console.log(`📊 Competency Status:`);
    console.log(`   - Has children: ${children && children.length > 0 ? 'Yes' : 'No'} (${children?.length || 0} children)`);
    console.log(`   - Is leaf node: ${isLeafNode ? 'Yes ✅' : 'No ❌'}\n`);

    // Step 3: Check if it has skills linked
    const linkedSkills = await competencyRepository.getLinkedSkills(competency.competency_id);
    const hasSkills = linkedSkills && linkedSkills.length > 0;
    
    console.log(`📊 Skills Status:`);
    console.log(`   - Linked skills: ${linkedSkills?.length || 0}`);
    console.log(`   - Has skills: ${hasSkills ? 'Yes ✅' : 'No ❌'}\n`);

    // Step 4: Determine if skill tree generation will trigger
    const willGenerate = isLeafNode && !hasSkills;
    
    if (willGenerate) {
      console.log(`🎯 Skill tree generation WILL trigger automatically!\n`);
      console.log(`   Conditions met:`);
      console.log(`   ✅ Competency is a leaf node (no children)`);
      console.log(`   ✅ Competency has no skills linked\n`);
    } else {
      console.log(`⚠️  Skill tree generation will NOT trigger:\n`);
      if (!isLeafNode) {
        console.log(`   ❌ Competency has children (not a leaf node)`);
      }
      if (hasSkills) {
        console.log(`   ❌ Competency already has ${linkedSkills.length} skill(s) linked`);
      }
      console.log(``);
    }

    // Step 5: Call getRequiredMGS (this will trigger generation if conditions are met)
    console.log(`🔄 Calling getRequiredMGS()...\n`);
    const startTime = Date.now();
    const mgs = await competencyService.getRequiredMGS(competency.competency_id);
    const duration = Date.now() - startTime;

    console.log(`✅ Completed in ${duration}ms\n`);

    // Step 6: Check results
    console.log(`📊 Results:`);
    console.log(`   - Total MGS found: ${mgs.length}`);
    
    if (mgs.length > 0) {
      console.log(`   - Sample MGS (first 5):`);
      mgs.slice(0, 5).forEach((m, i) => {
        console.log(`     ${i + 1}. ${m.skill_name} (${m.skill_id})`);
      });
      if (mgs.length > 5) {
        console.log(`     ... and ${mgs.length - 5} more`);
      }
    }

    // Step 7: Re-check skills after generation
    if (willGenerate) {
      console.log(`\n🔄 Re-checking linked skills after generation...\n`);
      const newLinkedSkills = await competencyRepository.getLinkedSkills(competency.competency_id);
      console.log(`   - Linked skills now: ${newLinkedSkills?.length || 0}`);
      
      if (newLinkedSkills && newLinkedSkills.length > 0) {
        console.log(`   - Sample linked skills (first 5):`);
        newLinkedSkills.slice(0, 5).forEach((s, i) => {
          console.log(`     ${i + 1}. ${s.skill_name} (${s.skill_id})`);
        });
        if (newLinkedSkills.length > 5) {
          console.log(`     ... and ${newLinkedSkills.length - 5} more`);
        }
      }
    }

    console.log(`\n✅ Test completed successfully!\n`);

  } catch (error) {
    console.error(`\n❌ Error during test:`, error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Main execution
const competencyIdentifier = process.argv[2];

if (!competencyIdentifier) {
  console.error(`
Usage:
  node scripts/test_skill_tree_generation.js <competency_id>
  OR
  node scripts/test_skill_tree_generation.js <competency_name>

Example:
  node scripts/test_skill_tree_generation.js python
  node scripts/test_skill_tree_generation.js 123e4567-e89b-12d3-a456-426614174000
  `);
  process.exit(1);
}

testSkillTreeGeneration(competencyIdentifier)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

