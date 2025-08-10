"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EObservationClass = exports.EObservationSubjectType = exports.ELogLevel = void 0;
// Enums with proper 'E' prefix
var ELogLevel;
(function (ELogLevel) {
    ELogLevel["DEBUG"] = "debug";
    ELogLevel["INFO"] = "info";
    ELogLevel["WARN"] = "warn";
    ELogLevel["ERROR"] = "error";
})(ELogLevel || (exports.ELogLevel = ELogLevel = {}));
var EObservationSubjectType;
(function (EObservationSubjectType) {
    EObservationSubjectType["FORM"] = "form";
    EObservationSubjectType["FIELD"] = "field";
    EObservationSubjectType["SUBMIT_ACTION"] = "submitAction";
    EObservationSubjectType["EMAIL_NOTIFICATION"] = "emailNotification";
    EObservationSubjectType["EMAIL_CONFIRMATION"] = "emailConfirmation";
    EObservationSubjectType["WEBHOOK"] = "webhook";
})(EObservationSubjectType || (exports.EObservationSubjectType = EObservationSubjectType = {}));
var EObservationClass;
(function (EObservationClass) {
    EObservationClass["ANALYSIS"] = "analysis";
    EObservationClass["LOGIC"] = "logic";
    EObservationClass["CALCULATION"] = "calculation";
    EObservationClass["VALIDATION"] = "validation";
    EObservationClass["CONFIGURATION"] = "configuration";
    EObservationClass["LABEL"] = "label";
})(EObservationClass || (exports.EObservationClass = EObservationClass = {}));
//# sourceMappingURL=types.js.map