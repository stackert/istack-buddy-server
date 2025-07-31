# Introduction - iStack Marv Buddy (Marv)

Marv operates with real Formstack API calls and can perform various form management tasks including: validation of Logic and Calculation, Backup/Restore Logic, Calculation, troubleshooting and surfacing known configuration complications. _All operations are performed on Marv-enabled forms to ensure safety and proper access control and within the iStackBuddy account_.

**Disclaimer:** This is a living document and is not guaranteed to be accurate. Our objective is to be informative over factual. We'll avoid making factual statements but provide generalizations. The objective is to make them timeless. Source of truth is ALWAYS CODE.

## Overview

### Form Creation and Management Functions

- **FormLiteAdd** - Creates new forms with initial field configurations using AI-powered form creation based on examples found on the internet
- **FormDeveloperAdd** - Creates developer copies of existing forms for testing and development purposes
- **FormAndRelatedEntityOverview** - Provides comprehensive form overview including configuration, statistics, and all related entities (webhooks, notifications, confirmations) with detailed entity IDs

### Field Management Functions

- **FieldLiteAdd** - Adds individual fields to forms using simplified syntax with support for various field types (text, number, datetime, email, phone, address, signature, file, section)
- **FieldRemove** - Permanently removes fields from forms by field ID, deleting the field and all its data
- **FieldLabelUniqueSlugAdd** - Adds unique slugs to all field labels in a form to make them easier to identify and work with
- **FieldLabelUniqueSlugRemove** - Removes unique slugs from field labels in a form

### Logic Management Functions

- **FieldLogicStashCreate** - Creates a logic stash to backup current field logic before making changes
- **FieldLogicStashApply** - Applies previously stashed field logic back to a form
- **FieldLogicStashApplyAndRemove** - Applies stashed field logic and then removes the stash in one operation
- **FieldLogicStashRemove** - Removes the logic stash from a form without applying it
- **FieldLogicRemove** - Removes all logic from form fields

### Validation and Analysis Functions

- **FormLogicValidation** - Validates form logic for errors and configuration issues
- **FormCalculationValidation** - Validates form calculations and detects circular references

### Operational Constraints

AnthropicMarv operates with specific constraints to ensure safe and effective form management:

- Most operations can ONLY be performed on Marv-enabled forms
- Marv will only work within the iStackBuddy account
- All operations use real Formstack API calls

### Use Cases

The robot is designed for:

- Logic backup and restoration
- Calculation backup and restoration
- Comprehensive form analysis and overview (useful for building AI context for troubleshooting)
- Form validation and troubleshooting. Checks for known complications with complexity. Many issues arise because of two or more factors (calculations interfering with logic as example). Marv assists in identifying those troublesome patterns.
