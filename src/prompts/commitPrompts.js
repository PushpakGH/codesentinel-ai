/**
 * Commit Message Prompts
 * AI prompts for generating conventional commit messages
 */

/**
 * Generate commit message prompt
 * @param {string} diff - Git diff
 * @param {object} metadata - Parsed diff metadata
 * @returns {string}
 */
function getCommitMessagePrompt(diff, metadata) {
  const { filesChanged, insertions, deletions, changedFiles, totalChanges } = metadata;

  return `You are a Git commit message generator. Analyze the diff and create a concise, professional conventional commit message.

**Conventional Commit Format:**
<type>(<scope>): <description>

[optional body]

**Types:**
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style (formatting, semicolons, etc.)
- refactor: Code restructuring
- perf: Performance improvement
- test: Adding tests
- chore: Maintenance tasks
- ci: CI/CD changes
- build: Build system changes

**Rules:**
1. Use lowercase for type and description
2. Keep description under 50 characters
3. Scope should be a module/component name (optional)
4. No period at end of description
5. Be specific but concise

**Metadata:**
- Files changed: ${filesChanged}
- Insertions: ${insertions}
- Deletions: ${deletions}
- Changed files: ${changedFiles.slice(0, 5).join(', ')}${changedFiles.length > 5 ? '...' : ''}

**Git Diff:**
\`\`\`diff
${diff.slice(0, 3000)}${diff.length > 3000 ? '\n... (truncated)' : ''}
\`\`\`

**Output Format:**
Return ONLY the commit message (no explanations, no markdown formatting).

Example outputs:
- feat(auth): add JWT token validation
- fix(api): resolve race condition in user service
- docs(readme): update installation instructions
- refactor(utils): simplify date formatting logic

Generate the commit message:`;
}

/**
 * Generate detailed commit body prompt
 * @param {string} diff
 * @param {string} shortMessage
 * @returns {string}
 */
function getCommitBodyPrompt(diff, shortMessage) {
  return `You already generated this commit message:
"${shortMessage}"

Now generate a detailed commit body (2-3 bullet points) explaining WHAT changed and WHY.

Format:
- Point 1
- Point 2
- Point 3

Keep it concise. Return ONLY the bullet points (no extra text).`;
}

module.exports = {
  getCommitMessagePrompt,
  getCommitBodyPrompt
};
