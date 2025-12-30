/**
 * Documentation Generator
 * Automatically generates JSDoc, docstrings, and inline documentation
 */

const vscode = require('vscode');
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

/**
 * Main command - Generate documentation for selected code
 */
async function generateDocumentationCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor. Open a file first.');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('⚠️ Please select code to document');
    return;
  }

  const language = editor.document.languageId;

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'CodeSentinel',
    cancellable: false
  }, async (progress) => {
    try {
      progress.report({ message: 'Analyzing code structure...', increment: 20 });
      logger.info('Generating documentation:', { language, codeLength: selectedText.length });

      await aiClient.initialize();

      progress.report({ message: 'Generating documentation...', increment: 40 });

      // Generate documentation based on language
      const docStyle = getDocStyle(language);
      const prompt = buildDocPrompt(selectedText, language, docStyle);

      const documentation = await aiClient.generate(prompt, {
        systemPrompt: 'You are a documentation expert. Generate clear, concise, and professional documentation. Return ONLY the documentation without code blocks or explanations.',
        maxTokens: 1000
      });

      const cleanDoc = cleanDocumentation(documentation, docStyle);

      if (!cleanDoc || cleanDoc.trim().length === 0) {
        throw new Error('Failed to generate valid documentation');
      }

      progress.report({ message: 'Inserting documentation...', increment: 40 });

      // Insert documentation above selected code
      const success = await editor.edit(editBuilder => {
        const startLine = selection.start.line;
        const insertPosition = new vscode.Position(startLine, 0);
        
        // Get indentation of selected code
        const firstLine = editor.document.lineAt(startLine).text;
        const indentation = firstLine.match(/^\s*/)[0];
        
        // Indent documentation to match code
        const indentedDoc = cleanDoc.split('\n')
          .map(line => line.trim().length > 0 ? indentation + line : line)
          .join('\n');
        
        editBuilder.insert(insertPosition, indentedDoc + '\n');
      });

      if (!success) {
        throw new Error('Failed to insert documentation. Document may be read-only.');
      }

      vscode.window.showInformationMessage(
        '✅ Documentation generated!',
        'Format Document'
      ).then(action => {
        if (action === 'Format Document') {
          vscode.commands.executeCommand('editor.action.formatDocument');
        }
      });

      logger.info('✅ Documentation generated successfully');

    } catch (error) {
      logger.error('Documentation generation failed:', error);
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
}

/**
 * Get documentation style for language
 * @private
 */
function getDocStyle(language) {
  const styleMap = {
    'javascript': 'jsdoc',
    'javascriptreact': 'jsdoc',
    'typescript': 'jsdoc',
    'typescriptreact': 'jsdoc',
    'python': 'docstring',
    'java': 'javadoc',
    'c': 'doxygen',
    'cpp': 'doxygen',
    'csharp': 'xmldoc',
    'go': 'godoc',
    'rust': 'rustdoc',
    'php': 'phpdoc',
    'ruby': 'rdoc'
  };

  return styleMap[language] || 'jsdoc';
}

/**
 * Build documentation prompt
 * @private
 */
function buildDocPrompt(code, language, docStyle) {
  const examples = getDocExamples(docStyle);

  return `Generate ${docStyle} documentation for this ${language} code.

${examples}

Code to document:
\`\`\`${language}
${code}
\`\`\`

Requirements:
- Follow ${docStyle} conventions exactly
- Document all parameters with types
- Document return values
- Add brief description
- Include @throws/@raises for exceptions if applicable
- Add @example if function is complex
- Keep descriptions concise but clear
- Return ONLY the documentation comment, no code

Documentation:`;
}

/**
 * Get documentation examples for style
 * @private
 */
function getDocExamples(docStyle) {
  const examples = {
    jsdoc: `Example JSDoc format:
/**
 * Calculates the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum of a and b
 * @throws {TypeError} If parameters are not numbers
 * @example
 * add(2, 3) // returns 5
 */`,

    docstring: `Example Python docstring format (Google style):
"""
Calculates the sum of two numbers.

Args:
    a (int): First number
    b (int): Second number

Returns:
    int: The sum of a and b

Raises:
    TypeError: If parameters are not numbers

Example:
    >>> add(2, 3)
    5
"""`,

    javadoc: `Example JavaDoc format:
/**
 * Calculates the sum of two numbers
 *
 * @param a First number
 * @param b Second number
 * @return The sum of a and b
 * @throws IllegalArgumentException If parameters are invalid
 */`,

    doxygen: `Example Doxygen format:
/**
 * @brief Calculates the sum of two numbers
 * @param a First number
 * @param b Second number
 * @return The sum of a and b
 */`,

    xmldoc: `Example XML documentation format:
/// <summary>
/// Calculates the sum of two numbers
/// </summary>
/// <param name="a">First number</param>
/// <param name="b">Second number</param>
/// <returns>The sum of a and b</returns>`,

    godoc: `Example Go documentation format:
// Add calculates the sum of two numbers.
// It returns the sum of a and b.`,

    rustdoc: `Example Rust documentation format:
/// Calculates the sum of two numbers
///
/// # Arguments
/// * \`a\` - First number
/// * \`b\` - Second number
///
/// # Returns
/// The sum of a and b`,

    phpdoc: `Example PHPDoc format:
/**
 * Calculates the sum of two numbers
 *
 * @param int $a First number
 * @param int $b Second number
 * @return int The sum of a and b
 */`
  };

  return examples[docStyle] || examples.jsdoc;
}

/**
 * Clean documentation response
 * @private
 */

/**
 * Clean documentation response
 * @private
 */
function cleanDocumentation(doc, docStyle) {
  let cleaned = doc.trim();

  // Remove markdown code blocks (FIXED: Escaping backticks to prevent syntax errors)
  // We use the unicode escape \x60 for the backtick ` character
  cleaned = cleaned.replace(/^[\x60]{3}(?:\w+)?\n/, ''); // Removes start ```js
  cleaned = cleaned.replace(/\n[\x60]{3}$/, '');         // Removes end ```
  cleaned = cleaned.replace(/[\x60]{3}/g, '');           // Removes any stray ```

  // Remove "Here's the documentation:" type prefixes
  cleaned = cleaned.replace(/^Here'?s? (?:the )?documentation:?\s*/i, '');
  cleaned = cleaned.replace(/^Here'?s? (?:the )?doc(?:s|umentation)?:?\s*/i, '');

  // Ensure proper doc format based on style
  if (docStyle === 'jsdoc' || docStyle === 'javadoc' || docStyle === 'phpdoc') {
    // Ensure it starts with /** and ends with */
    if (!cleaned.startsWith('/**')) {
      cleaned = '/**\n * ' + cleaned.split('\n').join('\n * ') + '\n */';
    } else if (!cleaned.endsWith('*/')) {
      cleaned = cleaned + '\n */';
    }
  } else if (docStyle === 'docstring') {
    // Ensure Python docstring format
    const hasTripleQuotes = cleaned.startsWith('"""') || cleaned.startsWith("'''");
    if (!hasTripleQuotes) {
      cleaned = '"""\n' + cleaned + '\n"""';
    }
  } else if (docStyle === 'xmldoc') {
    // C# XML docs should start with ///
    if (!cleaned.startsWith('///')) {
      cleaned = cleaned.split('\n').map(line => '/// ' + line).join('\n');
    }
  }

  return cleaned;
}


module.exports = { generateDocumentationCommand };
