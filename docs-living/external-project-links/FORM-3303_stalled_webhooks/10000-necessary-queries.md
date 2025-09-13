# FORM-3303


### Sumo For all submission for a form a given form

#### all-submission-for-form

```
 _sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId" as formId
| where formId = _FORM_ID_
```


#### specific-submit-action-for-form
### Sumo for all submitAction of type for a form
```
"SubmitAction {type} run for {submissionId}"
| json field=_raw "context.formId" as formId
| json field=_raw "context.type" as type
| where formId = _FORM_ID_ and type = "pardot"
```


#### expected-submit-action-for-period

### Sumo for ALL expected submitAction for a given submission
```
"Submit actions selected for submission"
_sourceCategory=formstack/prod/*
| json field=_raw "context.queuedIntegrations" as queuedIntegrations nodrop
| json field=_raw "context.blockingIntegrations" as blockingIntegrations nodrop
| json field=_raw "context.event" as loggedEvent
| json field=_raw "context.formId" as formid
| WHERE formId = _FORM_ID_ AND loggedEvent = "form_submit_resource_monitor"
| parse regex field=queuedIntegrations "\"type\":\"(?<queuedIntegrationType>[^\"]+)\""
| parse regex field=blockingIntegrations "\"type\":\"(?<blockingIntegrationType>[^\"]+)\""
| fields queuedIntegrationType, blockingIntegrationType

```



#### submission-for-given-form-during-period

_sourceCategory="formstack/prod/web/formstack-app/log"
"Submission created on {formId}."
| json field=_raw "context.formId"
| where formId = _FORM_ID_