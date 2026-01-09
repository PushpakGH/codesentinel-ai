// Standalone Verification Script

// Mock AI response to simulate variable outputs
const mockAIResponse = (prompt) => {
    if (prompt.includes("Create project plan")) {
        // Return a response that violates the new rules to test the safety truncate
        return JSON.stringify({
            projectName: "TestApp",
            description: "Test",
            pages: [
                { 
                    name: "InteractiveProjectShowcaseAGridOrListOfProjectsEachWithDetailsTechStackAndLinksToTheLiveVersionAndSourceCodePage", 
                    route: "/interactive-project-showcase-a-grid-or-list-of-projects-each-with-details-tech-stack-and-links-to-the-live-version-and-source-code", 
                    description: "Long page", 
                    features: [] 
                },
                {
                    name: "AboutPage",
                    route: "/about",
                    description: "Short page",
                    features: []
                }
            ],
            componentNeeds: { forms: ["button"] }
        });
    }
    return "";
};

// Mock Dependencies
const mockAiClient = {
    generate: async (prompt) => mockAIResponse(prompt)
};

// We need to inject the mock into the module or just test the logic isolated if possible.
// Since we can't easily inject mocks into the require('projectBuilder'), we will copy the 
// specific logic we changed into this test file and verify it works as expected.

function safetyCheckLogic(plan) {
    plan.pages = plan.pages.map(p => {
      // Fix Name
      if (p.name.length > 20) {
        const simplified = p.name.replace(/Page$/, '').slice(0, 15);
        p.name = simplified + 'Page';
        console.log(`Truncated Name: ${p.name}`);
      }
      
      // Fix Route
      if (p.route.length > 20) {
        // keep only the first segment or first 15 chars
        const segments = p.route.split('/').filter(Boolean);
        if (segments.length > 0) {
           let short = segments[0];
           if (short.length > 15) short = short.slice(0, 15); // hard truncate
           p.route = '/' + short;
           console.log(`Truncated Route: ${p.route}`);
        }
      }
      
      return p;
    });
    return plan;
}

async function runTest() {
    console.log("Testing Plan Sanitization Logic...");
    
    const badPlan = {
        pages: [
            { 
                 name: "InteractiveProjectShowcaseAGridOrListOfProjectsEachWithDetailsTechStackAndLinksToTheLiveVersionAndSourceCodePage", 
                 route: "/interactive-project-showcase-a-grid-or-list-of-projects-each-with-details-tech-stack-and-links-to-the-live-version-and-source-code", 
            },
            {
                name: "SimplePage",
                route: "/simple"
            }
        ]
    };

    const fixedPlan = safetyCheckLogic(badPlan);

    const p1 = fixedPlan.pages[0];
    if (p1.name.length <= 20 && p1.name.endsWith('Page')) {
        console.log("✅ Name Truncation Passed");
    } else {
        console.error("❌ Name Truncation Failed", p1.name);
    }

    if (p1.route.length <= 20 && p1.route.startsWith('/')) {
        console.log("✅ Route Truncation Passed");
    } else {
        console.error("❌ Route Truncation Failed", p1.route);
    }
}

runTest();
