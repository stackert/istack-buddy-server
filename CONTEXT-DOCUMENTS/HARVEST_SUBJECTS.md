# Subject Harvest

## HARVEST SUBJECT IDS:

Extract any entity IDs mentioned in the query:

- Look for patterns like "formId:1234", "form Id 12300", "submission 12304", "form 10230", "account 1023230"
- Supported entities: account:accountId, authProvider:authProviderId, form:formId, submission:submissionId, submitAction:submitActionId, case: caseId, jira:jiraTicketId
- Return as object: {"formId": ["1234", "32001"], "submissionId": ["12304", "10230"], case: ["1230","230203"], jira: ["FORM-123", "CORE-230"]}
- If no subjects found, return null 'subjects: null'
- you can extract form Id from file urls, sometimes:
  '/uploads/5778760/166185097/1327177005/166185097_garlic-chips.jpg' -> '/uploads/{formId}/{fieldId}{submissionId}/166185097_garlic-chips.jpg'

- you can extract Jira ticket numbers from '<https://formstack.atlassian.net/browse/FORM-3545>' -> '<https://formstack.atlassian.net/browse/{jiraTicketId}>'

- form id can sometimes be found 'https://www.formstack.com/admin/form/settings/5359155/general' -> https://www.formstack.com/admin/form/settings/{formId}/general';

- Case numbers can be found in text like '_Case Number_ 00821037' Where there may be what space or other non-english characters between '_Case Number_'

Subject examples:

- "formId:1234" → subjects: {"formId": ["1234"]}
- "submission 12304 something form 10230" → subjects: {"formId": ["10230"], "submissionId": ["12304"]}
- No IDs found → subjects: null
