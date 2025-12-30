/**
 * Code Snippet Generator
 * Generates boilerplate code from templates or natural language
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

// Pre-defined snippet templates
const SNIPPET_TEMPLATES = {
  // React Templates
  'react-component': {
    name: 'React Functional Component',
    language: 'javascript',
    prompt: (name) => `Generate a React functional component named "${name}" with:
- TypeScript if the file extension is .tsx, otherwise JavaScript
- PropTypes or TypeScript interface for props
- Basic JSX structure
- Export statement

Return ONLY the code, no explanations.`
  },
  'react-hook': {
    name: 'React Custom Hook',
    language: 'javascript',
    prompt: (name) => `Generate a React custom hook named "use${name}" with:
- Proper naming convention (starts with 'use')
- useState and useEffect examples
- Return statement with hook values
- TypeScript if applicable

Return ONLY the code.`
  },
  'react-context': {
    name: 'React Context + Provider',
    language: 'javascript',
    prompt: (name) => `Generate a React Context setup for "${name}" with:
- Context creation
- Provider component
- Custom hook to use the context
- TypeScript interfaces if applicable

Return ONLY the code.`
  },

  // Express/Node Templates
  'express-route': {
    name: 'Express API Route',
    language: 'javascript',
    prompt: (name) => `Generate an Express.js route for "${name}" with:
- Router setup
- GET, POST, PUT, DELETE endpoints
- Async/await error handling
- JSDoc comments

Return ONLY the code.`
  },
  'express-middleware': {
    name: 'Express Middleware',
    language: 'javascript',
    prompt: (name) => `Generate Express middleware named "${name}" with:
- Proper middleware signature (req, res, next)
- Error handling
- JSDoc comments
- Example usage comment

Return ONLY the code.`
  },
  'express-controller': {
    name: 'Express Controller',
    language: 'javascript',
    prompt: (name) => `Generate an Express controller for "${name}" with:
- CRUD methods (create, read, update, delete)
- Async/await syntax
- Error handling
- JSDoc comments

Return ONLY the code.`
  },

  // Python Templates
  'python-class': {
    name: 'Python Class',
    language: 'python',
    prompt: (name) => `Generate a Python class named "${name}" with:
- __init__ method
- Docstrings
- Type hints (Python 3.9+)
- Example methods
- __str__ and __repr__ methods

Return ONLY the code.`
  },
  'python-dataclass': {
    name: 'Python Dataclass',
    language: 'python',
    prompt: (name) => `Generate a Python dataclass for "${name}" with:
- @dataclass decorator
- Type annotations
- Default values example
- Docstring

Return ONLY the code.`
  },
  'python-async': {
    name: 'Python Async Function',
    language: 'python',
    prompt: (name) => `Generate a Python async function "${name}" with:
- async/await syntax
- Type hints
- Docstring
- Error handling
- Example usage in main

Return ONLY the code.`
  },

  // Generic Templates
  'function': {
    name: 'Function/Method',
    language: 'auto',
    prompt: (name) => `Generate a well-documented function named "${name}" in the current file's language with:
- Proper parameter handling
- Return value
- Documentation comments
- Error handling

Return ONLY the code.`
  },
  'class': {
    name: 'Class Definition',
    language: 'auto',
    prompt: (name) => `Generate a class named "${name}" in the current file's language with:
- Constructor/init method
- Properties
- Methods
- Documentation

Return ONLY the code.`
  },
  'interface': {
    name: 'Interface/Type (TypeScript)',
    language: 'typescript',
    prompt: (name) => `Generate a TypeScript interface named "${name}" with:
- Well-defined properties
- Optional properties example
- JSDoc comments
- Export statement

Return ONLY the code.`
  },

  // Test Templates
  'test-suite': {
    name: 'Test Suite',
    language: 'auto',
    prompt: (name) => `Generate a test suite for "${name}" with:
- Test framework detection (Jest/Mocha/Pytest based on language)
- Setup/teardown if needed
- Example test cases
- Descriptive test names

Return ONLY the code.`
  }
};

/**
 * Main command - Generate code snippet
 */
