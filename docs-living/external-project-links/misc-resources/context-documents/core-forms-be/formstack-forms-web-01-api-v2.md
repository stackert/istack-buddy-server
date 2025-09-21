# Formstack Forms Web API v2

AI Generated from looking at the controller. Accuracy is not guaranteed.

1. **Form Controller** (`/form`)

```
GET /form - List forms
GET /form/{id} - Get specific form
POST /form - Create form
PUT /form/{id} - Update form
DELETE /form/{id} - Delete form
```

2. **Field Controller** (`/field`)

```
GET /field/{id} - Get field details
PUT /field/{id} - Update field
DELETE /field/{id} - Delete field
```

3. **Submission Controller** (`/submission`)

```
GET /submission - List submissions
GET /submission/{id} - Get specific submission
PUT /submission/{id} - Update submission
DELETE /submission/{id} - Delete submission
```

4. **Notification Controller** (`/notification`)

```
GET /notification/{id} - Get notification
PUT /notification/{id} - Update notification
DELETE /notification/{id} - Delete notification
POST - Not allowed (returns error "Please use /form/ID/notification")
```

5. **Webhook Controller** (`/webhook`)

```
GET /webhook/{id} - Get webhook
PUT /webhook/{id} - Update webhook
DELETE /webhook/{id} - Delete webhook
POST - Not allowed (returns error "Please use /form/ID/webhook")
```

6. **User Controller** (`/user`)

```
POST /user/passwordreset - Password reset request
GET - Not allowed (returns 405)
PUT - Not allowed (returns 405)
DELETE - Not allowed (returns 405)
```

7. **Theme Controller** (`/theme`)

```
POST /theme/{theme_id}/background_image - Upload background image
POST /theme/{theme_id}/footer_image - Upload footer image
POST /theme/{theme_id}/header_image - Upload header image
PUT /theme/{theme_id} - Update theme
DELETE /theme/{theme_id}/background_image - Delete background image
DELETE /theme/{theme_id}/footer_image - Delete footer image
DELETE /theme/{theme_id}/header_image - Delete header image
GET - Not allowed (returns 405)
```

8. **Subaccount Controller** (`/subaccount`)

```
GET /subaccount - List subaccounts
POST /subaccount/{subaccount_id}/theme/{theme_id}/copy - Copy theme to subaccount
POST /subaccount/{subaccount_id}/form/{form_id}/copy - Copy form to subaccount
PUT - Not allowed (returns 405)
DELETE - Not allowed (returns 405)
```

9. **OAuth2 Controller** (`/oauth2`)

```
GET /oauth2/authorize - Authorization endpoint
POST /oauth2/token - Token endpoint
DELETE - Not allowed (returns 405)
```

10. **Copilot Controller** (`/copilot`)

```
GET /copilot - Get copilot info
GET /copilot/quickstart - Get quickstart info
GET /copilot/preBuiltForm/{id} - Get specific prebuilt form
```

11. **FSID Controller** (`/fsid`)

```
GET /fsid/activationJourneyTemplates - Get activation journey templates
```

All routes appear to:

- Support JSON responses
- Require authentication (except specific endpoints like OAuth2 and User)
- Return standardized error responses
- Follow RESTful conventions
- Use SSL (HTTPS required)
- Include proper error status codes (400, 401, 403, 404, 405, 500, etc.)

The base URL pattern appears to be:

```
https://api.formstack.com/v2/{resource}
```

Note: Some controllers may have additional routes that weren't immediately apparent in the provided code snippets.
