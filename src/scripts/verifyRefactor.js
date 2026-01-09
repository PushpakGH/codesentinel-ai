const { UniversalRegistry } = require('../registry/registryIndex');
const fs = require('fs');
const path = require('path');

async function verify() {
  console.log('--- Verification Step 1: Data Quality ---');
  const aceternityPath = path.join(__dirname, '../registry/data/aceternity.json');
  const aceternity = JSON.parse(fs.readFileSync(aceternityPath, 'utf-8'));
  const bento = aceternity.components.find(c => c.name === 'bento-grid');
  
  if (bento.tags && bento.tags.length > 0 && bento.useCase) {
    console.log('✅ PASS: aceternity.json has tags and useCase.');
    console.log('Tags:', bento.tags);
  } else {
    console.error('❌ FAIL: aceternity.json missing enriched data.');
  }

  console.log('\n--- Verification Step 2: Bias/Search Check ---');
  
  // Test 1: Animated Card
  console.log('Query: "animated card" (Style: animated)');
  const results1 = UniversalRegistry.findBestMatch('animated card', 'animated');
  const top1 = results1[0];
  console.log(`Top result: ${top1.name} (${top1.registry}) - Score: ${top1.score}`);
  
  if (['aceternity', 'magicui', 'motion-primitives'].includes(top1.registry)) {
     console.log('✅ PASS: Correctly favored animated library.');
  } else {
     console.log(`❌ FAIL: Favored ${top1.registry} instead.`);
  }

  // Test 2: Minimal Button
  console.log('\nQuery: "button" (Style: minimal)');
  const results2 = UniversalRegistry.findBestMatch('button', 'minimal');
  const top2 = results2[0];
  console.log(`Top result: ${top2.name} (${top2.registry}) - Score: ${top2.score}`);
  
  if (top2.registry === 'shadcn' || top2.registry === 'daisyui') {
     console.log('✅ PASS: Correctly favored minimal library.');
  } else {
     console.log(`❌ FAIL: Favored ${top2.registry} instead.`);
  }

  // Test 3: Hero Section (Creative)
  console.log('\nQuery: "hero section" (Style: creative)');
  const results3 = UniversalRegistry.findBestMatch('hero section', 'creative');
  const top3 = results3[0];
  console.log(`Top result: ${top3.name} (${top3.registry}) - Score: ${top3.score}`);
  
  if (['aceternity', 'magicui'].includes(top3.registry)) {
    console.log('✅ PASS: Correctly favored creative library for hero.');
  } else {
    console.log(`❌ FAIL: Favored ${top3.registry} instead.`);
  }
}

verify().catch(console.error);
