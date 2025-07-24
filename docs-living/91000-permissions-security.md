# Observations System - Complete Documentation

An Observation is something noteworthy about an Object-Entity. The observation system provides a flexible way to analyze and report on various aspects of: forms, fields, logic, calculation, submitActions, notification/confirmation emails, etc, etc.

The system uses **Observation Makers (OM)** - specialized analysis tools that examine different aspects of form configurations and produce structured, categorized results for validation and troubleshooting.

The system is designed with **extensible types** using TypeScript generics with constraints (`T extends EObservationClass = EObservationClass`), allowing you to extend the baseline enums for custom subject types and observation classes while maintaining type safety and backward compatibility.

## Object Entities Currently Supported

- **Forms** - Overall form configuration and settings
- **Fields** - Individual form fields and their properties
- **Logic/Visibility** - Field visibility logic and dependencies
- **Calculations** - Field calculation expressions
- **Integration/Webhook** - External system integrations (planned)
- **Confirmation/Notification Email** - Email logic (planned)

_\*_ we expect the expand and extend over time.

## Core Architecture

### Resource-Based Context Pattern

The observation system uses a resource-based context that provides necessary data to observation makers:

```typescript
interface IObservationContext {
  resources: Record<string, any>; // Required data models
  logicTrees?: Record<string, FsFieldVisibilityGraph>; // Pre-computed logic trees
  parentObserver?: string; // For nested observations
}
```

### Observation Log Items

All observations produce structured log items with consistent metadata:

```typescript
interface IObservationLogItem {
  subjectId: string; // fieldId, formId, webhookId, etc.
  logLevel: ELogLevel; // DEBUG | INFO | WARN | ERROR
  subjectType: EObservationSubjectType; // FORM | FIELD | SUBMIT_ACTION | etc.
  observationClass: EObservationClass; // ANALYSIS | LOGIC | CALCULATION | etc.
  observationMakerClass: string; // Class name of the observation maker
  message: string; // Primary descriptive message
  messageSecondary: string; // Detailed/specific information
  relatedEntityIds: string[]; // Related field IDs or other entities
  parentObserver?: string; // Parent observation maker (if nested)
  isObservationTrue: boolean; // Whether observation condition is met
  additionalDetails?: object; // Extra context data
}
```

### Log Levels

- **`ERROR`** - Show stopper issues that prevent the entity from functioning reliably. Example: form references non-existent fields, critical logic errors that break functionality.
- **`WARN`** - Issues that could lead to problem specific problem. Example: duplicate field labels could lead to missing data in csv exports. However, missing data from csv exports could be caused by other factors. They are an indication of a larger issue and useful for troubleshooting the larger issue. Not an absolute cause/effect relation.
- **`INFO`** - Informational observations, 'nice to know' details. Examples: field counts, form type, number of submitActions (Integrations), etc, etc.
- **`DEBUG`** - Extra details for troubleshooting. Examples: full JSON descriptions of entities, detailed state information. The full json description is very useful to view an entities configuration at a glance. This is very useful when troubleshoot

### Subject Types and Classes (Extensible Design)

The observation system uses **extensible enums** that serve as baseline types, but can be extended for custom implementations:

```typescript
// Baseline enums (provided by the system)
enum EObservationSubjectType {
  FORM = 'form',
  FIELD = 'field',
  SUBMIT_ACTION = 'submitAction',
  EMAIL_NOTIFICATION = 'emailNotification',
  EMAIL_CONFIRMATION = 'emailConfirmation',
  WEBHOOK = 'webhook',
}

enum EObservationClass {
  ANALYSIS = 'analysis', // General analysis/composite operations
  LOGIC = 'logic', // Field visibility logic analysis
  CALCULATION = 'calculation', // Field calculation analysis
  VALIDATION = 'validation', // Data validation analysis
  CONFIGURATION = 'configuration', // Configuration/settings analysis
  LABEL = 'label', // Label/display text analysis
}

// Extensible interfaces using generic constraints
interface IObservationLogItem<
  TSubjectType extends string = EObservationSubjectType,
  TObservationClass extends string = EObservationClass,
> {
  subjectId: string;
  logLevel: ELogLevel;
  subjectType: TSubjectType; // Can be extended!
  observationClass: TObservationClass; // Can be extended!
  observationMakerClass: string;
  message: string;
  messageSecondary: string;
  relatedEntityIds: string[];
  parentObserver?: string;
  isObservationTrue: boolean;
  additionalDetails?: object;
}

interface IObservationMaker<
  TSubjectType extends string = EObservationSubjectType,
  TObservationClass extends string = EObservationClass,
> {
  makeObservation(
    context: IObservationContext<TSubjectType, TObservationClass>,
  ): Promise<IObservationResult<TSubjectType, TObservationClass>>;
  getRequiredResources(): string[];
}
```

