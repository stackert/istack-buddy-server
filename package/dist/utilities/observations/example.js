"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CompositeFormObservationMaker_1 = require("./CompositeFormObservationMaker");
const models_1 = require("../lib-tree/models");
const tree_visibility_1 = require("../lib-tree/tree-visibility");
const FormConfigObservationMaker_1 = require("./FormConfigObservationMaker");
const FieldLogicValidFieldIdsObservationMaker_1 = require("./FieldLogicValidFieldIdsObservationMaker");
// Create mock form data
const mockFormData = {
    fields: [
        {
            id: "field1",
            fieldId: "field1",
            type: "text",
            label: "  Field One  ",
            sort: 1,
        },
        {
            id: "field2",
            fieldId: "field2",
            type: "text",
            label: "",
            sort: 2,
        },
        {
            id: "field3",
            fieldId: "field3",
            type: "text",
            label: "Field Three",
            sort: 3,
        },
    ],
};
// Create mock form config
const mockFormConfig = {
    formId: "form1",
    hasApprovers: true,
    isEncrypted: true,
    isOnePageAtTime: true,
    isAuthProtected: true,
    authType: "sso",
};
async function runExample() {
    var _a;
    // Create form model
    const formModel = new models_1.FsModelForm(mockFormData);
    // Create mock logic trees using the same form model instance
    const mockLogicTrees = {
        field1: tree_visibility_1.FsFieldVisibilityGraph.fromFormModel("field1", formModel),
        field2: tree_visibility_1.FsFieldVisibilityGraph.fromFormModel("field2", formModel),
        field3: tree_visibility_1.FsFieldVisibilityGraph.fromFormModel("field3", formModel),
    };
    // Create context with resources
    const context = {
        resources: new Map([
            ["formModel", formModel],
            ["formConfig", mockFormConfig],
        ]),
        logicTrees: mockLogicTrees,
    };
    // Run FormConfigObservationMaker directly
    console.log("\nFormConfigObservationMaker Results:");
    console.log("=================================");
    const formConfigMaker = new FormConfigObservationMaker_1.FormConfigObservationMaker();
    const formConfigResult = await formConfigMaker.makeObservation(context);
    formConfigResult.logItems.forEach((item) => {
        console.log(`\n[${item.logLevel.toUpperCase()}] ${item.observationClass}/${item.observationSubclass}`);
        console.log(`Subject: ${item.subjectId}`);
        console.log(`Message: ${item.message}`);
        console.log(`Details: ${item.messageSecondary}`);
        if (item.relatedEntityIds.length > 0) {
            console.log(`Related: ${item.relatedEntityIds.join(", ")}`);
        }
    });
    // Create and run the composite observation maker
    console.log("\nCompositeFormObservationMaker Results:");
    console.log("===================================");
    const observationMaker = new CompositeFormObservationMaker_1.CompositeFormObservationMaker();
    // Add a new observation maker before running
    observationMaker.addObservationMaker(new FieldLogicValidFieldIdsObservationMaker_1.FieldLogicValidFieldIdsObservationMaker());
    const result = await observationMaker.makeObservation(context);
    // Print results in a readable format
    result.logItems.forEach((item) => {
        console.log(`\n[${item.logLevel.toUpperCase()}] ${item.observationClass}/${item.observationSubclass}`);
        console.log(`Subject: ${item.subjectId}`);
        console.log(`Message: ${item.message}`);
        console.log(`Details: ${item.messageSecondary}`);
        if (item.relatedEntityIds.length > 0) {
            console.log(`Related: ${item.relatedEntityIds.join(", ")}`);
        }
    });
    console.log("\nSummary:");
    console.log("========");
    console.log(`Total Observations: ${result.logItems.length}`);
    console.log(`Has Issues: ${result.isObservationTrue}`);
    console.log(`Child Results: ${((_a = result.childResults) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
}
// Run the example
runExample().catch(console.error);
//# sourceMappingURL=example.js.map