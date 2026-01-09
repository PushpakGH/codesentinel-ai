const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../registry/data');

// Knowledge base for enrichment
// Format: "registry:component": { tags: [], useCase: "" }
const ENRICHMENTS = {
  // --- aceternity ---
  "aceternity:3d-card": {
    tags: ["3d", "card", "tilt", "product", "hover", "interactive"],
    useCase: "Displaying products or features with a high-end 3D tilt effect on hover."
  },
  "aceternity:3d-pin": {
    tags: ["map", "pin", "location", "3d", "marker", "link"],
    useCase: "Highlighting locations on a map or features on a diagram with an animated 3D pin."
  },
  "aceternity:animated-modal": {
    tags: ["modal", "dialog", "overlay", "popup", "animation"],
    useCase: "Presenting critical information or forms in a focused modal with smooth entrance animations."
  },
  "aceternity:animated-tabs": {
    tags: ["tabs", "navigation", "menu", "switch", "slide"],
    useCase: "Switching between different content views with a smooth sliding animation."
  },
  "aceternity:animated-tooltip": {
    tags: ["tooltip", "hover", "info", "helper", "overlay"],
    useCase: "Providing contextual help or details when hovering over elements."
  },
  "aceternity:aurora-background": {
    tags: ["background", "aurora", "gradient", "hero", "atmospheric"],
    useCase: "Creating a stunning, colorful backdrop for hero sections or landing pages."
  },
  "aceternity:background-beams": {
    tags: ["background", "beams", "light", "ray", "hero"],
    useCase: "Adding a subtle, high-tech lighting effect to the background of a section."
  },
  "aceternity:background-boxes": {
    tags: ["background", "grid", "boxes", "interactive", "pattern"],
    useCase: "A tech-themed background with interactive boxes that highlight on hover."
  },
  "aceternity:background-gradient": {
    tags: ["background", "gradient", "card", "container", "glow"],
    useCase: "Wrapping content in a container with a subtle, shifting gradient glow."
  },
  "aceternity:bento-grid": {
    tags: ["grid", "layout", "masonry", "dashboard", "gallery"],
    useCase: "Organizing multiple features, images, or data points in a modern Bento-style grid."
  },
  "aceternity:card-hover-effect": {
    tags: ["card", "grid", "hover", "list", "links"],
    useCase: "Displaying a grid of links or features with a shared hover spotlight effect."
  },
  "aceternity:card-stack": {
    tags: ["stack", "cards", "testimonials", "rotate", "list"],
    useCase: "Showcasing testimonials or reviews in a compact, auto-rotating stack."
  },
  "aceternity:compare": {
    tags: ["comparison", "slider", "image", "diff", "before-after"],
    useCase: "Comparing two images (before/after) with a draggable slider."
  },
  "aceternity:cover-image": {
    tags: ["image", "reveal", "cover", "animation", "hero"],
    useCase: "Revealing a hero image or section header with a smooth, curtain-like animation."
  },
  "aceternity:direction-aware-hover": {
    tags: ["hover", "card", "image", "direction", "overlay"],
    useCase: "Image galleries where the hover overlay enters from the direction of the mouse."
  },
  "aceternity:evervault-card": {
    tags: ["card", "security", "encryption", "text", "hover"],
    useCase: "A decorative card with a 'hacker' style text decryption effect on hover."
  },
  "aceternity:floating-dock": {
    tags: ["dock", "navigation", "menu", "macos", "bottom-bar"],
    useCase: "A floating bottom navigation bar similar to macOS Dock, ideal for apps."
  },
  "aceternity:focus-cards": {
    tags: ["gallery", "cards", "focus", "blur", "image"],
    useCase: "An image gallery where hovering one item blurs the others to focus attention."
  },
  "aceternity:following-pointer": {
    tags: ["cursor", "pointer", "card", "profile", "highlight"],
    useCase: "A custom cursor or element that follows the mouse, useful for collaborative UI demos."
  },
  "aceternity:glare-card": {
    tags: ["card", "glare", "reflection", "shine", "3d"],
    useCase: "A realistic card with a light glare effect that responds to mouse movement."
  },
  "aceternity:globe": {
    tags: ["globe", "map", "3d", "earth", "visualization"],
    useCase: "Visualizing global data or points of interest on an interactive 3D globe."
  },
  "aceternity:google-gemini-effect": {
    tags: ["scroll", "animation", "path", "line", "hero"],
    useCase: "A complex scroll-triggered path animation style like the Gemini landing page."
  },
  "aceternity:hero-highlight": {
    tags: ["hero", "text", "highlight", "marker", "background"],
    useCase: "Highlighting key text in a hero section with a dynamic background animation."
  },
  "aceternity:hero-parallax": {
    tags: ["hero", "parallax", "scroll", "gallery", "products"],
    useCase: "A grand hero section that displays a gallery of products moving in parallax on scroll."
  },
  "aceternity:images-slider": {
    tags: ["slider", "carousel", "images", "background", "hero"],
    useCase: "A fullscreen background image slider with smooth transitions."
  },
  "aceternity:infinite-moving-cards": {
    tags: ["marquee", "scroll", "testimonials", "loop", "cards"],
    useCase: "An auto-scrolling horizontal strip of cards, perfect for client logos or testimonials."
  },
  "aceternity:lamp": {
    tags: ["light", "spotlight", "hero", "header", "glow"],
    useCase: "A dramatic spotlight effect for section headers or hero titles."
  },
  "aceternity:lens": {
    tags: ["zoom", "magnify", "image", "hover", "detail"],
    useCase: "Magnifying part of an image on hover, useful for product details."
  },
  "aceternity:moving-border": {
    tags: ["border", "glow", "button", "card", "animation"],
    useCase: "Drawing attention to a button or card with a perpetually moving glowing border."
  },
  "aceternity:parallax-scroll": {
    tags: ["grid", "gallery", "scroll", "parallax", "images"],
    useCase: "A vertical image grid where columns scroll at different speeds."
  },
  "aceternity:shooting-stars": {
    tags: ["background", "stars", "space", "animation", "night"],
    useCase: "A subtle animated background with shooting stars for a magical feel."
  },
  "aceternity:sidebar": {
    tags: ["navigation", "menu", "sidebar", "layout", "drawer"],
    useCase: "A collapsible sidebar navigation menu with smooth animations."
  },
  "aceternity:sparkles": {
    tags: ["particles", "sparkle", "background", "dust", "effect"],
    useCase: "Adding floating sparkles or dust particles to a background or element."
  },
  "aceternity:spotlight": {
    tags: ["light", "hover", "reveal", "gradient", "hero"],
    useCase: "A spotlight effect that follows the mouse to reveal content or gradients."
  },
  "aceternity:sticky-scroll-reveal": {
    tags: ["scroll", "sticky", "presentation", "story", "layout"],
    useCase: "Explaining a process or story where text scrolls but illustrations stick."
  },
  "aceternity:tabs": {
    tags: ["tabs", "navigation", "switch", "content", "layout"],
    useCase: "A versatile tab component for switching between different views."
  },
  "aceternity:text-generate-effect": {
    tags: ["text", "typing", "reveal", "animation", "loading"],
    useCase: "Revealing text word-by-word, great for impactful statements or loading states."
  },
  "aceternity:timeline": {
    tags: ["timeline", "history", "steps", "process", "scroll"],
    useCase: "Displaying a chronological list of events or steps in a project."
  },
  "aceternity:tracing-beam": {
    tags: ["scroll", "progress", "beam", "line", "indicator"],
    useCase: "Verically tracing the user's reading progress with a glowing beam."
  },
  "aceternity:vortex": {
    tags: ["background", "particle", "fluid", "simulation", "hero"],
    useCase: "A mesmerizing fluid particle simulation background."
  },
  "aceternity:wavy-background": {
    tags: ["background", "waves", "pattern", "color", "hero"],
    useCase: "A colorful, animated wave pattern background."
  },
  "aceternity:world-map": {
    tags: ["map", "dots", "locations", "connection", "global"],
    useCase: "A flat map visualization showing connections between global coordinates."
  },

  // --- magicui ---
  "magicui:animated-beam": { tags: ["beam", "connector", "line", "flow"], useCase: "Connecting two elements with a moving beam, good for explaining data flow." },
  "magicui:animated-list": { tags: ["list", "notification", "feed", "stagger"], useCase: "A list where new items animate in, perfect for activity feeds." },
  "magicui:bento-grid": { tags: ["grid", "layout", "masonry", "cards"], useCase: "A bento-style grid for featuring multiple items of varying importance." },
  "magicui:blur-in": { tags: ["text", "reveal", "blur", "animation"], useCase: "Text that reveals itself by unblurring." },
  "magicui:border-beam": { tags: ["border", "light", "glow", "card"], useCase: "A beam of light traveling around a container's border." },
  "magicui:box-reveal": { tags: ["reveal", "mask", "text", "animation"], useCase: "Revealing content with a sliding box mask effect." },
  "magicui:confetti": { tags: ["celebration", "particles", "success", "effect"], useCase: "Firing confetti on success states or celebrations." },
  "magicui:dock": { tags: ["navigation", "menu", "macos", "icon"], useCase: "An icon dock that expands on hover, like macOS." },
  "magicui:dot-pattern": { tags: ["background", "pattern", "dots", "svg"], useCase: "A subtle dot grid background pattern." },
  "magicui:fade-text": { tags: ["text", "fade", "reveal", "animation"], useCase: "Simple fade-in animation for text." },
  "magicui:globe": { tags: ["globe", "3d", "earth", "interactive"], useCase: "Interactive 3D globe." },
  "magicui:grid-pattern": { tags: ["background", "grid", "lines", "pattern"], useCase: "A simple line grid background." },
  "magicui:hyper-text": { tags: ["text", "glitch", "random", "scramble"], useCase: "Text that cycles through random characters before settling." },
  "magicui:icon-cloud": { tags: ["cloud", "sphere", "icons", "3d"], useCase: "A rotating cloud of tech stack icons." },
  "magicui:marquee": { tags: ["scroll", "loop", "infinite", "brand"], useCase: "Infinite scrolling strip for logos or text." },
  "magicui:meteors": { tags: ["background", "space", "particles", "star"], useCase: "Meteor shower animation for backgrounds." },
  "magicui:number-ticker": { tags: ["counter", "numbers", "stats", "animate"], useCase: "Animate numbers counting up to a value." },
  "magicui:orbiting-circles": { tags: ["animation", "circle", "orbit", "planet"], useCase: "Elements orbiting in circles around a center." },
  "magicui:particles": { tags: ["background", "dots", "interactive", "web"], useCase: "Interactive particles that respond to mouse movement." },
  "magicui:pulsating-button": { tags: ["button", "pulse", "cta", "glow"], useCase: "A primary call-to-action button that pulses to attract attention." },
  "magicui:retro-grid": { tags: ["background", "retro", "perspective", "grid"], useCase: "A retro 80s style perspective grid background." },
  "magicui:ripple": { tags: ["effect", "circle", "click", "wave"], useCase: "Expanding ripple circles, useful for emphasis." },
  "magicui:scroll-progress": { tags: ["progress", "scroll", "bar", "indicator"], useCase: "Reading progress bar fixed to the top of the screen." },
  "magicui:shimmer-button": { tags: ["button", "shimmer", "shine", "premium"], useCase: "A shiny, premium-looking button." },
  "magicui:shine-border": { tags: ["border", "shine", "glow", "card"], useCase: "A border with a rotating shine effect." },
  "magicui:sparkles": { tags: ["text", "sparkle", "highlight"], useCase: "Text revealed or highlighted with sparkles." },
  "magicui:text-reveal": { tags: ["text", "scroll", "fade", "read"], useCase: "Text that lights up as you scroll." },
  "magicui:typing-animation": { tags: ["text", "typewriter", "code"], useCase: "Text appearing as if being typed." },
  "magicui:word-pull-up": { tags: ["text", "animation", "entrance"], useCase: "Words sliding up into view." },
  "magicui:word-rotate": { tags: ["text", "cycle", "substitution"], useCase: "Cycling through a list of words in a sentence." },

  // --- shadcn (generic tagging) ---
  "shadcn:accordion": { tags: ["collapse", "expand", "faq", "list"], useCase: "Organizing extensive content into collapsible sections (FAQs)." },
  "shadcn:alert": { tags: ["notification", "warning", "error", "info"], useCase: "Displaying important status messages to the user." },
  "shadcn:alert-dialog": { tags: ["modal", "confirm", "warning", "overlay"], useCase: "Interrupting user to confirm a dangerous action." },
  "shadcn:aspect-ratio": { tags: ["layout", "image", "video", "container"], useCase: "Maintaining a consistent width-to-height ratio for media." },
  "shadcn:avatar": { tags: ["image", "user", "profile", "picture"], useCase: "Displaying user profile pictures or initials." },
  "shadcn:badge": { tags: ["label", "tag", "status", "indicator"], useCase: "Labeling items with status or category." },
  "shadcn:breadcrumb": { tags: ["navigation", "path", "history", "links"], useCase: "Showing current page location in hierarchy." },
  "shadcn:button": { tags: ["action", "input", "click", "submit"], useCase: "Triggering actions or submitting forms." },
  "shadcn:calendar": { tags: ["date", "picker", "time", "input"], useCase: "Selecting dates from a monthly view." },
  "shadcn:card": { tags: ["container", "box", "panel", "layout"], useCase: "Grouping related content and actions in a container." },
  "shadcn:carousel": { tags: ["slider", "gallery", "slides", "swipe"], useCase: "Cycling through a set of content or images." },
  "shadcn:chart": { tags: ["graph", "data", "visual", "statistics"], useCase: "Visualizing data in bar, line, or pie charts." },
  "shadcn:checkbox": { tags: ["input", "form", "select", "boolean"], useCase: "Selecting one or more options from a list." },
  "shadcn:collapsible": { tags: ["expand", "hide", "section", "disclosure"], useCase: "Showing or hiding a section of content." },
  "shadcn:combobox": { tags: ["input", "select", "search", "autocomplete"], useCase: "Selecting an item from a large list with search." },
  "shadcn:command": { tags: ["search", "menu", "palette", "dialog"], useCase: "Global command palette for navigation or actions." },
  "shadcn:context-menu": { tags: ["menu", "right-click", "actions", "overlay"], useCase: "Showing actions on right-click." },
  "shadcn:dialog": { tags: ["modal", "popup", "window", "overlay"], useCase: "Focused task or content in a modal window." },
  "shadcn:drawer": { tags: ["sheet", "mobile", "panel", "overlay"], useCase: "Pull-up panel, common on mobile devices." },
  "shadcn:dropdown-menu": { tags: ["menu", "actions", "list", "select"], useCase: "Revealing a list of actions or links." },
  "shadcn:form": { tags: ["input", "validation", "group", "data"], useCase: "Building validated forms with multiple inputs." },
  "shadcn:hover-card": { tags: ["preview", "tooltip", "overlay", "info"], useCase: "Previewing more content on hover." },
  "shadcn:input": { tags: ["field", "text", "form", "entry"], useCase: "Basic text input field." },
  "shadcn:input-otp": { tags: ["code", "auth", "security", "digit"], useCase: "Entering one-time passwords." },
  "shadcn:label": { tags: ["text", "form", "caption", "name"], useCase: "Labeling form elements." },
  "shadcn:menubar": { tags: ["navigation", "dropdown", "desktop", "top"], useCase: "Desktop-style top menu bar." },
  "shadcn:navigation-menu": { tags: ["header", "links", "mega-menu", "nav"], useCase: "Main site navigation with mega-menus." },
  "shadcn:pagination": { tags: ["navigation", "pages", "list", "next"], useCase: "Navigating between pages of data." },
  "shadcn:popover": { tags: ["overlay", "bubble", "content", "popup"], useCase: "Small overlay content triggered by click." },
  "shadcn:progress": { tags: ["loading", "bar", "status", "indicator"], useCase: "Showing completion percentage." },
  "shadcn:radio-group": { tags: ["select", "option", "form", "list"], useCase: "Selecting exactly one option from a list." },
  "shadcn:resizable": { tags: ["layout", "split", "drag", "panels"], useCase: "Resizable panel layouts." },
  "shadcn:scroll-area": { tags: ["container", "overflow", "view", "list"], useCase: "Custom scrollable container." },
  "shadcn:select": { tags: ["dropdown", "input", "form", "option"], useCase: "Picking a value from a dropdown list." },
  "shadcn:separator": { tags: ["divider", "line", "rule", "layout"], useCase: "Visually separating content." },
  "shadcn:sheet": { tags: ["sidebar", "drawer", "overlay", "panel"], useCase: "Side-panel for navigation or details." },
  "shadcn:skeleton": { tags: ["loading", "placeholder", "mockup", "state"], useCase: "Placeholder state while data loads." },
  "shadcn:slider": { tags: ["input", "range", "track", "control"], useCase: "Selecting a value from a range." },
  "shadcn:sonner": { tags: ["toast", "notification", "alert", "message"], useCase: "Stackable toast notifications." },
  "shadcn:switch": { tags: ["toggle", "boolean", "input", "form"], useCase: "Toggling a setting on or off." },
  "shadcn:table": { tags: ["data", "grid", "rows", "list"], useCase: "Displaying tabular data." },
  "shadcn:tabs": { tags: ["navigation", "switch", "panels", "content"], useCase: "Switching between views in the same context." },
  "shadcn:textarea": { tags: ["input", "text", "multiline", "form"], useCase: "Multi-line text input." },
  "shadcn:toast": { tags: ["notification", "message", "alert", "popup"], useCase: "Brief status message." },
  "shadcn:toggle": { tags: ["button", "switch", "state", "icon"], useCase: "Two-state button." },
  "shadcn:toggle-group": { tags: ["buttons", "select", "options", "set"], useCase: "Set of toggle buttons." },
  "shadcn:tooltip": { tags: ["hint", "hover", "info", "label"], useCase: "Small hint on hover." },

  // --- motion-primitives ---
  "motion-primitives:motion-box": { tags: ["animation", "container", "div", "primitive"], useCase: "Generic animated container." },
  "motion-primitives:draggable": { tags: ["gesture", "drag", "interaction", "move"], useCase: "Making an element draggable." },
  "motion-primitives:hover-lift": { tags: ["hover", "effect", "card", "scale"], useCase: "Subtle lift effect on hover." },
  "motion-primitives:pressable": { tags: ["click", "button", "scale", "tap"], useCase: "Scale down effect on click/tap." },
  "motion-primitives:scroll-reveal": { tags: ["scroll", "fade", "enter", "view"], useCase: "Revealing element when scrolled into view." },
  "motion-primitives:parallax-layer": { tags: ["scroll", "background", "move", "depth"], useCase: "Layer moving at different speed for parallax." },
  "motion-primitives:stagger-container": { tags: ["list", "sequence", "children", "animate"], useCase: "Staggering animations of child elements." },
  "motion-primitives:presence": { tags: ["exit", "enter", "conditional", "mount"], useCase: "Handling exit animations for unmounting components." },
  "motion-primitives:cursor-follow": { tags: ["mouse", "pointer", "track", "effect"], useCase: "Element tracking mouse position." },
  "motion-primitives:motion-stack": { tags: ["list", "stack", "toast", "vertical"], useCase: "Stack of items with entrance/exit animations." },
};

