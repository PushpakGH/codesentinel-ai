const { runCommand } = require('../utils/commandRunner');

async function test() {
  console.log('Testing commandRunner...');
  const result = await runCommand('echo "Hello World"', process.cwd(), 'Test Echo');
  
  if (result.success && result.stdout.includes('Hello World')) {
     console.log('✅ Command Runner Works!');
  } else {
     console.error('❌ Command Runner Failed:', result);
  }
}

test().catch(console.error);
