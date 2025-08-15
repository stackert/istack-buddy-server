// Simple test to show KB output format
const {
  KnowledgeBaseService,
} = require('./dist/istack-buddy-slack-api/knowledge-base.service');

async function testKBOutput() {
  const kbService = new KnowledgeBaseService();

  console.log('=== Knowledge Base Test Output ===\n');

  // Test different KB values
  const testCases = [
    'slack:cx-formstack',
    'slack:forms-sso-autofill',
    'slack:cx-f4sf',
    'slack:all',
  ];

  for (const kbValue of testCases) {
    console.log(`\n--- Testing: ${kbValue} ---`);
    const results = await kbService.getSearchResults({ kb: kbValue });

    results.forEach((result, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`Link: ${result.message_link}`);
      console.log(`Excerpt: ${result.excerpt_text}`);
      console.log(`Relevance: ${Math.round(result.relevance_score * 100)}%`);
      console.log(`Date: ${result.original_post_date}`);
      console.log(`Author: ${result.author}`);
    });
  }
}

// Note: This would need to be run after building the project
// npm run build && node test-kb-output.js
console.log('To run this test:');
console.log('1. npm run build');
console.log('2. node test-kb-output.js');
