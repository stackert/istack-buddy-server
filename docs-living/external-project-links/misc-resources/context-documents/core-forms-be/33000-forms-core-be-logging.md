# Forms Core Backend Server


# Sumo Logging 

Various backend activities is logged to Sumo Logic

# Common Queriers 

# Build your own queries

 - Log Messges what to look for.  All of are loggable events

 - Paramaters what to filter (date range, specific to form therefore formId, specific to submitAction, specific to submissions)

 

 # Common questions:
  - email delivered to foreign server
  - report ran
  - reprot sent
  - submit action ran
  - submit action run for a particular sumission
  - errors
     - submitAction fail
     - failed to send email
     - failed to complete submit action


# restrictions/limitation
- only 90 days of log activity
- we ingests 10,000 messages a minute - results/fitlers are necessary 
  the more specific the better

- "Error" are often downgraded to "Warn".
- "Log Level" is suggestive and not specific sometimes we have info or warn messages that could be consider 'error'
-  we never log debug in production      