**How EObservationClass is Used:**

- Each OM sets its `observationClass` property to categorize the type of analysis it performs
- Used for filtering results by analysis type (e.g., show only calculation issues)
- Helps organize and group related observations in UI displays
- **Baseline implementations** (can be extended):
  - `ANALYSIS` - CompositeFormObservationMaker (orchestration)
  - `LOGIC` - Field logic and circular reference OMs
  - `CALCULATION` - FieldCalculationObservationMaker
  - `CONFIGURATION` - FormConfigObservationMaker
  - `LABEL` - FieldLabelObservationMaker

## Extending Types for Custom Implementations

### **Example: Custom Subject Types**

```typescript
// Define your custom subject types
enum EMyCustomSubjectType {
  // Include baseline types
  FORM = 'form',
  FIELD = 'field',
  // Add your custom types
  CUSTOM_WIDGET = 'customWidget',
  REPORT_TEMPLATE = 'reportTemplate',
  API_ENDPOINT = 'apiEndpoint',
}

// Define custom observation classes
enum EMyCustomObservationClass {
  // Include baseline classes
  ANALYSIS = 'analysis',
  LOGIC = 'logic',
  // Add your custom classes
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  COMPLIANCE = 'compliance',
}

// Create custom observation maker using extended types
export class CustomWidgetObservationMaker extends AbstractObservationMaker<
  EMyCustomSubjectType,
  EMyCustomObservationClass
> {
  protected messagePrimary: string = 'Custom Widget Validation';
  protected subjectType: EMyCustomSubjectType =
    EMyCustomSubjectType.CUSTOM_WIDGET;
  protected observationClass: EMyCustomObservationClass =
    EMyCustomObservationClass.SECURITY;

  getRequiredResources(): string[] {
    return ['formModel', 'widgetRegistry'];
  }

  async makeObservation(
    context: IObservationContext<
      EMyCustomSubjectType,
      EMyCustomObservationClass
    >,
  ): Promise<
    IObservationResult<EMyCustomSubjectType, EMyCustomObservationClass>
  > {
    const logItems: IObservationLogItem<
      EMyCustomSubjectType,
      EMyCustomObservationClass
    >[] = [];

    // Your custom logic here
    const widgets = context.resources.widgetRegistry;
    // ... analysis logic

    return { logItems, isObservationTrue: logItems.length > 0 };
  }
}
```

### **Example: Mixed Type Usage**

```typescript
// You can also extend just one dimension
type MySubjectTypes =
  | EObservationSubjectType
  | 'customWidget'
  | 'reportTemplate';

export class MixedObservationMaker extends AbstractObservationMaker<
  MySubjectTypes, // Extended subject types
  EObservationClass // Standard observation classes
> {
  protected messagePrimary: string = 'Mixed Type Analysis';
  protected subjectType: MySubjectTypes = 'customWidget';
  protected observationClass: EObservationClass = EObservationClass.VALIDATION;

  // ... implementation
}
```

### **Example: Union Type Extensions**

