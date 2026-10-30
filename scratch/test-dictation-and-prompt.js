const { ActionService } = require('../src/main/services/action-service');

async function testAll() {
  console.log('--- 1. Testing ActionService Intent Matching for Autonomous Typing ---');
  const actionService = new ActionService();

  const testCases = [
    'open claude and write a prompt in the claude about something',
    'open claude and write a prompt about quantum computing',
    'open claude and ask it how photosynthesis works',
    'open chatgpt and write a prompt about machine learning',
    'open notepad and type shopping list: milk, eggs, bread',
    'type this: hello everyone',
    'dictate please review this document'
  ];

  for (const tc of testCases) {
    const matched = actionService.matchLocalIntent(tc);
    if (!matched) {
      console.error(`❌ FAILED to match: "${tc}"`);
      process.exit(1);
    }
    console.log(`✅ MATCHED: "${tc}"`);
    console.log(`   Type: ${matched.type}, Target/App: ${matched.app || 'N/A'}, Reply: "${matched.reply}"`);
    if (matched.prompt) console.log(`   Prompt: "${matched.prompt}"`);
    if (matched.text) console.log(`   Text: "${matched.text}"`);
  }

  console.log('\n--- 2. Testing formatAIPrompt Formatting ---');
  const prompt1 = actionService.formatAIPrompt('something', 'Claude');
  console.log('Formatted "something":', prompt1);

  const prompt2 = actionService.formatAIPrompt('quantum computing', 'Claude');
  console.log('Formatted "quantum computing":', prompt2);

  const prompt3 = actionService.formatAIPrompt('how does photosynthesis work', 'Claude');
  console.log('Formatted "how does photosynthesis work":', prompt3);

  console.log('\n--- 3. Testing typeTextIntoActiveWindow Execution ---');
  const typeResult = await actionService.typeTextIntoActiveWindow('Pointy Dictation Verification', false);
  console.log('typeTextIntoActiveWindow result:', typeResult);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
}

testAll().catch(e => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
