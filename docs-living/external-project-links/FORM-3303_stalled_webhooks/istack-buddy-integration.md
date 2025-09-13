## SUMO Queries Analysis from FORM-3303 External Project

### Special Note Start

We intend to add this functionality into this project. Right now we are ONLY WORKING ON A STUB. We want to do similar fetch/parse/report as done here but we do not have necessary time resource to complete it 100%, so we are going to elect to stub-out the functionality.

A word about 'submitAction'. In this project, we refer to Integrations, Webhooks as submitActions. There are 3 category of submitAction: 'internal', 'webhook', 'integration'. When possible we should refer to either of these as 'submitAction'.

- 'internal' submitAction - system/automatic: 'redirect', 'message', 'amazons3internal', 'default'.

- 'webhook' submitAction - this is basically the same thing as an 'integration'. The only difference is the foreign system is unknown to use so the customer has to configure a little differently.

- 'integration' submitAction - Some third party integration, we pass submission data to it when we receive it.

### Special Note End

Based on my analysis of your external project in `docs-living/external-project-links/FORM-3303_stalled_webhooks/`, I can now provide you with a detailed breakdown of the SUMO queries being run and their potential integration(submitAction) into your current system.

### **Three Main SUMO Queries Identified**

#### **1. Form Submissions Query**

```sumo
_sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId"
| where formId = {FORM_ID}
```

**Purpose**: Retrieves all form submissions for a specific form within a time period  
**Current System Equivalent**: `submissionCreatedForForm` (already exists!)

#### **2. Expected Submit Actions Query**

```sumo
"Submit actions selected for submission"
_sourceCategory=formstack/prod/*
| json field=_raw "context.formId" as formId
| where formId = {FORM_ID}
```

**Purpose**: Determines what integrations(submitActions)/webhooks(submitActions) _should_ have run for each submission  
**Current System Equivalent**: **None - this is NEW functionality**

#### **3. Actual Submit Actions Query**

```sumo
_sourceCategory=formstack/prod/*
"SubmitAction {type} run for {submissionId}"
| json field=_raw "context.type" as submitActionType
| json field=_raw "context.formId" as formId
| where formId = {FORM_ID}
```

**Purpose**: Gets what integrations(submitActions)/webhooks(submitActions) _actually_ executed  
**Current System Equivalent**: `submitActionReport` (already exists!)

### **What Your External Project Does**

Your external project is essentially a **webhook(submitAction) compliance monitoring system** that:

1. **Fetches all submissions** for a form (baseline data)
2. **Fetches expected submit actions** (what should have happened)
3. **Fetches actual submit actions** (what actually happened)
4. **Compares expected vs actual** to find "stalled webhooks(submitActions)" or missing integrations(submitActions)

### **Integration Potential with Current System**

#### **✅ Already Supported Queries**

- `submissionCreatedForForm` → Your "Form Submissions Query"
- `submitActionReport` → Your "Actual Submit Actions Query"

#### **🆕 New Query Needed**

- **"Expected Submit Actions Query"** → This would be a new query type to add

#### **🔧 Potential New Intent Handler**

You could create a new intent handler like:

```typescript
export class WebhookSubmitActionComplianceAnalyzer implements IntentHandler {
  getSupportedIntents(): RobotIntent[] {
    return [
      {
        intent: 'analyzeWebhookSubmitActionCompliance',
        subIntents: [
          'compareExpectedVsActualSubmitActions',
          'findStalledWebhooks',
          'analyzeSubmitActionCompliance',
        ],
        requiredSubjects: ['formId', 'startDate', 'endDate'],
        description:
          'Analyzes webhook(submitAction) compliance by comparing expected vs actual submit actions',
      },
    ];
  }
}
```

### **New SUMO Query to Add**

Based on your external project, you would need to add this query to your `mapSubIntentToQueryName()` method:

```typescript
private mapSubIntentToQueryName(subIntent: string): string {
  const mapping: Record<string, string> = {
    // Existing mappings
    submissionCreatedForForm: 'submissionCreatedForForm',
    submitActionReport: 'submitActionReport',
    authProviderMetrics: 'authProviderMetrics',

    // NEW: From your external project
    expectedSubmitActions: 'expectedSubmitActions', // ← NEW QUERY TYPE
  };
  return mapping[subIntent];
}
```

### **Value Proposition**

Integrating this functionality would allow your system to:

1. **Automatically detect stalled webhooks(submitActions)** for any form
2. **Monitor integration(submitAction) compliance** across all forms
3. **Alert when expected integrations(submitActions) don't run**
4. **Provide compliance reports** without manual analysis

### **Recommendation**

Since you mentioned you don't have time to verify accuracy, I'd suggest:

1. **Start small**: Add the `expectedSubmitActions` query type to your existing system
2. **Test with known forms**: Use forms you know the expected behavior for
3. **Gradual rollout**: Add the compliance analysis logic incrementally

[1 tool called]

The key insight is that your external project's **"Expected Submit Actions Query"** would be the main new addition to your current system, enabling webhook(submitAction) compliance monitoring functionality that doesn't currently exist.