```typescript
// Extend using union types for maximum flexibility
type ExtendedSubjectType =
  | EObservationSubjectType
  | 'DATABASE_CONNECTION'
  | 'THIRD_PARTY_SERVICE'
  | 'CUSTOM_COMPONENT';

type ExtendedObservationClass =
  | EObservationClass
  | 'ACCESSIBILITY'
  | 'INTERNATIONALIZATION'
  | 'AUDIT_TRAIL';

// Usage with extended union types
export class AccessibilityObservationMaker extends AbstractObservationMaker<
  ExtendedSubjectType,
  ExtendedObservationClass
> {
  protected messagePrimary: string = 'Accessibility Compliance Check';
  protected subjectType: ExtendedSubjectType = 'CUSTOM_COMPONENT';
  protected observationClass: ExtendedObservationClass = 'ACCESSIBILITY';

  // ... implementation
}
```

## Observation Maker Pattern

### Abstract Base Class (Extensible)

All observation makers extend `AbstractObservationMaker` with optional generic type parameters:

```typescript
export abstract class AbstractObservationMaker<
  TSubjectType extends string = EObservationSubjectType,
  TObservationClass extends string = EObservationClass,
> implements IObservationMaker<TSubjectType, TObservationClass>
{
  protected childMakers: AbstractObservationMaker<
    TSubjectType,
    TObservationClass
  >[] = [];

  // Must be defined by concrete implementations
  protected abstract messagePrimary: string; // Fixed message for this OM
  protected abstract subjectType: TSubjectType; // Extensible subject type
  protected abstract observationClass: TObservationClass; // Extensible observation class

  // Required methods
  abstract getRequiredResources(): string[];
  abstract makeObservation(
    context: IObservationContext<TSubjectType, TObservationClass>,
  ): Promise<IObservationResult<TSubjectType, TObservationClass>>;
}
```

**Key Points:**

- **Type Safety**: Generic constraints ensure type safety while allowing extensions
- **Backward Compatible**: Without generics, defaults to baseline enum types
- **Flexible**: Can extend one or both dimensions (subject type and/or observation class)
- **Composition**: Child makers inherit the same generic type constraints
- **Future-Proof**: New subject types and observation classes can be added without breaking existing code

### **Usage Patterns**

```typescript
// 1. Using baseline types (existing pattern, no changes needed)
export class StandardFieldMaker extends AbstractObservationMaker {
  protected subjectType = EObservationSubjectType.FIELD;
  protected observationClass = EObservationClass.VALIDATION;
  // ... works exactly as before
}

// 2. Extending both dimensions
export class CustomMaker extends AbstractObservationMaker<
  MyCustomSubjectType,
  MyCustomObservationClass
> {
  protected subjectType = MyCustomSubjectType.CUSTOM_WIDGET;
  protected observationClass = MyCustomObservationClass.SECURITY;
  // ... full type safety with custom types
}

// 3. Extending only subject types
export class PartialCustomMaker extends AbstractObservationMaker<
  ExtendedSubjectType,
  EObservationClass
> {
  protected subjectType: ExtendedSubjectType = 'DATABASE_CONNECTION';
  protected observationClass = EObservationClass.CONFIGURATION;
  // ... custom subjects, standard observation classes
}
```

### Creating Custom Observation Makers

```typescript
export class FieldLabelWhitespaceObservationMaker extends AbstractObservationMaker {
  protected messagePrimary: string =
    'Field Label Leading/Trailing Whitespace Check';
  protected subjectType: EObservationSubjectType =
    EObservationSubjectType.FIELD;
  protected observationClass: string = this.constructor.name;

  getRequiredResources(): string[] {
    return ['formModel'];
  }

  async makeObservation(
    context: IObservationContext,
  ): Promise<IObservationResult> {
    const formModel = context.resources.formModel as FsModelForm;
    const logItems: IObservationLogItem[] = [];

    const fieldIds = formModel.getFieldIds();
    for (const fieldId of fieldIds) {
      const field = formModel.getFieldModelById(fieldId);
      if (!field) continue;

      const label = field.labelUserFriendly();
      const trimmedLabel = label.trim();

      if (label !== trimmedLabel) {
        logItems.push(
          this.createLogItem({
            subjectId: fieldId,
            logLevel: ELogLevel.WARN,
            message: this.messagePrimary,
            messageSecondary: `Field '${fieldId}' label has leading/trailing whitespace: '${label}'`,
            relatedEntityIds: [fieldId],
            isObservationTrue: true,
          }),
        );
      }
    }

    return {
      logItems,
      isObservationTrue: logItems.length > 0,
    };
  }
}
```

