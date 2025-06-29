### Reference

- Example application `docs-living/external-project-links/istack-buddy-slack-app`. We will use this for review ONLY. This has the same slack behavior we want. However its is not production quality, it has many things we DO NOT WANT. So we will take piece by piece what we need.

## Core API Endpoints (Backend)

## Key communication points (backend, slack api, slack app)

### 1. **Conversation Processing**

- **`POST /api/conversation/process`** - Main endpoint for processing Slack conversations
  - Accepts conversation context from Slack app
  - Immediately returns acknowledgment
  - Processes asynchronously and sends responses via callbacks
  - Handles domain detection and routing

## Webhook Endpoints (for Slack Integration)

### 2. **Callback Handling**

- **`POST /webhook/message`** - Receive asynchronous callback messages from backend
  - Forwards processed responses to appropriate Slack threads
  - Associates responses using `channelId` + `threadTs`
- **`GET /webhook/health`** - Webhook server health check

### 3. \*\*Slack Channel/knowledge base/Agent resource discovery

The slack app will need to call back-end to get functionality descriptions.

`/istack-buddy/slack-integration/{knowledgeBaseId}`

This should return a description of the agent's functionality.
That description will be a json document for our first implementation.
It should have the shape of:

```json
{
  "#forms-things": {
    "channelId": "C093C5YFBL6",
    "knowledge_base": "core:forms:generic",
    "config_comments": "Main channel for team communications and announcements",
    "knownShortCodes": [
      "something-silly",
      "sumo-query",
      "formId",
      "aDifferentThingId",
      "fieldId"
    ],
    "functionDescriptions": [
      "sumoQuerySyntaxHelper": {}
      "sumoQuerySyntaxHelper": {}
      "formOverview": {}
    ]
  },
  "#all-istackbuddys-workspace": {
    "channelId": "C091Y5UNA1M",
    "knowledge_base": "core:forms-debug:logic",
    "config_comments": "Channel focused on software development and technical discussions",
    "knownShortCodes": [
      "sumo-log",
      "sumo-query",
      "formId",
      "submissionId",
      "submitActionId",
      "fieldId"
    ],
    "functionDescriptions": [
      "sumoQuerySyntaxHelper": {
        "shortText": "Help build simply sumo queries, dynamically",
         "parameters": {
          "formId": {
            "isRequired": true
            "datatype": "string"
          },
         },
        "longText": "responds to 'I need help finding the right query to see all activity for a given email address'. Supported short codes: emailAddress."
      }
      "sumoQuerySyntaxHelper": {
       "shortText": "I can run known queries to assist troubleshoot or verify specific activities.",
        "longText": "responds to things like 'please show log activity for a submission', or 'what is the number of create event/error event for my form'. Supported shortCodes: submissionId, formId"
      }
      "formOverview": {
        "shortText": "Form error/issue detection",
        "longText": "responds to statements like 'can you see anything wrong with my form', shortCodes: formId",
         "parameters": {
          "formId": {
            "isRequired": true
            "datatype": "string"
          },

      }
    ]
  }
}
```

**note** this is similar shape as AiAgent function descriptions - we will use those directly, a little later in our development.

## Patterns from the PoC:

1. **Fire-and-Forget Architecture**: The main `/api/conversation/process` endpoint immediately acknowledges requests and processes them asynchronously, sending multiple callback messages over time

2. **Thread-Based Sessions**: Each Slack thread represents one conversation session with context preservation

3. **Three-Server Architecture**:
   - Slack Bolt App (WebSocket + Event Handling)
   - Backend API Server (Domain Processing + Callbacks)
   - Webhook Server (Callback Reception + Slack Posting)

## Agent Resource Detection

\*\*\* WE NEED `/resolve` for a our slack app and we need a way to get feedback.

-- ##

Our feed back loop should have two flavor
A) /resolved unresolved | resolved | pending
B) /robot-usefulness -5 .. 5 (less than zero is negative useful, misinformation bad direction, zero indicates uselessness)