async function enrichRegistry() {
  console.log('Beginning Registry Enrichment...');

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const registryId = content.id || file.replace('.json', '');
    
    console.log(`Processing ${registryId} (${content.components.length} components)...`);
    
    let updatedCount = 0;

    content.components = content.components.map(comp => {
      const key = `${registryId}:${comp.name}`;
      
      // Get manual enrichment or generate fallback
      let enrichment = ENRICHMENTS[key];
      
      if (!enrichment) {
        // Fallback heuristics if not manually defined
        const tags = [registryId];
        let useCase = "General purpose UI component.";
        
        const nameLower = comp.name.toLowerCase();
        
        // Infer tags from name/category
        if (comp.category) tags.push(comp.category);
        if (nameLower.includes('card')) tags.push('card', 'container');
        if (nameLower.includes('button')) tags.push('button', 'action');
        if (nameLower.includes('text') || nameLower.includes('type')) tags.push('text', 'typography');
        if (nameLower.includes('scroll')) tags.push('scroll', 'view');
        if (nameLower.includes('nav') || nameLower.includes('menu')) tags.push('navigation');
        if (nameLower.includes('anim') || nameLower.includes('motion')) tags.push('animation');
        if (nameLower.includes('form') || nameLower.includes('input')) tags.push('form', 'input');
        
        enrichment = { tags, useCase };
      }

      // Merge current data with enrichment
      // Ensure tags is unique
      const existingTags = comp.tags || [];
      const newTags = [...new Set([...existingTags, ...enrichment.tags])];

      return {
        ...comp,
        tags: newTags,
        useCase: comp.useCase || enrichment.useCase
      };
    });

    // Write back
    fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
    console.log(`Updated ${file}.`);
  }

  console.log('Registry Enrichment Complete.');
}

enrichRegistry().catch(console.error);
