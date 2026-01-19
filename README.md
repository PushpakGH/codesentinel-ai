

# CodeSentinel AI – Multi‑Agent Code Review for VS Code

CodeSentinel AI is a **code review assistant** for VS Code that combines multi‑agent analysis, security scanning, smart auto‑fix, and an integrated AI chat interface. Designed for real-world teams, it supports both **cloud (Gemini)** and **local (Ollama)** models with BYOK security.

***
**Its vibecoded!!!**

## Key Features

### 🤖 Multi‑Agent Code Review  
- **Primary Agent**: Detects bugs, anti‑patterns, and performance issues.  
- **Security Agent**: Scans for OWASP Top 10 and common security vulnerabilities.  
- **Validator Agent**: Runs self‑correction loops to verify and refine findings.

### 🚀 **Project Builder** ⭐ NEW in v1.0.9
- **Natural Language Projects**: Describe your project, get a complete codebase
- **Component Discovery**: Automatically finds and uses 125+ pre-built components
- **Multi-Step Planning**: AI creates plan → You approve → AI builds project
- **5 Component Libraries**: shadcn/ui, daisyUI, Magic UI, Aceternity, Motion Primitives
- **Smart Installation**: Auto-runs `npx shadcn add` and `npm install`
- **Security First**: Path traversal prevention, dangerous command blocking
- **File Generation**: Creates pages, routing, configuration files

### 🔧 Smart Auto‑Fix  
- Analyzes selected code before applying changes.  
- Generates AI‑powered fixes with optional diff preview.  
- Supports one‑click undo via VS Code’s native undo stack.

### 💬 AI Chat (Side Panel + Pop‑Out)  
- Persistent **side panel chat** anchored in the activity bar.  
- Natural language commands like: `review test.js`, `review current file`, `explain this function`.  
- Full **webview chat panel** for deep debugging sessions.  
- Configurable **chat history limit** (e.g., 10–200 messages) for tuning context vs performance.

### 🧠 Conversation Memory  
- Remembers recent messages to provide contextual answers.  
- History window size is configurable via settings (ideal for balancing latency and token usage).

### 🎯 Git Commit Message Generator  
- Analyzes **staged changes** and proposes **conventional commit** messages.  
- Infers scope from changed files (e.g., `auth`, `api`, `ui`).  
- Prefills the Source Control input box and can generate an optional detailed body.

### 📁 Folder & Workspace Review  
- Recursively reviews folders or entire workspaces.  
- Produces risk‑sorted summaries of files and issues.  
- Integrates with a tree view and webview for structured navigation of findings.

### 🔐 Security & BYOK  
- **Bring Your Own Key (BYOK)** for Gemini; keys are stored in the OS keychain.  
- Full **offline mode** with Ollama: code never leaves your machine.  
- Configurable security agent and confidence thresholds for self‑correction.

***

## Quick Start

1. Install **CodeSentinel AI** from the VS Code Marketplace.  
2. Open a project folder managed by Git (recommended for commit features).  
3. Use one of the entry points:

- **Code Review**  
  - Select code → Right‑click → **CodeSentinel: Review Selected Code**  
- **Smart Fix**  
  - Select code → Right‑click → **CodeSentinel: Apply Smart Fix**  
- **Chat**  
  - Click the **CodeSentinel AI** icon in the activity bar → start chatting  
  - Or run: `CodeSentinel: Open AI Chat` from the Command Palette  
- **Commit Message**  
  - Stage changes → run: `CodeSentinel: Generate Commit Message`

***

## Model Setup

### Option A – Gemini (Cloud)

1. Create a free API key:  
   https://aistudio.google.com/app/apikey  
2. In VS Code:  
   - Open **Settings** → search for `CodeSentinel`.  
   - Either:  
     - Run: **CodeSentinel: Configure API Key** (recommended, uses secure storage), or  
     - Set `codeSentinel.apiKey` directly (legacy, will be migrated to secure storage).  
3. Set provider (if needed):  
   - `codeSentinel.modelProvider = "gemini"` or `"auto"`.

### Option B – Ollama (Local / Offline)

1. Install Ollama:  
   https://ollama.ai  
2. Pull a recommended model (example):  
   ```bash
   ollama pull deepseek-r1:7b
   ```
3. In VS Code Settings:  
   - `codeSentinel.modelProvider = "ollama"` or `"auto"`  
   - Optionally adjust:  
     - `codeSentinel.ollamaModel` (e.g., `deepseek-r1:7b`, `qwen2.5:7b`)  
     - `codeSentinel.ollamaBaseUrl` (default: `http://localhost:11434`)

***

## Commands

All commands are available via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **CodeSentinel: Review Selected Code**  
  Run multi‑agent analysis on the current selection.

- **CodeSentinel: Apply Smart Fix**  
  Analyze and generate fixes for the selected code.

- **CodeSentinel: Smart Fix Entire Folder**  
  Run smart fixes across an entire folder (use with care).

- **CodeSentinel: Review Folder**  
  Recursively review a specific folder.

- **CodeSentinel: Review Workspace**  
  Analyze the whole workspace.

- **CodeSentinel: Open AI Chat**  
  Open the chat webview (also available from the side panel).

- **CodeSentinel: Generate Commit Message**  
  Generate an AI‑powered conventional commit message from staged changes.

- **CodeSentinel: Configure API Key**  
  Securely store your Gemini API key.

- **CodeSentinel: Delete API Key**  
  Remove the stored key from secure storage.

- **CodeSentinel: Toggle Debug Mode**  
  Enable verbose logging and reasoning traces (useful for demos / debugging).

  | **`CodeSentinel: Build Project`** | - | **Build complete project from description**  NEW |
### 🚀 Building a Complete Project

The Project Builder creates full-stack applications from natural language descriptions.

