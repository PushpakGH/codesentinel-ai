/**
 * Component Metadata Enhancement Script
 * Adds embeddingContext to all components in registry JSON files
 * 
 * Run with: node scripts/enhance-registry-metadata.js
 */

const fs = require('fs').promises;
const path = require('path');

const REGISTRY_DATA_DIR = path.join(__dirname, '..', 'src', 'registry', 'data');

/**
 * Generate embeddingContext for a component
 * This synthesizes a natural language paragraph optimized for vector embeddings
 */
function generateEmbeddingContext(comp) {
    const name = comp.name || 'Unknown';
    const category = comp.category || 'UI';
    const description = comp.description || '';
    const tags = comp.tags || [];
    const useCase = comp.useCase || '';
    const subComponents = comp.subComponents ? Object.keys(comp.subComponents) : [];
    
    // Build semantic synonyms based on common patterns
    const synonymMap = {
        // Layout
        'card': ['container', 'panel', 'box', 'wrapper', 'section', 'grouping', 'tile'],
        'accordion': ['collapsible', 'expandable', 'faq', 'disclosure', 'toggle panel'],
        'tabs': ['tab switcher', 'tab navigation', 'tab panel', 'segmented control'],
        'separator': ['divider', 'line', 'horizontal rule', 'section break'],
        'aspect-ratio': ['responsive container', 'media wrapper', 'ratio box'],
        'scroll-area': ['scrollable container', 'overflow container', 'scroll pane'],
        'resizable': ['splitter', 'resize panel', 'adjustable layout', 'drag to resize'],
        
        // Navigation
        'breadcrumb': ['path indicator', 'navigation trail', 'location breadcrumbs', 'page hierarchy'],
        'navigation-menu': ['nav bar', 'main navigation', 'header menu', 'site navigation'],
        'menubar': ['application menu', 'menu strip', 'toolbar menu'],
        'pagination': ['page navigation', 'page selector', 'pager', 'page controls'],
        'sidebar': ['side navigation', 'drawer menu', 'left panel', 'navigation sidebar'],
        
        // Overlay
        'dialog': ['modal', 'popup window', 'overlay', 'lightbox', 'modal dialog'],
        'sheet': ['side panel', 'drawer', 'slide-over', 'off-canvas panel', 'sliding panel'],
        'drawer': ['sidebar overlay', 'slide-in panel', 'mobile menu', 'off-canvas'],
        'popover': ['popup', 'floating content', 'info bubble', 'hover card'],
        'tooltip': ['hint', 'hover tip', 'info tooltip', 'title attribute', 'helper text'],
        'alert-dialog': ['confirmation dialog', 'warning modal', 'confirm popup', 'interrupt dialog'],
        'hover-card': ['preview card', 'hover preview', 'info popup', 'quick view'],
        'context-menu': ['right-click menu', 'contextual actions', 'popup menu'],
        'dropdown-menu': ['dropdown', 'menu button', 'action menu', 'options menu'],
        
        // Feedback
        'alert': ['notification banner', 'message box', 'info callout', 'status message'],
        'toast': ['snackbar', 'notification toast', 'popup message', 'brief notification', 'status toast'],
        'sonner': ['toast library', 'notification system', 'snackbar', 'toast notifications'],
        'progress': ['progress bar', 'loading indicator', 'completion status', 'loading bar'],
        'skeleton': ['loading placeholder', 'content skeleton', 'shimmer effect', 'loading state'],
        'badge': ['label', 'tag', 'chip', 'status indicator', 'pill', 'counter badge'],
        
        // Form
        'button': ['clickable', 'action button', 'cta', 'call-to-action', 'submit', 'interactive'],
        'input': ['text field', 'text input', 'form field', 'input box', 'text box'],
        'textarea': ['multiline input', 'text area', 'large text input', 'comment box'],
        'checkbox': ['check box', 'tick box', 'boolean input', 'multi-select option'],
        'radio-group': ['radio buttons', 'single select', 'option group', 'mutually exclusive'],
        'select': ['dropdown select', 'picker', 'choice list', 'option selector'],
        'switch': ['toggle switch', 'on-off', 'boolean toggle', 'slider switch'],
        'slider': ['range input', 'slider control', 'value slider', 'drag slider'],
        'toggle': ['toggle button', 'pressed button', 'stateful button'],
        'toggle-group': ['button group', 'segmented buttons', 'choice buttons'],
        'form': ['form wrapper', 'form validation', 'input form', 'data entry'],
        'label': ['input label', 'form label', 'field label'],
        'calendar': ['date picker', 'date selector', 'month view', 'date calendar'],
        'date-picker': ['date input', 'date selector', 'calendar picker'],
        'combobox': ['autocomplete', 'searchable select', 'typeahead', 'command palette select'],
        
        // Data Display
        'avatar': ['profile picture', 'user avatar', 'profile image', 'user icon'],
        'table': ['data table', 'grid', 'spreadsheet', 'tabular data'],
        'data-table': ['sortable table', 'filterable table', 'paginated table', 'advanced grid'],
        'carousel': ['slider', 'image carousel', 'content slider', 'slideshow', 'image gallery'],
        'chart': ['graph', 'visualization', 'data chart', 'bar chart', 'line chart'],
        'collapsible': ['expandable section', 'toggle content', 'show/hide', 'disclosure'],
        
        // Misc
        'command': ['command palette', 'quick actions', 'spotlight', 'search command', 'keyboard shortcuts'],
        'input-otp': ['one-time password', 'verification code', 'pin input', 'otp field'],
    };
    
    // Get synonyms for this component
    const nameLower = name.toLowerCase();
    const synonyms = synonymMap[nameLower] || [];
    
    // Build the embedding context
    let context = `${description}`;
    
    if (synonyms.length > 0) {
        context += ` Also known as: ${synonyms.join(', ')}.`;
    }
    
    if (tags.length > 0) {
        context += ` Related concepts: ${tags.join(', ')}.`;
    }
    
    if (useCase) {
        context += ` Primary use case: ${useCase}`;
    }
    
    if (subComponents.length > 0) {
        context += ` Composed of parts: ${subComponents.join(', ')}.`;
    }
    
    return context.trim();
}

/**
 * Enhance a registry JSON file
 */
async function enhanceRegistryFile(filePath) {
    console.log(`\n📁 Processing: ${path.basename(filePath)}`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    const registry = JSON.parse(content);
    
    if (!registry.components || !Array.isArray(registry.components)) {
        console.log('  ⚠️ No components array found, skipping.');
        return;
    }
    
    let enhanced = 0;
    
    for (const comp of registry.components) {
        if (!comp.embeddingContext) {
            comp.embeddingContext = generateEmbeddingContext(comp);
            enhanced++;
        }
    }
    
    // Write back
    await fs.writeFile(filePath, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`  ✅ Enhanced ${enhanced}/${registry.components.length} components`);
}

/**
 * Main
 */
async function main() {
    console.log('🚀 Component Metadata Enhancement Script');
    console.log('=========================================\n');
    
    // Find all JSON files
    const files = await fs.readdir(REGISTRY_DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} registry files:\n${jsonFiles.map(f => `  - ${f}`).join('\n')}`);
    
    for (const file of jsonFiles) {
        await enhanceRegistryFile(path.join(REGISTRY_DATA_DIR, file));
    }
    
    console.log('\n=========================================');
    console.log('✅ Enhancement complete!');
    console.log('\n📝 Next Steps:');
    console.log('  1. Delete src/registry/vectorData.json (cache)');
    console.log('  2. Restart the extension to rebuild embeddings');
}

main().catch(console.error);
