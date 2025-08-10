"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractObservationMaker = void 0;
const types_1 = require("./types");
/**
 * Base class for all Observation Makers (OM) that analyze forms and fields for issues and validation.
 *
 * Provides common functionality for creating structured log items and managing child Observation Makers.
 * Concrete implementations must define the specific observation logic and required resources.
 */
class AbstractObservationMaker {
    constructor() {
        /** Collection of child Observation Makers that will be executed during analysis. */
        this.childMakers = [];
    }
    /**
     * Adds a child Observation Maker to be executed during analysis.
     * @param maker The child Observation Maker to add
     */
    addChildMaker(maker) {
        this.childMakers.push(maker);
    }
    /**
     * Executes all child Observation Makers and aggregates their log items.
     * @param context The observation context to pass to child makers
     * @returns Promise resolving to aggregated log items from all child makers
     */
    async makeChildObservations(context) {
        const allLogItems = [];
        // Create child context with parent observer information
        const childContext = {
            ...context,
            parentObserver: this.constructor.name,
        };
        for (const maker of this.childMakers) {
            const result = await maker.makeObservation(childContext);
            allLogItems.push(...result.logItems);
        }
        return allLogItems;
    }
    // =============================================================================
    // CLEAN API - CONTEXT HANDLED AUTOMATICALLY, SENSIBLE OPTIONAL PARAMETERS
    // =============================================================================
    /**
     * Creates an ELogLevel.DEBUG log item for informational purposes.
     * @param context The observation context
     * @param options Configuration for the log item including subject ID and message
     * @returns The created debug log item
     */
    createDebugLogItem(context, options) {
        return this._createLogItem(context, {
            ...options,
            logLevel: types_1.ELogLevel.DEBUG,
            isObservationTrue: false,
        });
    }
    /**
     * Creates an ELogLevel.INFO log item for positive findings.
     * @param context The observation context
     * @param options Configuration for the log item including subject ID and message
     * @returns The created info log item
     */
    createInfoLogItem(context, options) {
        return this._createLogItem(context, {
            ...options,
            logLevel: types_1.ELogLevel.INFO,
            isObservationTrue: true,
        });
    }
    /**
     * Creates an ELogLevel.WARN log item for potential issues.
     * @param context The observation context
     * @param options Configuration for the log item including subject ID and message
     * @returns The created warning log item
     */
    createWarnLogItem(context, options) {
        return this._createLogItem(context, {
            ...options,
            logLevel: types_1.ELogLevel.WARN,
            isObservationTrue: true,
        });
    }
    /**
     * Creates an ELogLevel.ERROR log item for critical issues.
     * Note about "ERROR" level.  These are considered fatal issues.  They may not lead to complete melt-down
     * but the indicate the subject is not stable/reliable
     * @param context The observation context
     * @param options Configuration for the log item including subject ID and message
     * @returns The created error log item
     */
    createErrorLogItem(context, options) {
        return this._createLogItem(context, {
            ...options,
            logLevel: types_1.ELogLevel.ERROR,
            isObservationTrue: true,
        });
    }
    /**
     * Creates a log item with full customization options for advanced use cases.
     * @param context The observation context
     * @param options Complete configuration for the log item
     * @returns The created detailed log item
     */
    createDetailedLogMessage(context, options) {
        var _a;
        return this._createLogItem(context, {
            subjectId: options.subjectId,
            logLevel: options.logLevel,
            subjectType: options.subjectType,
            observationClass: options.observationClass,
            messageSecondary: options.messageSecondary,
            relatedEntityIds: options.relatedEntityIds,
            isObservationTrue: (_a = options.isObservationTrue) !== null && _a !== void 0 ? _a : true,
            additionalDetails: options.additionalDetails,
        });
    }
    // =============================================================================
    // PRIVATE IMPLEMENTATION
    // =============================================================================
    /**
     * Private implementation for creating log items with automatic context handling.
     * Fills in default values from the Observation Maker's properties.
     * @param context The observation context
     * @param options Configuration for the log item
     * @returns The created log item with defaults applied
     */
    _createLogItem(context, options) {
        return {
            subjectId: options.subjectId,
            logLevel: options.logLevel,
            subjectType: options.subjectType || this.subjectType,
            observationClass: options.observationClass || this.observationClass,
            observationMakerClass: this.constructor.name,
            message: this.messagePrimary,
            messageSecondary: options.messageSecondary,
            relatedEntityIds: options.relatedEntityIds || [],
            parentObserver: context === null || context === void 0 ? void 0 : context.parentObserver,
            isObservationTrue: options.isObservationTrue,
            additionalDetails: options.additionalDetails,
        };
    }
}
exports.AbstractObservationMaker = AbstractObservationMaker;
//# sourceMappingURL=AbstractObservationMaker.js.map