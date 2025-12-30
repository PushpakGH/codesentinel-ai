

# CodeSentinel AI – Multi‑Agent Code Review for VS Code

CodeSentinel AI is a **production-grade code review assistant** for VS Code that combines multi‑agent analysis, security scanning, smart auto‑fix, and an integrated AI chat interface. Designed for real-world teams, it supports both **cloud (Gemini)** and **local (Ollama)** models with BYOK security.

***

## Key Features

### 🤖 Multi‑Agent Code Review  
- **Primary Agent**: Detects bugs, anti‑patterns, and performance issues.  
- **Security Agent**: Scans for OWASP Top 10 and common security vulnerabilities.  
- **Validator Agent**: Runs self‑correction loops to verify and refine findings.

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

***

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