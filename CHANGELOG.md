# Changelog

All notable changes to the CodeSentinel AI extension will be documented in this file.

---
 

### Added
## [1.0.8] - 2025-12-30

### Added
- **🎨 Code Snippet Generator**: Generate boilerplate code instantly
- **📚 Documentation Generator**: Auto-generate code documentation
- **🧪 Test Case Generator**: Auto-generate unit tests ⭐ NEW
  - Supports Jest, Vitest, Mocha, Pytest, JUnit
  - Generates edge cases and error tests
  - Auto-detects test framework from project
  - Creates test files with proper naming conventions
  - Command: `CodeSentinel: Generate Unit Tests`


- **🎨 Code Snippet Generator**: Generate boilerplate code instantly
  - 14 pre-built templates (React, Express, Python, etc.)
  - Custom snippets via natural language descriptions
  - Inserts at cursor position with proper formatting
  - Right-click context menu integration
  - Command: `CodeSentinel: Generate Code Snippet`

  
- **📚 Documentation Generator**: Auto-generate code documentation
  - Supports JSDoc, Python docstrings, JavaDoc, and more
  - Analyzes code structure for accurate docs
  - Adds parameter types, return values, and examples
  - Command: `CodeSentinel: Generate Documentation`

## [1.0.7] - 2025-12-29

### Added
- **🎯 Git Commit Message Generator**: AI-powered conventional commit messages
  - Analyzes staged changes automatically
  - Generates conventional commit format (feat/fix/docs/etc.)
  - Prefills VS Code Source Control input box
  - Optional detailed body generation
  - Supports both Gemini and Ollama models
  - Smart scope inference from changed files
- **💬 AI Chat Side Panel**: Persistent chat in VS Code sidebar
  - Always accessible from activity bar
  - Remembers conversation context
  - Pop-out to full panel option
  - Dual-mode: Side panel + Webview panel
- **⚙️ Chat History Limit Setting**: User-configurable context memory
  - Adjustable range: 10-200 messages
  - Improves performance for low-memory systems
  - Reduces API costs for free-tier users
  - Settings → Search "chat history limit"

### Fixed
- **Chat Memory**: Fixed "historyLimit is not defined" error in chat panels
- **Variable Scoping**: Resolved scoping issues causing chat initialization failures
- **Context Persistence**: Chat now properly remembers conversation across messages

### Changed
- **Chat UX**: Enhanced side panel UI with better theming
- **Performance**: Optimized chat history management for faster responses

---

## [1.0.6] - 2025-12-29

### Added
- **AI Chat with Conversation Memory**: Chat now remembers context across messages
- **Universal Model Support**: Chat works with both Gemini API and local Ollama models
- **Improved Activity Bar Icon**: Fixed white circle icon issue with proper SVG theming
- **Auto-fallback to Ollama**: If Gemini API fails, automatically tries local Ollama

### Fixed
- Chat no longer forgets user context between messages
- Activity bar icon now properly adapts to VS Code theme colors
- Resolved dependency issues causing extension activation failures
- Fixed chat history persistence across sessions

### Changed
- Chat uses native Gemini conversation API for better memory management
- Improved error handling with automatic model fallback
- Enhanced chat UI with typing indicators

### Security
- Chat history stored locally (not sent to external servers)
- API keys remain encrypted in system keychain

---

## [1.0.5] - 2025-12-29

### Fixed
- Removed `dotenv` dependency causing "module not found" errors
- Extension now activates properly on all systems
- Resolved command registration issues

### Changed
- Simplified configuration management (no .env file needed)
- Improved error logging for troubleshooting

---

## [1.0.4] - 2025-12-28

### Fixed
- Package now includes all required node_modules dependencies
- Extension works correctly when installed from marketplace

### Changed
- Optimized package size by excluding unnecessary files

---

## [1.0.3] - 2025-12-28

### Fixed
- Side panel "data provider" error resolved
- Removed unused view containers causing activation issues

### Changed
- Simplified extension architecture for better stability

---

## [1.0.2] - 2025-12-28

### Fixed
- Chat panel activation issues
- Command palette command visibility

### Changed
- Improved command registration logic

---

## [1.0.1] - 2025-12-28

### Added
- Change log system

---

## [1.0.0] - 2025-12-28

### Added
- **Multi-Agent Code Review System**
  - Primary Agent: Code quality, performance, best practices
  - Security Agent: OWASP Top 10 vulnerability scanning
  - Validator Agent: Self-correction and confidence verification
- **Smart Auto-Fix**: AI-powered code fixing with diff preview
- **AI Chat Assistant**: Natural language code review commands
- **Folder & Workspace Review**: Recursive analysis of entire codebases
- **BYOK (Bring Your Own Key)**: Use your own Gemini API key securely
- **Universal Model Support**: 
  - Google Gemini (cloud-based)
  - Ollama (local, offline)
  - Auto-fallback mode
- **Security Features**:
  - Encrypted API key storage in system keychain
  - Secure settings migration
  - Input validation and sanitization
- **Debug Mode**: Step-by-step AI reasoning for transparency
- **Real-time Streaming**: Live response generation
- **Confidence Scoring**: AI self-assessment for reliability
- **Custom Model Selection**: Support for any Gemini or Ollama model

### Supported Languages
- JavaScript/TypeScript (including React/JSX)
- Python
- Java
- C/C++
- C#
- Go
- Ruby
- PHP
- Swift
- Kotlin
- Rust

### Security
- End-to-end encrypted API key storage
- No code sent to external servers (when using Ollama)
- Rate limiting to prevent abuse
- Input validation on all user inputs
