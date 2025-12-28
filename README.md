# CodeSentinel AI - Production Code Review
<!-- its first time i have built extension and this is vibecoded -->
AI-powered code review extension with multi-agent analysis, security scanning, and smart auto-fix.

## Features

✨ **Multi-Agent Code Review**
- Primary Agent: Bugs, performance, best practices
- Security Agent: OWASP Top 10 vulnerabilities
- Validator Agent: Self-correction loops

🔧 **Smart Auto-Fix**
- Analyzes code first, then fixes all issues
- Shows diff before applying
- Undo with Ctrl+Z

💬 **AI Chat Assistant**
- Natural language commands
- Review files/folders via chat
- Ask coding questions

📁 **Folder/Workspace Review**
- Scan entire directories
- Risk-sorted file reports
- Batch analysis

## Quick Start

1. Install extension
2. Select code → Right-click → **CodeSentinel: Review Code**
3. Or open AI Chat: `Ctrl+Shift+P` → **CodeSentinel: Open AI Chat**

## Setup

### Option 1: Gemini (Cloud)
1. Get free API key: https://aistudio.google.com/app/apikey
2. Settings → Search "CodeSentinel" → Enter API key

### Option 2: Ollama (Local/Offline)
1. Install Ollama: https://ollama.ai
2. Run: `ollama pull deepseek-r1:7b`
3. Extension auto-detects Ollama

## Commands

- **Review Selected Code** - Multi-agent analysis
- **Apply Smart Fix** - Analyze + fix all issues
- **Open AI Chat** - Natural language interface
- **Review Folder** - Scan directory
- **Review Workspace** - Scan entire project

## Requirements

- VS Code 1.85.0+
- Node.js 18+ (for development)
- Gemini API key OR Ollama (local)

## License

MIT
