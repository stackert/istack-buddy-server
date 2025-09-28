## Observation Makers

Observation Makers are diagnostic tools that analyze entities (primarily forms) and generate structured log messages about their state, configuration, and potential issues. These log messages provide diagnostic information that robots can use to understand the current state of entities and provide context-aware responses.

### Key Observation Makers in the System

The system includes several specialized observation makers:

- **ObservationMakerFieldCounts**: Analyzes form field counts, types, and configurations
- **ObservationMakerLogicValidation**: Validates form logic rules and identifies logic errors
- **ObservationMakerCalculationValidation**: Validates calculation formulas and identifies circular references
- **ObservationMakerSumoReport**: Analyzes Sumo Logic query results and submission data
- **ObservationMakerSumoSubmitActionJobReport**: Analyzes Sumo Logic submit action job data

### Log Message Structure

When you receive log items from observation makers, each item has this structure:

- **subjectId**: The ID of the entity being analyzed (form ID, field ID, query name, etc.)
- **messageSecondary**: Human-readable description of what was observed
- **relatedEntityIds**: Array of related entity IDs that are connected to this observation
- **logLevel**: Severity level indicating importance (DEBUG, INFO, WARN, ERROR)
- **subjectType**: Type of subject being analyzed (FORM, etc.)

### Log Levels and Their Meanings

The log levels indicate the importance and severity of each observation:

- **DEBUG**: Detailed technical information useful for troubleshooting. Usually verbose and can be ignored unless you need deep technical details.

- **INFO**: Neutral factual information about the entity. These report counts, statistics, and configuration details. They don't indicate problems but provide useful context.

- **WARN**: Potential issues that could cause problems but don't break functionality. Examples include non-unique labels, unsupported field types, or logic validation warnings.

- **ERROR**: Critical issues indicating the entity is broken and unreliable. These are rare and indicate serious problems like missing required fields, circular references, or broken dependencies.

### How to Read Log Messages

When you receive log items, focus on these key properties:

- **subjectId**: Tells you which specific entity (form, field, query) the observation is about
- **messageSecondary**: Contains the human-readable description of what was observed
- **logLevel**: Indicates how important this observation is (ERROR > WARN > INFO > DEBUG)
- **relatedEntityIds**: Lists other entities connected to this observation (helps understand relationships)

### Common Log Message Patterns

**Field Analysis Messages**:

- `"Number of fields with calculations: 15"` (INFO level)
- `"Field type 'unsupported' not supported"` (WARN level)
- `"Non unique label used 3 times: 'Contact Information...'"` (WARN level)

**Logic Validation Messages**:

- `"Number of fields with logic: 8"` (INFO level)
- `"Logic error: Field references non-existent field 'field_123'"` (WARN level)
- `"Predicate fieldId does not exist: field_456"` (ERROR level)

**Calculation Validation Messages**:

- `"Number of fields with calculation errors: 2"` (INFO level)
- `"Circular reference detected in field 'total_amount'"` (ERROR level)

**Sumo Logic Analysis Messages**:

- `"Number of records (submissions): 1,247"` (INFO level)
- `"Time range: 2024-01-01 to 2024-01-31"` (INFO level)
- `"Estimated token count: 45,230"` (INFO level)

### Interpreting Results

When you receive observation results:

1. **Start with ERROR and WARN messages** - these indicate problems that need attention
2. **Use INFO messages for context** - they provide useful background information
3. **Ignore DEBUG messages** unless you need detailed technical information
4. **Check relatedEntityIds** to understand which entities are connected to each observation
5. **Use subjectId to identify** which specific form, field, or query each observation relates to

The observations help you understand the current state of entities and identify any issues that need to be addressed or reported to users.
