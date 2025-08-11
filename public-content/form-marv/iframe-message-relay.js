/**
 * IframeMessageRelay
 *
 * This script acts as a relay between the parent window and the form iframe.
 * It listens for messages from the parent window and uses FsBuddyMessageUtils to handle them.
 */

(function () {
  "use strict";

  // Wait for the FsBuddyMessageUtils library to load
  let initAttempts = 0;
  const MAX_INIT_ATTEMPTS = 50; // 5 seconds max

  function init() {
    initAttempts++;

    if (!window.FsBuddyMessageUtils) {
      if (initAttempts >= MAX_INIT_ATTEMPTS) {
        console.error("FsBuddyMessageUtils failed to load after 5 seconds");
        return;
      }
      setTimeout(init, 100);
      return;
    }

    setupMessageListener();

    // Show all hidden elements for debugging/analysis
    if (window.FsBuddyMessageUtils.showAllHiddenElements) {
      console.log("Calling showAllHiddenElements to reveal all fields...");
      window.FsBuddyMessageUtils.showAllHiddenElements();
    }

    // Notify parent that iframe is ready
    notifyParentReady();
  }

  function setupMessageListener() {
    window.addEventListener("message", function (event) {
      // Verify the message is from our parent window
      if (event.source !== window.parent) {
        return;
      }

      const { type, data } = event.data;

      switch (type) {
        case "ADD_FIELD_MESSAGE":
          handleAddFieldMessage(data);
          break;
        case "CLEAR_ALL_MESSAGES":
          handleClearAllMessages();
          break;
        case "CLEAR_FIELD_MESSAGES":
          handleClearFieldMessages(data);
          break;
        case "HIGHLIGHT_FIELD":
          handleHighlightField(data);
          break;
        case "REMOVE_FIELD_HIGHLIGHT":
          handleRemoveFieldHighlight(data);
          break;
        case "DEBUG_SHOW_FIELD_CONTAINERS":
          handleDebugShowFieldContainers();
          break;
        case "SHOW_ALL_HIDDEN_ELEMENTS":
          handleShowAllHiddenElements();
          break;
        case "GET_FIELD_INFO":
          handleGetFieldInfo(data);
          break;
        case "GET_ALL_FIELDS":
          handleGetAllFields();
          break;
        case "ADD_OBSERVATION_RESULTS":
          handleAddObservationResults(data);
          break;
        default:
          console.warn("Unknown message type:", type);
      }
    });
  }

  function handleAddFieldMessage(data) {
    const {
      fieldId,
      message,
      errorLevel = "info",
      relatedFieldIds = [],
      fieldType = "",
    } = data;
    const success = FsBuddyMessageUtils.addFieldMessage(
      fieldId,
      message,
      errorLevel,
      relatedFieldIds,
      fieldType
    );

    // Send response back to parent
    sendResponseToParent("ADD_FIELD_MESSAGE_RESPONSE", {
      success,
      fieldId,
      message,
      errorLevel,
    });
  }

  function handleClearAllMessages() {
    const count = FsBuddyMessageUtils.clearAllMessages();

    // Send response back to parent
    sendResponseToParent("CLEAR_ALL_MESSAGES_RESPONSE", { count });
  }

  function handleClearFieldMessages(data) {
    const { fieldId } = data;
    const count = FsBuddyMessageUtils.clearFieldMessages(fieldId);

    // Send response back to parent
    sendResponseToParent("CLEAR_FIELD_MESSAGES_RESPONSE", { fieldId, count });
  }

  function handleHighlightField(data) {
    const { fieldId } = data;
    FsBuddyMessageUtils.highlightField(fieldId);

    // Send response back to parent
    sendResponseToParent("HIGHLIGHT_FIELD_RESPONSE", {
      fieldId,
      success: true,
    });
  }

  function handleRemoveFieldHighlight(data) {
    const { fieldId } = data;
    FsBuddyMessageUtils.removeFieldHighlight(fieldId);

    // Send response back to parent
    sendResponseToParent("REMOVE_FIELD_HIGHLIGHT_RESPONSE", {
      fieldId,
      success: true,
    });
  }

  function handleDebugShowFieldContainers() {
    FsBuddyMessageUtils.debugShowFieldContainers();

    // Send response back to parent
    sendResponseToParent("DEBUG_SHOW_FIELD_CONTAINERS_RESPONSE", {
      success: true,
    });
  }

  function handleShowAllHiddenElements() {
    if (FsBuddyMessageUtils.showAllHiddenElements) {
      FsBuddyMessageUtils.showAllHiddenElements();
    }

    // Send response back to parent
    sendResponseToParent("SHOW_ALL_HIDDEN_ELEMENTS_RESPONSE", {
      success: true,
    });
  }

  function handleGetFieldInfo(data) {
    const { fieldId } = data;
    const fieldInfo = FsBuddyMessageUtils.getFieldInfo(fieldId);

    // Send response back to parent (remove DOM elements for serialization)
    const serializableFieldInfo = fieldInfo
      ? {
          id: fieldInfo.id,
          label: fieldInfo.label,
          type: fieldInfo.type,
          name: fieldInfo.name,
          value: fieldInfo.value,
          required: fieldInfo.required,
        }
      : null;

    sendResponseToParent("GET_FIELD_INFO_RESPONSE", {
      fieldId,
      fieldInfo: serializableFieldInfo,
    });
  }

  function handleGetAllFields() {
    const fields = FsBuddyMessageUtils.getAllFields();

    // Send response back to parent (remove DOM elements for serialization)
    const serializableFields = fields.map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type,
      name: field.name,
      value: field.value,
      required: field.required,
    }));

    sendResponseToParent("GET_ALL_FIELDS_RESPONSE", {
      fields: serializableFields,
    });
  }

  function handleAddObservationResults(data) {
    const { observationResults, observationMakerName } = data;

    console.log("Iframe received observation results:", data);

    try {
      let messagesAdded = 0;

      // Clear all existing messages first
      FsBuddyMessageUtils.clearAllMessages();

      // Process observation results and add appropriate messages to fields
      if (observationResults && observationResults.details) {
        const details = observationResults.details;

        // Use related entities as the authoritative source for field IDs
        if (details.relatedEntities && Array.isArray(details.relatedEntities)) {
          console.log("Processing related entities:", details.relatedEntities);
          details.relatedEntities.forEach((fieldId, index) => {
            console.log(`Adding message to field ${fieldId}`);

            // Get the corresponding message for this field
            const message =
              details.messages && details.messages[index]
                ? details.messages[index]
                : "Field identified in analysis";

            // Get the corresponding log level for this field
            const logLevel =
              details.logLevels && details.logLevels[index]
                ? details.logLevels[index]
                : "info";

            const success = FsBuddyMessageUtils.addFieldMessage(
              fieldId,
              message, // Use actual observation message
              logLevel, // Use actual log level
              [],
              "observation"
            );
            console.log(`Message added to field ${fieldId}:`, success);
            if (success) messagesAdded++;
          });
        }
      }

      // Send response back to parent
      sendResponseToParent("ADD_OBSERVATION_RESULTS_RESPONSE", {
        success: true,
        messagesAdded,
        observationMakerName,
      });
    } catch (error) {
      console.error("Error adding observation results:", error);
      sendResponseToParent("ADD_OBSERVATION_RESULTS_RESPONSE", {
        success: false,
        error: error.message,
        observationMakerName,
      });
    }
  }

  function extractFieldIdsFromMessage(message) {
    // Try to extract field IDs from message text
    const fieldIdPattern = /field[s]?\s*(?:id[s]?\s*)?:?\s*(\d+)/gi;
    const matches = [];
    let match;

    while ((match = fieldIdPattern.exec(message)) !== null) {
      matches.push(match[1]);
    }

    return matches;
  }

  function sendResponseToParent(type, data) {
    try {
      window.parent.postMessage(
        {
          type: type,
          data: data,
          timestamp: new Date().toISOString(),
        },
        "*"
      );
    } catch (error) {
      console.error("Error sending response to parent:", error);
    }
  }

  function notifyParentReady() {
    sendResponseToParent("IFRAME_READY", {
      ready: true,
      utilities: !!window.FsBuddyMessageUtils,
      timestamp: new Date().toISOString(),
    });
  }

  // Start initialization when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
