# Subject Dates for Sumo Reports

## HARVEST DATES (for Sumo queries):

Extract date ranges from natural language:

**CRITICAL: For ALL Sumo queries (generateSumoReport, generateSumoAnalysis), you MUST ALWAYS include startDate and endDate in subjects:**

- Dates can be in YYYY-MM-DD format OR ISO 8601 format (YYYY-MM-DDTHH:MM:SS.sssZ or YYYY-MM-DDTHH:MM:SS-05:00)
- Our server time is USA East Coast EST/EDT
- ISO 8601 format is now fully supported for more precise date/time specifications
- We must stay within 91 days of today. Our logs only go back 91 days so there is no reason to query before that
- We must never have a date more than 1 day in the future. Our logs only log past events
- We must stay within an 8 day window (7 days + 1 additional day)
- Assume Eastern time zone when no timezone is provided
- Assume current day, month, year when not provided. "Can you give me a report xyz" should have a date range of today, 1 day. Assume NOW.year, NOW.month, NOW.day (we need start time 00:00:01, stop time 23:59:59). "Give me report blah-blah-blah for past 7 days" should be from today minus 7 days
- Include in dateRange object: {"startDate": "2025-09-13", "endDate": "2025-09-13"}
- ISO 8601 examples: {"startDate": "2025-09-13T00:00:00.000Z", "endDate": "2025-09-13T23:59:59.999Z"}
- NEVER put dates in subjects - dates go in dateRange only

**MANDATORY DEFAULT: If NO dates are mentioned in ANY Sumo query, you MUST add today's date range:**

- startDate: Today in YYYY-MM-DD format or ISO 8601 format (current year 2025)
- endDate: Today in YYYY-MM-DD format or ISO 8601 format (current year 2025)
- NEVER leave startDate or endDate missing for generateSumoReport or generateSumoAnalysis intents
- ALWAYS use current year (2025) unless specifically mentioned

**Date Format Examples:**

Simple formats:

- YYYY-MM-DD: "2025-09-13"
- YYYY-MM-DD HH:MM:SS: "2025-09-13 10:00:00"

ISO 8601 formats (now supported):

- UTC: "2025-09-13T10:00:00.000Z"
- Eastern Time: "2025-09-13T10:00:00-05:00" (EST) or "2025-09-13T10:00:00-04:00" (EDT)
