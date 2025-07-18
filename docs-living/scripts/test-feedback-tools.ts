#!/usr/bin/env ts-node

import { slackyToolSet } from '../../src/robots/tool-definitions/slacky';
import { SlackyToolsEnum } from '../../src/robots/tool-definitions/slacky/types';

console.log('🧪 Testing Slacky Feedback Tools\n');

// Test feedback collection
console.log('📝 Testing Feedback Collection Tool...');
const feedbackResult = slackyToolSet.executeToolCall(
  SlackyToolsEnum.CollectUserFeedback,
  {
    feedback:
      'The AI response was very helpful, but it took a bit long to generate.',
    category: 'conversation',
  },
);

console.log('Result:', feedbackResult);
console.log('\n' + '='.repeat(80) + '\n');

// Test rating collection
console.log('⭐ Testing Rating Collection Tool...');
const ratingResult = slackyToolSet.executeToolCall(
  SlackyToolsEnum.CollectUserRating,
  {
    rating: 4,
    context: 'helpfulness',
    comment: 'Very helpful response, clear and detailed',
  },
);

console.log('Result:', ratingResult);
console.log('\n' + '='.repeat(80) + '\n');

// Test negative rating
console.log('💥 Testing Negative Rating...');
const negativeRatingResult = slackyToolSet.executeToolCall(
  SlackyToolsEnum.CollectUserRating,
  {
    rating: -2,
    context: 'response_quality',
    comment: 'The information provided was incorrect',
  },
);

console.log('Result:', negativeRatingResult);
console.log('\n' + '='.repeat(80) + '\n');

// Test invalid rating
console.log('❌ Testing Invalid Rating...');
const invalidRatingResult = slackyToolSet.executeToolCall(
  SlackyToolsEnum.CollectUserRating,
  {
    rating: 10,
    context: 'helpfulness',
  },
);

console.log('Result:', invalidRatingResult);
console.log('\n' + '='.repeat(80) + '\n');

// Test bug report feedback
console.log('🐛 Testing Bug Report Feedback...');
const bugReportResult = slackyToolSet.executeToolCall(
  SlackyToolsEnum.CollectUserFeedback,
  {
    feedback:
      'The search function returns an error when I try to filter by date range.',
    category: 'bug_report',
  },
);

console.log('Result:', bugReportResult);
console.log('\n' + '='.repeat(80) + '\n');

// Test feature request
console.log('💡 Testing Feature Request...');
const featureRequestResult = slackyToolSet.executeToolCall(
  SlackyToolsEnum.CollectUserFeedback,
  {
    feedback:
      'It would be great if the AI could remember context from previous conversations.',
    category: 'feature_request',
  },
);

console.log('Result:', featureRequestResult);
console.log(
  '\n✅ All tests completed! Check docs-living/debug-logging/feedback/ for log files.\n',
);