**Example Workflow:**

1. **Start Command**
trl+Shift+P → CodeSentinel: Build Project



2. **Describe Your Project**
"Build me a dashboard with user management and charts"



3. **Name Your Project**
my-dashboard



4. **Review AI Plan**
- AI generates detailed plan with pages, components, tech stack
- Plan shown in editor for your approval
- Click "Yes, Build It!" to proceed

5. **Watch It Build**
- Discovers 125+ available components
- Installs required dependencies
- Generates all files (pages, routing, config)
- Runs npm install automatically

6. **Open Your Project**
- Success message with "Open Project" button
- Ready-to-run codebase

**Example Prompts:**
- ✅ "Create a landing page with hero section, features, and pricing table"
- ✅ "Build an e-commerce product catalog with filters and shopping cart"
- ✅ "Make a todo app with drag-and-drop and local storage"
- ✅ "Dashboard with user authentication and data tables"
- ✅ "Portfolio website with animated sections"

**Supported Component Libraries:**
- **shadcn/ui** (65 components) - Forms, navigation, data display
- **daisyUI** (65 components) - Tailwind CSS utility components
- **Magic UI** (30 components) - Animated effects and backgrounds
- **Aceternity UI** (40 components) - Hero sections, 3D cards, parallax
- **Motion Primitives** (50 components) - Framer Motion animations

**What Gets Generated:**
- ✅ Complete folder structure
- ✅ Page components with routing
- ✅ Component imports and usage
- ✅ Tailwind CSS styling
- ✅ package.json with dependencies
- ✅ Configuration files (tailwind.config.js, etc.)

***
| Command | Shortcut | Description |
|---------|----------|-------------|
| `CodeSentinel: Review Code` | - | Multi-agent code review |
| `CodeSentinel: Smart Auto-Fix` | - | Analyze + Fix all issues |
| `CodeSentinel: Generate Snippet` | `Ctrl+Shift+G` | Generate code from description |
| `CodeSentinel: Generate Documentation` | `Ctrl+Shift+D` | Generate docs for selected code |
| `CodeSentinel: Generate Tests` | `Ctrl+Shift+T` | Generate unit tests |
| **`CodeSentinel: Build Project`** | - | **Build complete project from description** ⭐ NEW |
| `CodeSentinel: Open AI Chat` | - | Chat with AI assistant |
| `CodeSentinel: Generate Commit Message` | - | AI commit messages |

## Configuration Highlights

You can configure CodeSentinel AI via **Settings → Extensions → CodeSentinel AI** or by editing `settings.json`:

```jsonc
{
  // Model selection
  "codeSentinel.modelProvider": "auto",          // "gemini" | "ollama" | "auto"
  "codeSentinel.geminiModel": "gemini-2.0-flash-exp",
  "codeSentinel.ollamaModel": "deepseek-r1:7b",
  "codeSentinel.ollamaBaseUrl": "http://localhost:11434",

  // Chat behavior
  "codeSentinel.chatHistoryLimit": 50,           // 10–200, controls context window
  "codeSentinel.enableStreaming": true,          // Streaming responses where supported

  // Agents & analysis
  "codeSentinel.enableSecurityAgent": true,
  "codeSentinel.enableValidatorAgent": true,
  "codeSentinel.confidenceThreshold": 85,        // Self-correction trigger

  // Auto-fix behavior
  "codeSentinel.enableAutoFix": true,
  "codeSentinel.applyFixesDirectly": false,      // true = apply without confirmation

  // Display mode
  "codeSentinel.displayMode": "webview",         // "webview" | "markdown"

  // Diagnostics & debug
  "codeSentinel.debugMode": false
}
```

***
## 🔧 Configuration Project Builder

### Project Builder Settings

{
"codeSentinel.autoInstallDependencies": true // Auto-run npm install after build
}

## 🐛 Troubleshooting

### Project Builder Issues

**Problem**: Components not installing  
**Solution**: 
1. Make sure you have Node.js installed
2. Try running `npx shadcn@latest init` manually in your project
3. Check logs: `CodeSentinel: Show Logs`

**Problem**: npm install fails  
**Solution**: 
1. Check your internet connection
2. Delete `node_modules` and `package-lock.json`
3. Run `npm install` manually

**Problem**: Plan not showing  
**Solution**: 
1. Check if you have a workspace folder open
2. Ensure your API key is configured
3. View logs for detailed error messages

**Problem**: Extension not activating  
**Solution**:
1. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Check Output panel: View → Output → Select "CodeSentinel"
3. Verify Node.js version: `node --version` (should be >=18.0.0)

### General Issues

Run `CodeSentinel: Show Logs` to see detailed error messages.


### Code Review Settings

{
"codeSentinel.modelProvider": "auto",
"codeSentinel.geminiModel": "gemini-2.0-flash-exp",
"codeSentinel.debugMode": false
}


## Upcoming Features

Planned for future releases:

- **Code Snippet Generator**  
  - Generate boilerplate for common patterns (routes, services, components).  

- **Test Case Generator**  
  - Auto‑generate unit test skeletons based on function signatures.  

- **Documentation Generator**  
  - Create docstrings / JSDoc and inline documentation from code.  

- **Refactoring Suggestions**  
  - Detect code smells and propose refactorings (extraction, decomposition, etc.).  

- **Performance Analyzer**  
  - Identify hot paths, inefficient loops, and expensive operations.  

- **Dependency Checker**  
  - Detect outdated or vulnerable dependencies and suggest upgrades.

***

## Requirements

- VS Code **1.85.0+**  
- Node.js **18+** (for local development)  
- Either:  
  - Gemini API key (for cloud mode), or  
  - Ollama installed and running (for local mode).

***

## License

This project is licensed under the **MIT License**.