## Composite Pattern Support

The system supports orchestrating multiple OM using the composite pattern:

```typescript
export class CompositeFormObservationMaker extends AbstractObservationMaker {
  // Automatically runs child OM
  protected messagePrimary: string = 'Composite Form Analysis';
  protected subjectType: EObservationSubjectType = EObservationSubjectType.FORM;
  protected observationClass: string = EObservationClass.ANALYSIS;

  // Add OM at runtime
  addObservationMaker(maker: AbstractObservationMaker): void {
    this.childMakers.push(maker);
  }

  getRequiredResources(): string[] {
    return ['formModel']; // Base requirements
  }
}
```

### Usage Example

```typescript
// Create composite maker with default makers
const maker = new CompositeFormObservationMaker();

// Add field-specific makers
maker.addObservationMaker(new FieldLabelObservationMaker());
maker.addObservationMaker(new FieldLogicValidFieldIdsObservationMaker());
maker.addObservationMaker(new FieldLogicCircularReferencesObservationMaker());
maker.addObservationMaker(new FieldCalculationObservationMaker());

// Add form-level makers
maker.addObservationMaker(new FormConfigObservationMaker());

// Prepare context
const context: IObservationContext = {
  resources: {
    formModel: myFormModel,
    formConfig: formConfig,
  },
  logicTrees: preComputedLogicTrees, // Optional for performance
};

// Run all observations
const result = await maker.makeObservation(context);

// Process results - Basic logging
result.logItems.forEach((item) => {
  console.log(`[${item.logLevel}] ${item.message}: ${item.messageSecondary}`);
});

// Advanced result processing examples:

// 1. Filter by log level - Find only errors and warnings
const criticalIssues = result.logItems.filter(
  (item) =>
    item.logLevel === ELogLevel.ERROR || item.logLevel === ELogLevel.WARN,
);
console.log(`Found ${criticalIssues.length} critical issues`);

// 2. Filter by observation class - Find only calculation issues
const calculationIssues = result.logItems.filter(
  (item) => item.observationClass === EObservationClass.CALCULATION,
);
console.log(
  `Found ${calculationIssues.length} calculation-related observations`,
);

// 2b. Filter by extended observation class (for custom implementations)
const securityIssues = result.logItems.filter(
  (item) => item.observationClass === 'SECURITY', // Custom extended class
);
console.log(`Found ${securityIssues.length} security-related observations`);

// 3. Get field IDs with calculation errors
const fieldsWithCalcErrors = result.logItems
  .filter(
    (item) =>
      item.observationClass === EObservationClass.CALCULATION &&
      item.logLevel === ELogLevel.ERROR,
  )
  .map((item) => item.subjectId);
console.log('Fields with calculation errors:', fieldsWithCalcErrors);

// 4. Find circular dependency issues
const circularReferenceIssues = result.logItems.filter((item) =>
  item.messageSecondary.toLowerCase().includes('circular'),
);
console.log(
  `Found ${circularReferenceIssues.length} circular dependency issues`,
);

// 5. Group observations by subject type
const observationsBySubject = result.logItems.reduce(
  (acc, item) => {
    if (!acc[item.subjectType]) acc[item.subjectType] = [];
    acc[item.subjectType].push(item);
    return acc;
  },
  {} as Record<string, IObservationLogItem[]>,
);

// 6. Find fields referenced in issues (from relatedEntityIds)
const allRelatedFieldIds = new Set();
result.logItems.forEach((item) => {
  item.relatedEntityIds.forEach((id) => allRelatedFieldIds.add(id));
});
console.log('All fields involved in issues:', Array.from(allRelatedFieldIds));

// 7. Generate issue summary by OM type
const issuesByMaker = result.logItems.reduce(
  (acc, item) => {
    const makerClass = item.observationMakerClass;
    if (!acc[makerClass]) {
      acc[makerClass] = { total: 0, errors: 0, warnings: 0, info: 0 };
    }
    acc[makerClass].total++;
    acc[makerClass][item.logLevel]++;
    return acc;
  },
  {} as Record<string, any>,
);

console.log('Issues by Observation Maker:', issuesByMaker);

// 8. Check if specific field has issues
function hasFieldIssues(fieldId: string): boolean {
  return result.logItems.some(
    (item) =>
      item.subjectId === fieldId || item.relatedEntityIds.includes(fieldId),
  );
}

// 9. Get detailed calculation analysis from additionalDetails
const calcAnalysis = result.logItems
  .filter(
    (item) =>
      item.observationClass === EObservationClass.CALCULATION &&
      item.additionalDetails?.analysisType === 'calculation_analysis',
  )
  .map((item) => ({
    fieldId: item.subjectId,
    calculationString: item.additionalDetails?.calculationString,
    hasCircularRefs: item.additionalDetails?.circularReferencesFound,
    fieldType: item.additionalDetails?.fieldType,
  }));

// 10. Create actionable error report
const errorReport = {
  timestamp: new Date().toISOString(),
  totalObservations: result.logItems.length,
  criticalIssues: criticalIssues.length,
  fieldErrors: {
    calculationErrors: fieldsWithCalcErrors,
    circularReferences: circularReferenceIssues.map((item) => item.subjectId),
    invalidReferences: result.logItems
      .filter((item) => item.messageSecondary.includes('does not exist'))
      .map((item) => ({
        fieldId: item.subjectId,
        issue: item.messageSecondary,
      })),
  },
  recommendations: criticalIssues.map((item) => ({
    fieldId: item.subjectId,
    issue: item.messageSecondary,
    severity: item.logLevel,
    suggestedAction:
      item.logLevel === ELogLevel.ERROR
        ? 'Fix immediately'
        : 'Review and consider fixing',
  })),
};

console.log('Actionable Error Report:', JSON.stringify(errorReport, null, 2));
```

