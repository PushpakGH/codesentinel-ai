const CodeValidator = require('/src/utils/codeValidat');

// Test 1: Bad client code
const badCode = `
'use client';
import fs from 'fs';

export default function BadComponent() {
  return <div>Test</div>;
}
`;

console.log('=== Test 1: Environment Leak Detection ===');
const result1 = CodeValidator.validateSyntax(badCode);
console.log('Errors:', result1.errors);
console.log('Valid:', result1.valid);

// Test 2: Good code
const goodCode = `
import React from 'react';

export default function GoodComponent() {
  return <div className="p-4">Hello World</div>;
}
`;

console.log('\n=== Test 2: Valid Code ===');
const result2 = CodeValidator.validateSyntax(goodCode);
console.log('Errors:', result2.errors);
console.log('Valid:', result2.valid);