/**
 * Main command - Generate code snippet
 */
async function generateSnippetCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor. Open a file first.');
    return;
  }

  try {
    // Step 1: Choose template or custom
    const templateOptions = [
      { label: '$(rocket) Custom Snippet', description: 'Describe what you want in natural language', value: 'custom' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(react) React Component', description: 'Functional component with hooks', value: 'react-component' },
      { label: '$(react) React Custom Hook', description: 'Custom hook with useState/useEffect', value: 'react-hook' },
      { label: '$(react) React Context', description: 'Context + Provider setup', value: 'react-context' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(server) Express Route', description: 'REST API route with CRUD', value: 'express-route' },
      { label: '$(server) Express Middleware', description: 'Middleware function', value: 'express-middleware' },
      { label: '$(server) Express Controller', description: 'Controller with CRUD methods', value: 'express-controller' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(symbol-class) Python Class', description: 'Class with docstrings', value: 'python-class' },
      { label: '$(symbol-class) Python Dataclass', description: 'Dataclass with type hints', value: 'python-dataclass' },
      { label: '$(sync) Python Async Function', description: 'Async function with await', value: 'python-async' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      { label: '$(symbol-method) Generic Function', description: 'Function in current language', value: 'function' },
      { label: '$(symbol-class) Generic Class', description: 'Class in current language', value: 'class' },
      { label: '$(symbol-interface) TypeScript Interface', description: 'Interface/Type definition', value: 'interface' },
      { label: '$(beaker) Test Suite', description: 'Test cases for current language', value: 'test-suite' }
    ];

    const selected = await vscode.window.showQuickPick(templateOptions, {
      placeHolder: 'What do you want to generate?',
      matchOnDescription: true
    });

    if (!selected) return;

    // Step 2: Get name or description
    let prompt, snippetName;
    
    if (selected.value === 'custom') {
      const description = await vscode.window.showInputBox({
        prompt: 'Describe the code you want to generate',
        placeHolder: 'e.g., "authentication middleware with JWT"',
        validateInput: (value) => {
          return value.trim().length < 10 ? 'Please provide more details (at least 10 characters)' : null;
        }
      });

      if (!description) return;

      const language = editor.document.languageId;
      prompt = `Generate ${language} code for: "${description}"

Requirements:
- Well-structured and production-ready
- Include comments/docstrings
- Follow ${language} best practices
- Return ONLY the code, no explanations, no markdown formatting

Code:`;
      snippetName = 'custom snippet';

    } else {
      // Template-based generation
      const template = SNIPPET_TEMPLATES[selected.value];
      
      snippetName = await vscode.window.showInputBox({
        prompt: `Enter name for ${template.name}`,
        placeHolder: 'e.g., UserProfile, authMiddleware, UserModel',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Name cannot be empty';
          }
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
            return 'Name must be a valid identifier (letters, numbers, underscore)';
          }
          return null;
        }
      });

      if (!snippetName) return;

      prompt = template.prompt(snippetName);
    }

    // Step 3: Generate code with AI
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'CodeSentinel',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: `Generating ${snippetName}...`, increment: 30 });
        logger.info('Generating snippet:', { type: selected.value, name: snippetName });

        await aiClient.initialize();

        progress.report({ message: 'AI is writing code...', increment: 40 });

        const generatedCode = await aiClient.generate(prompt, {
          systemPrompt: 'You are an expert code generator. Generate clean, production-ready code. Return ONLY the raw code without any markdown formatting, explanations, or code blocks. Do NOT wrap in `````.',
          maxTokens: 1500
        });

        // Clean up response (remove markdown, extra whitespace, etc.)
        let cleanCode = extractCode(generatedCode, editor.document.languageId);

        if (!cleanCode || cleanCode.trim().length === 0) {
          throw new Error('AI failed to generate valid code. Try again or check logs.');
        }

        // Remove any leading/trailing whitespace
        cleanCode = cleanCode.trim();

        progress.report({ message: 'Inserting code...', increment: 30 });

        logger.debug('Clean code to insert:', cleanCode.substring(0, 200) + '...');

        // Step 4: Insert at cursor with proper formatting
        const success = await editor.edit(editBuilder => {
          const position = editor.selection.active;
          
          // Add newline before if not at start of line
          const lineText = editor.document.lineAt(position.line).text;
          const prefix = position.character > 0 && lineText.trim().length > 0 ? '\n\n' : '';
          
          // Add newline after
          const suffix = '\n';
          
          editBuilder.insert(position, prefix + cleanCode + suffix);
        });

        if (!success) {
          throw new Error('Failed to insert code. Document may be read-only.');
        }

        // Move cursor to end of inserted code
        const lines = cleanCode.split('\n').length;
        const lastLine = cleanCode.split('\n').pop() || '';
        const newPosition = editor.selection.active.translate(lines, lastLine.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);

        // Reveal the inserted code
        editor.revealRange(
          new vscode.Range(editor.selection.active, editor.selection.active),
          vscode.TextEditorRevealType.InCenter
        );

        vscode.window.showInformationMessage(
          `✅ Generated ${snippetName}!`,
          'Format Document'
        ).then(action => {
          if (action === 'Format Document') {
            vscode.commands.executeCommand('editor.action.formatDocument');
          }
        });

        logger.info('✅ Snippet inserted successfully');

      } catch (error) {
        logger.error('Snippet generation failed:', error);
        vscode.window.showErrorMessage(
          `❌ Failed: ${error.message}`,
          'View Logs'
        ).then(action => {
          if (action === 'View Logs') {
            logger.show();
          }
        });
      }
    });

  } catch (error) {
    logger.error('Snippet command failed:', error);
    vscode.window.showErrorMessage(`❌ Error: ${error.message}`);
  }
}

