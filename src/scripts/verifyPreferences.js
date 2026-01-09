const { UniversalRegistry } = require('../registry/registryIndex');

async function testPreferences() {
  console.log('🧪 Testing Component Discovery Preferences...');

  // Mock Discovery Logic (Simplified from projectBuilder.js)
  async function mockDiscover(componentName, style, preferredLibs) {
    console.log(`\n🔍 Searching for "${componentName}" (Style: ${style}, Prefs: ${preferredLibs})`);
    
    let bestMatch = null;
    let highestScore = 0;

    // 1. Primary Search
    if (preferredLibs && preferredLibs.length > 0) {
      for (const lib of preferredLibs) {
        const matches = UniversalRegistry.findBestMatch(componentName, style, lib);
        if (matches.length > 0) {
          const top = matches[0];
          console.log(`   > [${lib}] Match: ${top.registry}/${top.name} (Score: ${top.score.toFixed(2)})`);
          if (top.score > highestScore) {
            highestScore = top.score;
            bestMatch = top;
          }
        }
      }
    }

    // 2. Secondary Search
    if (!bestMatch || highestScore < 10) {
      console.log('   > Fallback search...');
      const matches = UniversalRegistry.findBestMatch(componentName, style);
      if (matches.length > 0) {
         const top = matches[0];
         console.log(`   > [General] Match: ${top.registry}/${top.name} (Score: ${top.score.toFixed(2)})`);
         if (top.score > highestScore) {
           bestMatch = top;
         }
      }
    }

    if (bestMatch) {
      console.log(`✅ WINNER: ${bestMatch.registry}/${bestMatch.name}`);
    } else {
      console.log(`❌ NO MATCH`);
    }
  }

  // Test Cases
  await mockDiscover('Hero', 'creative', ['aceternity']);
  await mockDiscover('Button', 'minimal', ['aceternity']); // Should fallback to shadcn
  await mockDiscover('Card', 'creative', ['magicui']);
  await mockDiscover('Navbar', 'animated', ['magicui', 'shadcn']);
}

testPreferences().catch(console.error);
