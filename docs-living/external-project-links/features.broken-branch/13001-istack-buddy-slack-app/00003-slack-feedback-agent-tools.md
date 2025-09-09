# Slack Feedback Collection - Agent Tools Implementation

## Overview

Instead of implementing feedback collection via slash commands (which have thread limitations), we've implemented feedback and rating collection as **slacky agent tools**. This allows users to naturally ask iStackBuddy for feedback collection during conversations, and the agent can proactively collect feedback when appropriate.

## Architecture

### Agent Tool Approach

- **Feedback Tool**: `collect_user_feedback` - Collects text feedback from users
- **Rating Tool**: `collect_user_rating` - Collects numerical ratings from users
- **Integration**: Tools are part of the slacky tool chain, available to the Slacky agent
- **Storage**: Simple logging mechanism for feedback data

### Benefits over Slash Commands

1. **Thread Support**: Works in any context (channels, threads, DMs)
2. **Natural Interaction**: Users can ask "I'd like to give feedback"
3. **Proactive Collection**: Agent can ask for feedback at appropriate moments
4. **Context Aware**: Agent understands conversation context when collecting feedback

## Tool Definitions

### Collect User Feedback Tool

```typescript
{
  name: 'collect_user_feedback',
  description: 'Collect text feedback from users about iStackBuddy interactions or general service',
  input_schema: {
    type: 'object',
    properties: {
      feedback: {
        type: 'string',
        description: 'The user feedback text content'
      },
      category: {
        type: 'string',
        description: 'Feedback category: conversation, service, feature_request, bug_report, other',
        enum: ['conversation', 'service', 'feature_request', 'bug_report', 'other']
      }
    },
    required: ['feedback', 'category']
  }
}
```

### Collect User Rating Tool

```typescript
{
  name: 'collect_user_rating',
  description: 'Collect numerical rating from users about iStackBuddy interactions',
  input_schema: {
    type: 'object',
    properties: {
      rating: {
        type: 'integer',
        description: 'Rating from -5 to +5 where -5=terrible, 0=neutral, +5=excellent'
      },
      context: {
        type: 'string',
        description: 'What the rating is about: conversation, response_quality, helpfulness, overall_service'
      },
      comment: {
        type: 'string',
        description: 'Optional comment explaining the rating'
      }
    },
    required: ['rating', 'context']
  }
}
```

## Rating Scale

The rating system uses a **-5 to +5 scale** with meaningful labels:

- **-5**: "World War III bad" - Completely terrible
- **-4**: "Very poor" - Major issues
- **-3**: "Poor" - Significant problems
- **-2**: "Misleading or just wrong" - Incorrect information
- **-1**: "Information had inaccuracies" - Minor errors
- **0**: "Not good/not bad" - Neutral
- **+1**: "A little helpful" - Slightly positive
- **+2**: "Helpful, will use again" - Good experience
- **+3**: "Very helpful" - Great experience
- **+4**: "Excellent" - Outstanding
- **+5**: "Nominate iStackBuddy for world peace prize" - Perfect

## Usage Examples

### Natural Feedback Collection

```
User: "I'd like to give some feedback about my experience"
iStackBuddy: "I'd be happy to collect your feedback! What would you like to share?"
User: "The response was helpful but took a bit long to generate"
iStackBuddy: [calls collect_user_feedback tool]
```

### Proactive Rating Request

```
iStackBuddy: "I just helped you with that complex database query. How would you rate the helpfulness of my response on a scale of -5 to +5?"
User: "I'd give it a +4, very helpful!"
iStackBuddy: [calls collect_user_rating tool]
```

### Contextual Feedback

```
User: "That answer was completely wrong"
iStackBuddy: "I apologize for the incorrect information. Let me collect your feedback to improve. Would you rate this interaction?"
User: "I'd rate it -2, the information was misleading"
iStackBuddy: [calls collect_user_rating with context about accuracy]
```

## Implementation Details

### Tool Integration

- Tools are added to `SlackyToolsEnum` as:
  - `CollectUserFeedback = 'collect_user_feedback'`
  - `CollectUserRating = 'collect_user_rating'`

### Logging Implementation

Each tool call logs structured data:

```typescript
// Feedback Log Entry
{
  timestamp: new Date().toISOString(),
  type: 'feedback',
  user_id: string,
  channel_id: string,
  feedback: string,
  category: string,
  conversation_context: string
}

// Rating Log Entry
{
  timestamp: new Date().toISOString(),
  type: 'rating',
  user_id: string,
  channel_id: string,
  rating: number,
  context: string,
  comment?: string,
  conversation_context: string
}
```

### Storage Location

- Logs written to: `docs-living/debug-logging/feedback/`
- Filename format: `feedback-{timestamp}.log`
- JSON format for easy parsing and analysis

## Agent Behavior Guidelines

### When to Collect Feedback

- User explicitly requests to give feedback
- After complex or lengthy assistance
- When user expresses dissatisfaction
- Periodically for active users (not too frequently)
- After resolving technical issues

### How to Ask for Feedback

- Natural, conversational tone
- Specific context (what you're asking feedback about)
- Clear rating scale explanation when needed
- Respect user's choice not to provide feedback

### Response to Feedback

- Always thank users for feedback
- Acknowledge specific points raised
- For negative feedback, apologize and commit to improvement
- For positive feedback, express appreciation

## Benefits

1. **Seamless Integration**: Works naturally within conversations
2. **Context Preservation**: Agent knows what conversation the feedback relates to
3. **Flexible Timing**: Can collect feedback at optimal moments
4. **Thread Compatible**: No Slack platform limitations
5. **Adaptive**: Agent can adjust collection based on user preferences
6. **Rich Context**: Feedback includes conversation context automatically

## Future Enhancements

- **Analytics Dashboard**: Process logged feedback into insights
- **Trend Analysis**: Track rating improvements over time
- **Automated Reporting**: Regular feedback summaries
- **User Preferences**: Remember user feedback preferences
- **Integration**: Connect with existing feedback systems