/**
 * Extract code from AI response
 * @private
 */
/**
 * Extract code from AI response (improved cleaning)
 * @private
 */
/**
 * Extract code from AI response (improved cleaning)
 * @private
 */
function extractCode(response, language) {
  let code = response;

  // Step 1: Remove markdown code blocks
  const codeBlockRegex = /``````/g;
  const matches = [...code.matchAll(codeBlockRegex)];
  
  if (matches.length > 0) {
    // Take the first code block (FIX: was "matches;[1]")
    code = matches[0][1];
  }

  // Step 2: Remove common AI response prefixes
  const prefixPatterns = [ /^Here's.*?:\s*/i, /^Here's.*?:\s*/i, /^Here is.*?:\s*/i, /^This is.*?:\s*/i, /^The code.*?:\s*/i,/^```^`+\s*/,/^=+\s*/,  // Remove leading "=" characters
  ];

  for (const pattern of prefixPatterns) {
    code = code.replace(pattern, '');
  }

  // Step 3: Remove trailing markdown (FIX: was "```+$")
  code = code.replace(/```\s*$/g, '').replace(/`+\s*$/g, '');

// Step 4: Remove file name comments if present
  code = code.replace(/^\/\/\s+\w+\.\w+\s*\n/, '');
  code = code.replace(/^#\s+\w+\.\w+\s*\n/, '');

  // Step 5: Trim whitespace
  code = code.trim();

  // Step 6: Validate it looks like code
  if (code.length < 10) {
    return '';
  }

  // Check for common code patterns
  const codePatterns = [
    /^(function|const|let|var|class|interface|type|export|import|async)/m,
    /^(def|class|async def|import|from|@)/m,
    /^(public|private|protected|class|interface|namespace)/m,
    /{.*}/s,  // Contains braces
    /\(.*\)/s  // Contains parentheses
  ];

  const looksLikeCode = codePatterns.some(pattern => pattern.test(code));

  if (!looksLikeCode) {
    logger.warn('Generated content does not look like code:', code.substring(0, 100));
  }

  return code;
}


module.exports = { generateSnippetCommand };
