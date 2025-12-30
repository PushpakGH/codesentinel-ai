/**
 * Test Case Generator
 * Automatically generates unit tests for selected code
 */

const vscode = require('vscode');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');
const aiClient = require('../services/aiClient');
const configManager = require('../services/configManager');

/**
 * Main command - Generate tests for selected code
 */
async function generateTestsCommand() {
  const editor = vscode.window.activeTextEditor;
  
  if (!editor) {
    vscode.window.showErrorMessage('❌ No active editor. Open a file first.');
    return;
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection);

  if (!selectedText || selectedText.trim().length === 0) {
    vscode.window.showWarningMessage('⚠️ Please select code to generate tests for');
    return;
  }

  const language = editor.document.languageId;
  const fileName = path.basename(editor.document.fileName);

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: 'CodeSentinel',
    cancellable: false
  }, async (progress) => {
    try {
      progress.report({ message: 'Analyzing code structure...', increment: 20 });
      logger.info('Generating tests:', { language, fileName, codeLength: selectedText.length });

      // Detect test framework
      const framework = await detectTestFramework(editor.document.uri, language);
      logger.info('Detected test framework:', framework);

      await aiClient.initialize();

      progress.report({ message: `Generating ${framework} tests...`, increment: 40 });

      // Generate tests
      const prompt = buildTestPrompt(selectedText, language, framework, fileName);

      const testCode = await aiClient.generate(prompt, {
        systemPrompt: 'You are a test writing expert. Generate comprehensive unit tests with edge cases. Return ONLY the test code without explanations or markdown.',
        maxTokens: 2000
      });

      const cleanTests = cleanTestCode(testCode, framework);

      if (!cleanTests || cleanTests.trim().length === 0) {
        throw new Error('Failed to generate valid tests');
      }

      progress.report({ message: 'Creating test file...', increment: 30 });

      // Determine test file path
      const testFilePath = await getTestFilePath(editor.document.uri, language, framework);

      // Write test file
      await fs.writeFile(testFilePath.fsPath, cleanTests, 'utf-8');

      progress.report({ message: 'Opening test file...', increment: 10 });

      // Open the created test file
      const testDoc = await vscode.workspace.openTextDocument(testFilePath);
      await vscode.window.showTextDocument(testDoc, vscode.ViewColumn.Beside);

      vscode.window.showInformationMessage(
        `✅ Tests generated: ${path.basename(testFilePath.fsPath)}`,
        'Run Tests',
        'Add More Tests'
      ).then(action => {
        if (action === 'Run Tests') {
          runTests(testFilePath, framework);
        } else if (action === 'Add More Tests') {
          vscode.commands.executeCommand('codeSentinel.generateTests');
        }
      });

      logger.info('✅ Tests generated successfully:', testFilePath.fsPath);

    } catch (error) {
      logger.error('Test generation failed:', error);
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
 * Detect test framework from project
 * @private
 */
async function detectTestFramework(documentUri, language) {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(documentUri);
  
  if (!workspaceFolder) {
    return getDefaultFramework(language);
  }

  try {
    // Check package.json for JS/TS projects
    if (language === 'javascript' || language === 'typescript' || 
        language === 'javascriptreact' || language === 'typescriptreact') {
      
      const packageJsonPath = path.join(workspaceFolder.uri.fsPath, 'package.json');
      const packageJson = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(packageJson);

      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies
      };

      // Priority order: Jest > Vitest > Mocha
      if (allDeps['jest'] || allDeps['@jest/globals']) return 'jest';
      if (allDeps['vitest']) return 'vitest';
      if (allDeps['mocha']) return 'mocha';
      if (allDeps['@playwright/test']) return 'playwright';
    }

    // Check for Python test frameworks
    if (language === 'python') {
      const requirementsPath = path.join(workspaceFolder.uri.fsPath, 'requirements.txt');
      try {
        const requirements = await fs.readFile(requirementsPath, 'utf-8');
        if (requirements.includes('pytest')) return 'pytest';
        if (requirements.includes('unittest')) return 'unittest';
      } catch (e) {
        // requirements.txt doesn't exist, use default
      }
    }

  } catch (error) {
    logger.warn('Could not detect test framework:', error.message);
  }

  return getDefaultFramework(language);
}

/**
 * Get default framework for language
 * @private
 */
function getDefaultFramework(language) {
  const defaults = {
    'javascript': 'jest',
    'javascriptreact': 'jest',
    'typescript': 'jest',
    'typescriptreact': 'jest',
    'python': 'pytest',
    'java': 'junit',
    'csharp': 'nunit',
    'go': 'testing'
  };

  return defaults[language] || 'jest';
}

/**
 * Build test generation prompt
 * @private
 */
function buildTestPrompt(code, language, framework, fileName) {
  const examples = getFrameworkExamples(framework);

  return `Generate comprehensive unit tests for this ${language} code using ${framework}.

Code to test (from ${fileName}):
\`\`\`${language}
${code}
\`\`\`

${examples}

Requirements:
1. Test happy path (normal inputs)
2. Test edge cases (empty, null, undefined, zero, negative)
3. Test error conditions (invalid inputs, exceptions)
4. Use descriptive test names
5. Add setup/teardown if needed
6. Mock external dependencies
7. Follow ${framework} best practices
8. Include comments explaining what each test verifies

Return ONLY the complete test file code, no explanations.

Test code:`;
}

/**
 * Get framework-specific examples
 * @private
 */
function getFrameworkExamples(framework) {
  const examples = {
    jest: `Example Jest test structure:
\`\`\`javascript
describe('functionName', () => {
  test('should handle normal input', () => {
    expect(functionName('input')).toBe('expected');
  });

  test('should throw error on invalid input', () => {
    expect(() => functionName(null)).toThrow('Error message');
  });

  test('should handle edge case', () => {
    expect(functionName('')).toBe('');
  });
});
\`\`\``,

    vitest: `Example Vitest test structure:
\`\`\`javascript
import { describe, it, expect } from 'vitest';

describe('functionName', () => {
  it('should handle normal input', () => {
    expect(functionName('input')).toBe('expected');
  });
});
\`\`\``,

    mocha: `Example Mocha test structure:
\`\`\`javascript
const { expect } = require('chai');

describe('functionName', () => {
  it('should handle normal input', () => {
    expect(functionName('input')).to.equal('expected');
  });
});
\`\`\``,

    pytest: `Example Pytest test structure:
\`\`\`python
import pytest

def test_function_normal_input():
    """Test normal input case"""
    assert function_name('input') == 'expected'

def test_function_invalid_input():
    """Test invalid input raises error"""
    with pytest.raises(ValueError):
        function_name(None)

def test_function_edge_case():
    """Test edge case"""
    assert function_name('') == ''
\`\`\``,

    unittest: `Example unittest structure:
\`\`\`python
import unittest

class TestFunctionName(unittest.TestCase):
    def test_normal_input(self):
        self.assertEqual(function_name('input'), 'expected')
    
    def test_invalid_input(self):
        with self.assertRaises(ValueError):
            function_name(None)
\`\`\``,

    junit: `Example JUnit test structure:
\`\`\`java
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class FunctionNameTest {
    @Test
    void shouldHandleNormalInput() {
        assertEquals("expected", functionName("input"));
    }
    
    @Test
    void shouldThrowOnInvalidInput() {
        assertThrows(IllegalArgumentException.class, () -> {
            functionName(null);
        });
    }
}
\`\`\``,

    nunit: `Example NUnit test structure:
\`\`\`csharp
using NUnit.Framework;

[TestFixture]
public class FunctionNameTests
{
    [Test]
    public void ShouldHandleNormalInput()
    {
        Assert.AreEqual("expected", FunctionName("input"));
    }
    
    [Test]
    public void ShouldThrowOnInvalidInput()
    {
        Assert.Throws<ArgumentException>(() => FunctionName(null));
    }
}
\`\`\``,

    testing: `Example Go testing structure:
\`\`\`go
package mypackage

import "testing"

func TestFunctionName(t *testing.T) {
    result := FunctionName("input")
    if result != "expected" {
        t.Errorf("Expected 'expected', got '%s'", result)
    }
}

func TestFunctionNameError(t *testing.T) {
    _, err := FunctionName("")
    if err == nil {
        t.Error("Expected error for empty input")
    }
}
\`\`\``,

    playwright: `Example Playwright test structure:
\`\`\`javascript
import { test, expect } from '@playwright/test';

test.describe('ComponentName', () => {
  test('should render correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('selector')).toBeVisible();
  });
  
  test('should handle user interaction', async ({ page }) => {
    await page.click('button');
    await expect(page.locator('result')).toHaveText('expected');
  });
});
\`\`\``,
  };

  return examples[framework] || examples.jest;
}

/**
 * Clean test code from AI response
 * @private
 */
function cleanTestCode(code, framework) {
  let cleaned = code.trim();

  // Remove markdown code blocks
  cleaned = cleaned.replace(/^```[\s\S]*?\n/gm, '');
  cleaned = cleaned.replace(/\n```$/gm, '');
  cleaned = cleaned.replace(/```[\s\S]*?$/gm, '');

  // Remove explanatory text
  cleaned = cleaned.replace(/^Here'?s? (?:the )?test(?:s)?:?\s*/i, '');
  cleaned = cleaned.replace(/^Here'?s? (?:a )?comprehensive test suite:?\s*/i, '');

  return cleaned.trim();
}

/**
 * Determine test file path based on conventions
 * @private
 */
async function getTestFilePath(sourceUri, language, framework) {
  const sourcePath = sourceUri.fsPath;
  const dir = path.dirname(sourcePath);
  const fileName = path.basename(sourcePath);
  const nameWithoutExt = path.parse(fileName).name;
  const ext = path.extname(fileName);

  let testFileName;
  let testDir;

  // Language-specific conventions
  if (language === 'javascript' || language === 'typescript' || 
      language.includes('react')) {
    
    // Check if __tests__ folder exists
    const testsDir = path.join(dir, '__tests__');
    try {
      await fs.access(testsDir);
      testDir = testsDir;
    } catch {
      testDir = dir; // Same directory
    }

    // Jest/Vitest convention: .test.js or .spec.js
    const suffix = framework === 'vitest' ? '.spec' : '.test';
    testFileName = `${nameWithoutExt}${suffix}${ext}`;

  } else if (language === 'python') {
    
    // Python convention: test_filename.py
    testDir = dir;
    testFileName = `test_${nameWithoutExt}.py`;

  } else if (language === 'java') {
    
    // Java convention: ClassNameTest.java in test/ directory
    testDir = path.join(path.dirname(dir), 'test', path.basename(dir));
    testFileName = `${nameWithoutExt}Test.java`;
    
    // Create test directory if it doesn't exist
    await fs.mkdir(testDir, { recursive: true });

  } else {
    // Default: same directory, .test suffix
    testDir = dir;
    testFileName = `${nameWithoutExt}.test${ext}`;
  }

  const testPath = path.join(testDir, testFileName);
  
  // Check if file already exists
  try {
    await fs.access(testPath);
    const overwrite = await vscode.window.showWarningMessage(
      `Test file already exists: ${testFileName}`,
      'Overwrite',
      'Cancel'
    );
    
    if (overwrite !== 'Overwrite') {
      throw new Error('User cancelled - test file already exists');
    }
  } catch (e) {
    // File doesn't exist, that's fine
  }

  return vscode.Uri.file(testPath);
}

/**
 * Run tests in terminal
 * @private
 */
function runTests(testFilePath, framework) {
  const terminal = vscode.window.createTerminal('Test Runner');
  terminal.show();

  const commands = {
    'jest': `npx jest "${testFilePath.fsPath}"`,
    'vitest': `npx vitest run "${testFilePath.fsPath}"`,
    'mocha': `npx mocha "${testFilePath.fsPath}"`,
    'pytest': `pytest "${testFilePath.fsPath}" -v`,
    'unittest': `python -m unittest "${testFilePath.fsPath}"`,
    'playwright': `npx playwright test "${testFilePath.fsPath}"`
  };

  const command = commands[framework] || commands.jest;
  terminal.sendText(command);
}

module.exports = { generateTestsCommand };
