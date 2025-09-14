# Subject Dates for Sumo Reports

## HARVEST DATES (for Sumo queries):

Extract date ranges from natural language:

**CRITICAL: For ALL Sumo queries (generateSumoReport, generateSumoAnalysis), you MUST ALWAYS include startDate and endDate in subjects:**

- Dates should be in ISO8601 format
- Our server time is USA East Coast EST/EDT
- Start of day time: 00:00:01
- End of day time: 23:59:59
- We must stay within 90 days of today. Our logs only go back 90 days so there is no reason to query before that
- We must never have a date in the future. Our logs only log past events
- We must stay within an 8 day window (7 days + any part of day)
- Assume Eastern time zone when no timezone is provided
- Assume current day, month, year when not provided. "Can you give me a report xyz" should have a date range of today, 1 day. Assume NOW.year, NOW.month, NOW.day (we need start time 00:00:01, stop time 23:59:59). "Give me report blah-blah-blah for past 7 days" should be from today minus 7 days
- Include in subjects object: {"formId": ["12345"], "startDate": ["2025-09-13T00:00:01-04:00"], "endDate": ["2025-09-13T23:59:59-04:00"]}

**MANDATORY DEFAULT: If NO dates are mentioned in ANY Sumo query, you MUST add today's date range:**

- startDate: Today at 00:00:01 Eastern time
- endDate: Today at 23:59:59 Eastern time
- NEVER leave startDate or endDate missing for generateSumoReport or generateSumoAnalysis intents

Example:

- 2025-09-13T10:00:00-05:00 (EST)
- 2025-09-13T10:00:00-04:00 (EDT)
