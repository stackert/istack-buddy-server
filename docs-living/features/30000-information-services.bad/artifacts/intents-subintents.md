# Robot Intents and SubIntents Specification

Based on actual tool definitions and required parameters.

## 🔧 **AnthropicMarv** (robotName: "AnthropicMarv")

### Intent: "manageForm"
**Required Parameters**: `formId` (always required for Marv)

**SubIntents** (map to actual tools):
- **"validateLogic"** → `formLogicValidation` tool
- **"validateCalculations"** → `formCalculationValidation` tool  
- **"getOverview"** → `formAndRelatedEntityOverview` tool
- **"createForm"** → `formLiteAdd` tool (requires: `formName`, `fields`)
- **"createDeveloperCopy"** → `formDeveloperCopy` tool
- **"addField"** → `fieldLiteAdd` tool (requires: `formId`, field details)
- **"removeField"** → `fieldRemove` tool (requires: `fieldId`)
- **"manageLogicStash"** → logic stash tools (create/apply/remove)
- **"manageLabelSlugs"** → label slug tools (add/remove)

**Example Output**:
```json
{
  "robotName": "AnthropicMarv",
  "intent": "manageForm", 
  "intentData": {
    "formId": "1234999",
    "subIntents": ["validateCalculations"],
    "originalUserPrompt": "Check for calculation issues on form 1234999",
    "subjects": {"formId": ["1234999"]}
  }
}
```

---

## 🔍 **KnobbyOpenAiSearch** (robotName: "KnobbyOpenAiSearch")

### Intent: "searchKnowledge"
**Required Parameters**: `query`

**SubIntents**:
- **"comprehensive"** → `knobby_search_comprehensive` tool (default)
- **"preQuery"** → `knobby_search_prequery` tool  
- **"semantic"** → `knobby_search_semantic` tool
- **"keyword"** → `knobby_search_keyword` tool
- **"domain"** → `knobby_search_domain` tool

**Example Output**:
```json
{
  "robotName": "KnobbyOpenAiSearch",
  "intent": "searchKnowledge",
  "intentData": {
    "query": "SAML authentication troubleshooting",
    "subIntents": ["comprehensive"],
    "originalUserPrompt": "Find SAML setup documentation",
    "subjects": null
  }
}
```

---

## 🤖 **SlackyOpenAiAgent** (robotName: "SlackyOpenAiAgent")

### Intent: "assistSlackUser"
**Required Parameters**: varies by subIntent

**SubIntents**:
- **"querySumoLogic"** → `sumo_logic_query` tool (requires: `fromDate`, `toDate`)
- **"troubleshootSSO"** → `sso_autofill_assistance` tool (requires: `formId`, `accountId`)
- **"collectFeedback"** → `collect_user_feedback` tool
- **"collectRating"** → `collect_user_rating` tool

**Example Output**:
```json
{
  "robotName": "SlackyOpenAiAgent", 
  "intent": "assistSlackUser",
  "intentData": {
    "fromDate": "1640995200000",
    "toDate": "1641081600000", 
    "formId": "12345",
    "subIntents": ["querySumoLogic"],
    "originalUserPrompt": "Check logs for form 12345 last week",
    "subjects": {"formId": ["12345"]}
  }
}
```

---

## 📊 **KnobbyOpenAiSumoReport** (robotName: "KnobbyOpenAiSumoReport")

### Intent: "generateReport" 
**Required Parameters**: `queryName`, `subject` object

**SubIntents**:
- **"submitActionReport"** → tracks submit action executions
- **"submissionCreatedReport"** → tracks form submission events
- **"authProviderMetrics"** → monitors auth provider activity
- **"jobManagement"** → manage existing jobs (status, results, cleanup)

**Example Output**:
```json
{
  "robotName": "KnobbyOpenAiSumoReport",
  "intent": "generateReport",
  "intentData": {
    "queryName": "submitActionReport",
    "subject": {"formId": "1234999", "submitActionType": "", "startDate": "2025-07-05", "endDate": "2025-07-10"},
    "subIntents": ["submitActionReport"],
    "originalUserPrompt": "Generate submit actions report for form 1234999 from July 5-10",
    "subjects": {"formId": ["1234999"]}
  }
}
```

---

## 🔄 **KnobbyOpenAiContextDynamic** (robotName: "KnobbyOpenAiContextDynamic")

### Intent: "getLiveData"
**Required Parameters**: varies by context type

**SubIntents**:
- **"getFormContext"** → `getForm` endpoint (requires: `formId`)
- **"getAccountContext"** → `getAccount` endpoint (requires: `accountId`)
- **"getAuthProviderContext"** → `getAuthProvider` endpoint (requires: `authProviderId`)
- **"checkHealth"** → `health` endpoint

---

## 📝 **Intent Routing Priority**:

1. **Form troubleshooting** (when formId + "error/issue/problem") → **AnthropicMarv**
2. **Documentation search** (when "find/search/help/guide") → **KnobbyOpenAiSearch** 
3. **Log analysis/reporting** (when "report/logs/track/analyze") → **KnobbyOpenAiSumoReport**
4. **Live data requests** (when "current/live/get state") → **KnobbyOpenAiContextDynamic**

**This specification maps directly to actual robot tool definitions and required parameters.**
