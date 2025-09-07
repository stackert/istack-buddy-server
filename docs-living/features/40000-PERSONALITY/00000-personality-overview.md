# Personality Robot System

## Overview

A system to provide personalized robot interactions by injecting invisible personality context into conversations. When Slack messages come through, the system will look up user personality profiles and slip that context into the conversation invisibly, instructing robots on:

1. **User's personality traits** - communication style, expertise, preferences
2. **Robot interaction guidelines** - how the robot should adapt its responses

## Current Architecture Assessment

### ✅ Strong Foundation Exists

**Robust Robot Framework:**
- `AbstractRobotChat` with intent-based processing via `handleIntentWithTools()`
- Multiple specialized robots (AnthropicMarv, SlackyOpenAiAgent, KnobbyOpenAi*)
- Clear message flow through ChatManager

**Rich Message Types:**
- Multiple content types in `TConversationMessageContent` 
- System message types that can carry invisible context
- Support for `content/dynamic` and custom message types

**User Profile System:**
- Existing `UserProfileService` with JSON-based storage
- User lookup by email/ID already implemented
- Ready for extension with personality data

**Message Flow Control:**
- Clear injection points in `ChatManagerService.addMessageFromSlack()`
- Systematic message processing with callback mechanisms

## Implementation Strategy

### Personality Profile Data Structure

```typescript
interface PersonalityProfile {
  userId: string;
  personalityTraits: {
    communicationStyle: 'formal' | 'casual' | 'technical' | 'friendly';
    expertise: string[]; // ['forms', 'SAML', 'APIs', 'troubleshooting']
    preferredTone: 'professional' | 'encouraging' | 'direct' | 'supportive';
    interests: string[];
    workingStyle: string; // Free text description
  };
  robotInteractionRules: {
    preferredResponseLength: 'brief' | 'detailed' | 'comprehensive';
    shouldUseAnalogies: boolean;
    technicalLevel: 'beginner' | 'intermediate' | 'expert';
    customInstructions: string; // Robot-specific guidance
  };
  metadata: {
    createdAt: string;
    updatedAt: string;
    lastUsed: string;
  };
}
```

### Invisible Context Injection

**New Content Type:**
```typescript
type TPersonalityContext = TConversationMessageContentTypes<
  'context/personality',
  {
    personalityProfile: PersonalityProfile;
    interactionGuidelines: string;
    contextualHints: string[];
  }
>;
```

**Injection Point in ChatManager:**
```typescript
// In ChatManagerService.addMessageFromSlack(), after line 600:
const personalityContext = await this.injectPersonalityContext(
  conversationId, 
  'cx-slack-robot'
);

if (personalityContext) {
  // Add invisible system message before robot processing
  await this.addSystemMessage(
    conversationId, 
    personalityContext, 
    MessageType.SYSTEM
  );
}
```

### Slack User Mapping

**Enhanced Slack Integration:**
```typescript
// In handleAppMention()
const slackUser = await this.getSlackUserInfo(event.user);
const personalityProfile = await this.userProfileService
  .getPersonalityProfileByEmail(slackUser.email);
```

## Architecture Decision: Storage Location

### User-Profile Service (RECOMMENDED)

**Why This Approach:**
- ✅ **Behavioral Consistency**: Personality data is user metadata, like existing user profiles
- ✅ **Access Pattern**: Needed for every message processing (not episodic requests)
- ✅ **Data Lifecycle**: Configuration-like data that persists across conversations  
- ✅ **Integration**: ChatManager already uses UserProfileService
- ✅ **Faster Implementation**: Extends existing patterns

**Implementation:**
```typescript
// Extend existing user-profiles.json structure
interface ExtendedUserProfile {
  // ... existing fields (id, email, username, etc.)
  
  personalityProfile?: PersonalityProfile; // Optional for gradual rollout
}
```

### Information-Services Alternative (FUTURE CONSIDERATION)

**When Information-Services Would Make Sense:**
- Advanced personality analytics (conversation pattern analysis)  
- `KnobbyPersonalityAnalyzer` robot for personality insights
- Multi-source personality data aggregation
- Personality matching and reporting features

**Current Assessment**: Information-Services focuses on "requestable/searchable" data, while personality injection is automatic user metadata. Better architectural fit with User-Profile Service.

## Implementation Phases

### Phase 1: Foundation (Minimal Viable Personality)
1. **Extend UserProfileService** → Add personality profile support to existing JSON structure
2. **Create PersonalityService** → Handle profile lookup and context generation  
3. **Modify ChatManager** → Inject personality context in `addMessageFromSlack()`
4. **Test with Existing Robots** → Verify SlackyOpenAiAgent/AnthropicMarv handle personality context

### Phase 2: Slack Integration
1. **Slack User Mapping** → Connect Slack user IDs to email addresses to personality profiles
2. **Profile Management** → Basic CRUD operations for personality profiles
3. **Testing Framework** → Extend existing test scripts to validate personality injection

### Phase 3: Specialized Personality Features  
1. **Dedicated PersonalityRobot** → Robot specifically optimized for personality-aware responses
2. **Profile Learning** → System that suggests personality updates based on conversation patterns
3. **Admin Interface** → Management UI for personality profiles

### Phase 4: Advanced Features
1. **Personality Analytics** → Move advanced features to Information-Services
2. **Multi-Robot Awareness** → Ensure all robots can interpret personality context
3. **Dynamic Adaptation** → Real-time personality adjustments based on context

## Technical Advantages

1. **Invisible to Users**: Uses system message types that don't appear in user conversations
2. **Non-Intrusive**: Works with existing intent parsing and robot selection
3. **Flexible**: Different robots can interpret personality context differently  
4. **Scalable**: Uses existing message pipeline and content type system
5. **Rich Context**: Multiple message types allow for complex personality data

## Integration Points

### Message Flow Enhancement
```
Slack Event → ChatManager.addMessageFromSlack() 
  ↓
1. Add user message to conversation (EXISTING)
  ↓  
2. Look up personality profile (NEW)
  ↓
3. Inject personality context as system message (NEW)
  ↓
4. Parse intent for robot selection (EXISTING) 
  ↓
5. Route to robot with personality-aware context (ENHANCED)
```

### Robot Response Enhancement
- Robots receive conversation history including invisible personality context
- Personality guidelines influence response tone, length, technical level
- Custom instructions provide robot-specific adaptation rules

## Questions & Considerations

### Open Questions
1. **Storage Preference**: JSON files (like current user profiles) or database migration?
2. **Personality Data Source**: Manual configuration, learned from interactions, or external imports?
3. **Robot Scope**: Should ALL robots be personality-aware, or specific ones?
4. **Profile Management**: Admin interface for managing personality profiles?
5. **Fallback Strategy**: How to handle users without personality profiles?

### Technical Considerations  
- **Performance**: Personality lookup on every message (caching strategy needed)
- **Privacy**: User consent and data handling for personality information
- **Maintenance**: Profile accuracy over time as users evolve
- **Testing**: Validation that personality context improves interactions

## Success Metrics

- **User Engagement**: Longer conversations, more positive feedback
- **Response Relevance**: Better matching of robot responses to user preferences  
- **Efficiency**: Reduced clarification requests due to better context awareness
- **Satisfaction**: User reports of more natural, personalized interactions

## Future Vision

**Near Term**: Basic personality profiles that improve response tone and technical level
**Medium Term**: Learning system that refines personalities based on conversation patterns  
**Long Term**: Comprehensive personality ecosystem with analytics, insights, and dynamic adaptation

This feature represents a significant enhancement to user experience by making robot interactions feel more natural and personalized while leveraging the existing robust architecture.