## Currently Implemented OM

### Field-Level Observations

1. **`FieldLabelObservationMaker`**
   - Analyzes field labels for duplicates
   - Detects clarity and completeness issues
   - **Required Resources:** `formModel`

2. **`FieldLogicObservationMaker`**
   - Examines field visibility logic structure
   - Validates logical coherence
   - **Required Resources:** `formModel`

3. **`FieldLogicValidFieldIdsObservationMaker`**
   - Validates field references in logic expressions
   - Detects references to non-existent fields
   - **Required Resources:** `formModel`

4. **`FieldLogicCircularReferencesObservationMaker`**
   - Detects circular dependencies in visibility logic
   - Prevents infinite loops in field logic
   - **Required Resources:** `formModel`, `logicTrees` (optional)

5. **`FieldCalculationObservationMaker`**
   - Analyzes field calculations for validity
   - Detects circular dependencies in calculations
   - Validates field references in calculation expressions
   - **Required Resources:** `formModel`

### Form-Level Observations

1. **`FormConfigObservationMaker`**
   - Examines overall form configuration
   - Validates form settings and completeness
   - **Required Resources:** `formModel`

### Orchestration

1. **`CompositeFormObservationMaker`**
   - Runs multiple observation makers in sequence
   - Aggregates results from child makers
   - Supports graceful degradation for missing resources
   - **Required Resources:** `formModel` (base)

## Advanced Features

### Graceful Degradation

OM that can't run due to missing resources are skipped, not errors:

```typescript
// If logicTrees are missing, some makers will skip optimization but still run
const context: IObservationContext = {
  resources: {
    formModel: myFormModel,
    // logicTrees: undefined - missing but not fatal
  },
};
```

### Nested Observations

