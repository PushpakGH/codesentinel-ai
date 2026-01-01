# Component Registry Documentation

This directory contains the component registry system that powers the Project Builder feature.

## 📁 Directory Structure

\`\`\`
registry/
├── registryIndex.js      # Master list of all registries
├── registryTools.js      # AI function calling tools
├── registryFetcher.js    # Dynamic fetching with fallback
├── data/                 # Embedded component data
│   ├── shadcn.json
│   ├── daisyui.json
│   ├── magicui.json
│   └── aceternity.json
└── README.md            # This file
\`\`\`

## 🔄 How It Works

1. **AI Discovery**: Agent calls \`listRegistries()\` to see available libraries
2. **Component Browse**: Agent calls \`listComponents(registryId)\` to see what's available
3. **Installation**: Agent calls \`installComponents()\` which runs \`npx shadcn add\`
4. **Project Building**: Agent uses installed components to build the project

## ➕ Adding a New Registry

### Step 1: Add Registry Metadata

Edit \`registryIndex.js\` and add to \`AVAILABLE_REGISTRIES\`:

\`\`\`javascript
{
  id: 'your-registry',
  name: 'Your Registry Name',
  namespace: '@your-namespace',  // or null for official
  type: 'component-based',       // or 'animated', 'interactive', etc.
  cli: 'npx shadcn@latest add',
  website: 'https://your-registry.com',
  description: 'Your registry description',
  totalComponents: 50,
  categories: ['forms', 'navigation'],
  supported: true
}
\`\`\`

### Step 2: Create Component Data File

Create \`data/your-registry.json\`:

\`\`\`json
{
  "name": "Your Registry Name",
  "components": [
    {
      "name": "button",
      "category": "forms",
      "description": "A button component",
      "dependencies": ["@radix-ui/react-slot"],
      "files": ["components/ui/button.tsx"],
      "usage": "className='btn'",
      "example": "<button className='btn'>Click</button>"
    }
  ]
}
\`\`\`

### Step 3: Add to Registry Components Map

In \`registryIndex.js\`, add to \`REGISTRY_COMPONENTS\`:

\`\`\`javascript
'your-registry': require('./data/your-registry.json').components
\`\`\`

### Step 4: Test

\`\`\`javascript
const { listRegistries, listComponents } = require('./registryTools');

// Should show your registry
console.log(listRegistries());

// Should show your components
console.log(listComponents('your-registry'));
\`\`\`

## 🔄 Updating Existing Registries

### Option 1: Manual Update (Recommended for now)

1. Check the registry's documentation
2. Update \`data/registry-name.json\`
3. Test with \`listComponents('registry-name')\`

### Option 2: Dynamic Fetching (For registries with APIs)

If the registry has a public API:

1. Add endpoint to \`registryFetcher.js\`:

\`\`\`javascript
const REGISTRY_ENDPOINTS = {
  'your-registry': 'https://api.your-registry.com/components.json'
};
\`\`\`

2. Test fetching:

\`\`\`javascript
const { fetchComponentList } = require('./registryFetcher');
const components = await fetchComponentList('your-registry');
\`\`\`

## 🛠️ Adding New Tools

To add a new tool that AI can call:

### Step 1: Implement the Function

In \`registryTools.js\`:

\`\`\`javascript
function yourNewTool(param1, param2) {
  // Your implementation
  return result;
}
\`\`\`

### Step 2: Add Tool Definition

In \`getRegistryToolDefinitions()\`:

\`\`\`javascript
{
  name: 'yourNewTool',
  description: 'What this tool does',
  parameters: {
    param1: {
      type: 'string',
      description: 'Description of param1'
    },
    param2: {
      type: 'number',
      description: 'Description of param2'
    }
  },
  required: ['param1']
}
\`\`\`

### Step 3: Export

\`\`\`javascript
module.exports = {
  // ... existing exports
  yourNewTool
};
\`\`\`

## 📊 Component Data Schema

Each component should have:

\`\`\`typescript
{
  name: string;           // Component name (lowercase-with-dashes)
  category: string;       // Category for organization
  description: string;    // Brief description
  dependencies?: string[]; // NPM packages required
  files?: string[];       // Files created by shadcn CLI
  usage?: string;         // Usage instructions
  example?: string;       // Code example
}
\`\`\`

## 🚨 Common Issues

### Components Not Installing

**Cause**: Wrong namespace or component name

**Fix**: Check the registry's official documentation for exact component names

### CLI Command Failing

**Cause**: shadcn CLI not installed or wrong version

**Fix**: Ensure \`npx shadcn@latest\` works in terminal

### Cache Not Clearing

**Cause**: Old data cached

**Fix**: Call \`clearCache()\` from \`registryFetcher.js\`

## 📝 Maintenance Schedule

- **Weekly**: Check for new shadcn components
- **Monthly**: Update all registry data files
- **Quarterly**: Review and add new registries

## 🔗 Useful Links

- [shadcn/ui Registry](https://ui.shadcn.com/docs/registry)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Registry Directory](https://ui.shadcn.com/docs/registry/directory)
\`\`\`

---

