#!/usr/bin/env ts-node

// Load environment variables from .env file (if it exists)
import * as dotenv from 'dotenv';
dotenv.config();

// Import robot and types
import { AnthropicMarv } from '../../src/robots/AnthropicMarv';
import type { TConversationTextMessageEnvelope } from '../../src/robots/types';

console.log(`
Robot Architecture Demo Script
==============================

This script demonstrates the robot architecture and message envelope creation
without requiring actual API credentials. It shows how the system is structured
and how messages flow through the robot system.
`);

// Form ID to analyze
const FORM_ID = '6201623';

/**
 * Create a message envelope for the robot
 */
function createUserMessage(content: string): TConversationTextMessageEnvelope {
  return {
    messageId: `msg-${Date.now()}`,
    requestOrResponse: 'request',
    envelopePayload: {
      messageId: `payload-${Date.now()}`,
      author_role: 'user',
      content: {
        type: 'text/plain',
        payload: content,
      },
      created_at: new Date().toISOString(),
      estimated_token_count: Math.ceil(content.length / 4),
    },
  };
}

/**
 * Demonstrate message envelope creation and robot initialization
 */
function demonstrateRobotArchitecture() {
  console.log(`
Robot Architecture Demonstration
================================

1. **Robot Initialization**
`);

  // Create robot instance (this works without API keys)
  const robot = new AnthropicMarv();

  console.log(`   ✅ AnthropicMarv robot created successfully`);
  console.log(`   - Model: ${robot.LLModelName}`);
  console.log(`   - Version: ${robot.LLModelVersion}`);
  console.log(
    `   - Context Window: ${robot.contextWindowSizeInTokens.toLocaleString()} tokens`,
  );
  console.log(`   - Robot Name: ${robot.name} v${robot.version}`);

  console.log(`
2. **Message Envelope Creation**
`);

  // Create sample messages
  const messages = [
    'Please validate calculations for form 6201623',
    'Can you analyze form 6201623 for calculation issues?',
    'I need help with form 6201623. First get an overview, then run calculation validation.',
  ];

  messages.forEach((content, index) => {
    const messageEnvelope = createUserMessage(content);
    console.log(`   Message ${index + 1}:`);
    console.log(`   - Content: "${content}"`);
    console.log(`   - Message ID: ${messageEnvelope.messageId}`);
    console.log(
      `   - Estimated Tokens: ${messageEnvelope.envelopePayload.estimated_token_count}`,
    );
    console.log(
      `   - Timestamp: ${messageEnvelope.envelopePayload.created_at}`,
    );
    console.log('');
  });

  console.log(`
3. **Tool Availability**
`);

  // Access tool definitions through the robot
  const tools = (robot as any).tools || [];
  console.log(`   Available tools: ${tools.length}`);

  tools.forEach((tool: any, index: number) => {
    console.log(`   ${index + 1}. ${tool.name}`);
    console.log(`      Description: ${tool.description.substring(0, 80)}...`);
  });

  console.log(`
4. **Token Estimation**
`);

  const sampleText =
    'Please validate the calculations for form 6201623. I am concerned about circular references.';
  const estimatedTokens = robot.estimateTokens(sampleText);
  console.log(`   Sample text: "${sampleText}"`);
  console.log(`   Estimated tokens: ${estimatedTokens}`);
  console.log(
    `   Calculation: ~${Math.ceil(sampleText.length / 4)} (length / 4)`,
  );

  return robot;
}

/**
 * Demonstrate the message processing flow (without API calls)
 */
function demonstrateMessageFlow() {
  console.log(`
Message Processing Flow
=======================

This shows how messages would flow through the system:

1. **User Input** → Natural language request
   "Please validate calculations for form 6201623"

2. **Message Envelope Creation** → Structured message format
   {
     messageId: "msg-1672531200000",
     requestOrResponse: "request",
     envelopePayload: {
       messageId: "payload-1672531200000",
       author_role: "user",
       content: { type: "text/plain", payload: "..." },
       created_at: "2024-01-01T00:00:00.000Z",
       estimated_token_count: 15
     }
   }

3. **Robot Processing** → AnthropicMarv analyzes request
   - Parses natural language intent
   - Identifies relevant tools (FormCalculationValidation)
   - Prepares tool execution parameters

4. **Tool Execution** → Real API calls
   - FormCalculationValidation tool called with formId: "6201623"
   - Formstack API queried for form data
   - ObservationMakerCalculationValidation analyzes calculations
   - Results returned with detailed findings

5. **Response Generation** → Human-readable analysis
   - Robot interprets technical results
   - Provides contextual explanations
   - Suggests remediation actions
   - Returns structured response envelope

6. **User Receives** → Actionable insights
   "I found 26 fields with calculation errors including circular references..."
`);
}

/**
 * Show what the robot's system prompt contains
 */
function demonstrateRobotCapabilities() {
  console.log(`
Robot Capabilities Overview
===========================

AnthropicMarv is specialized for Formstack form management with these tool categories:

**Form Management:**
- formLiteAdd: Create new forms with field definitions
- formDeveloperCopy: Create development copies

**Field Operations:**
- fieldLiteAdd: Add fields to existing forms  
- fieldRemove: Remove fields by ID

**Logic Management:**
- fieldLogicStashCreate: Backup current logic
- fieldLogicStashApply: Restore backed up logic
- fieldLogicStashApplyAndRemove: Restore then delete backup
- fieldLogicStashRemove: Delete backup without applying
- fieldLogicRemove: Remove all field logic

**Label Management:**
- fieldLabelUniqueSlugAdd: Add unique field identifiers
- fieldLabelUniqueSlugRemove: Remove unique identifiers

**Validation & Analysis:**
- formLogicValidation: Validate form logic for errors
- formCalculationValidation: Validate calculations and detect circular references
- formAndRelatedEntityOverview: Get comprehensive form statistics

**Key Features:**
- Natural language processing of form management requests
- Automatic tool selection based on user intent
- Real Formstack API integration
- Comprehensive error handling and validation
- Support for both immediate and streaming responses
`);
}

/**
 * Main execution function
 */
function main() {
  console.log(`
Starting Robot Architecture Demo...
`);

  try {
    // Demonstrate robot architecture
    const robot = demonstrateRobotArchitecture();

    // Show message flow
    demonstrateMessageFlow();

    // Show robot capabilities
    demonstrateRobotCapabilities();

    console.log(`
Demo completed! 🎉

This demonstration showed:
=========================

✅ **Robot Initialization**: How AnthropicMarv robots are created
✅ **Message Envelopes**: Structured communication format
✅ **Tool Integration**: Access to 13 Formstack management tools  
✅ **Token Estimation**: Efficient resource usage calculation
✅ **Message Flow**: Complete request → processing → response cycle
✅ **Capabilities**: Comprehensive form management and validation

To see this working with real API calls, run:
  npx ts-node docs-living/scripts/example-robot-calculation-validation.ts

With proper API credentials set:
  export CORE_FORMS_API_V2_KEY="your-formstack-key"
  export ANTHROPIC_API_KEY="your-anthropic-key"
`);
  } catch (error) {
    console.error('Error in demo:', error);
  }
}

// Run the demo
if (require.main === module) {
  main();
}

export {
  demonstrateRobotArchitecture,
  demonstrateMessageFlow,
  demonstrateRobotCapabilities,
  createUserMessage,
};