OM can have child makers that inherit context:

```typescript
// Parent maker automatically runs child makers
const parentMaker = new CompositeFormObservationMaker();
parentMaker.addObservationMaker(new FieldLabelObservationMaker());

// Results include both parent and child observations
const result = await parentMaker.makeObservation(context);
```

### Performance Optimization

Pre-compute expensive resources for better performance:

```typescript
// Pre-compute logic trees once
const logicTrees = await computeFieldVisibilityGraphs(formModel);

const context: IObservationContext = {
  resources: { formModel },
  logicTrees, // Reused across multiple makers
};
```

## Planned Extensions

### Future OM

1. **`SubmitActionObservationMaker`**
   - Validates submit action configurations
   - **Required Resources:** `formModel`, `submitActions`

2. **`EmailNotificationObservationMaker`**
   - Analyzes notification email logic and configuration
   - **Required Resources:** `formModel`, `emailNotifications`

3. **`EmailConfirmationObservationMaker`**
   - Validates confirmation email setup
   - **Required Resources:** `formModel`, `emailConfirmations`

4. **`WebhookObservationMaker`**
   - Examines webhook configurations and logic
   - **Required Resources:** `formModel`, `webhooks`

5. **`FormValidationObservationMaker`**
   - Comprehensive form-level validation
   - **Required Resources:** `formModel`, `formConfig`

### Integration Context

Future context structure for complete analysis:

```typescript
interface IDebugFormSessionContext extends IObservationContext {
  resources: {
    formModel: FsModelForm;
    formConfig?: FormConfig;
    submitActions?: Record<string, SubmitActionModel>;
    emailsConfirmation?: Record<string, EmailModel>;
    emailsNotification?: Record<string, EmailModel>;
    webhooks?: Record<string, WebhookModel>;
  };
  calculationTrees?: Record<string, CalcTree>;
  logicTrees?: Record<string, LogicTree>;
  sumoLogMessages?: LogMessage[]; // For runtime validation
}
```

## Best Practices

1. **Resource Declaration** - Always declare required resources explicitly
2. **Graceful Handling** - Handle missing optional resources gracefully
3. **Specific Messages** - Use `messageSecondary` for detailed, actionable information
4. **Related Entities** - Include `relatedEntityIds` for cross-references
5. **Appropriate Log Levels** - Use ERROR sparingly, only for true blockers
6. **Performance Awareness** - Design for large forms with many fields
7. **Extensibility** - Design makers to be composable and reusable
8. **Type Safety** - Use generic constraints when extending types for better IDE support
9. **Backward Compatibility** - When extending enums, include baseline values for compatibility
10. **Naming Conventions** - Use clear, descriptive names for custom subject types and observation classes

### **Design Patterns for Extensions**

```typescript
// ✅ Good: Clear naming and includes baseline types
enum EMyAppSubjectType {
  // Baseline types
  FORM = 'form',
  FIELD = 'field',
  // Domain-specific extensions
  USER_ROLE = 'userRole',
  INTEGRATION_ENDPOINT = 'integrationEndpoint',
  REPORT_TEMPLATE = 'reportTemplate',
}

// ✅ Good: Domain-specific observation classes
enum EMyAppObservationClass {
  // Baseline classes
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  // Security-focused extensions
  ACCESS_CONTROL = 'accessControl',
  DATA_PRIVACY = 'dataPrivacy',
  AUDIT_COMPLIANCE = 'auditCompliance',
}

// ✅ Good: Clear generic constraints and defaults
export class SecurityObservationMaker extends AbstractObservationMaker<
  EMyAppSubjectType,
  EMyAppObservationClass
> {
  // Clear, domain-specific implementation
}

// ❌ Avoid: Unclear extensions without context
enum EUnclearType {
  THING1 = 'thing1',
  STUFF = 'stuff',
  ITEM = 'item',
}
```

The observation system serves as both a validation framework and a template for creating domain-specific analysis tools. Most applications should extend these patterns to create custom observation makers tailored to their specific requirements.
