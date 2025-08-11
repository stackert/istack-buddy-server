/**
 * FsBuddyMessageUtils
 *
 * Utility library for adding messages to Formstack form fields and interacting with forms.
 * This script provides methods to add validation messages, highlight fields, and debug form structure.
 */

(function () {
  "use strict";

  // Global namespace
  window.FsBuddyMessageUtils = {
    addFieldMessage: addFieldMessage,
    clearAllMessages: clearAllMessages,
    clearFieldMessages: clearFieldMessages,
    highlightField: highlightField,
    removeFieldHighlight: removeFieldHighlight,
    debugShowFieldContainers: debugShowFieldContainers,
    getFieldInfo: getFieldInfo,
    getAllFields: getAllFields,
    showAllHiddenElements: showAllHiddenElements,
  };

  /**
   * Add a message to a specific form field
   * @param {string} fieldId - The ID of the field
   * @param {string} message - The message text
   * @param {string} errorLevel - 'error', 'warn', 'info', or 'success'
   * @param {string[]} relatedFieldIds - Array of related field IDs
   * @param {string} fieldType - The type of field
   * @returns {boolean} Success status
   */
  function addFieldMessage(
    fieldId,
    message,
    errorLevel = "info",
    relatedFieldIds = [],
    fieldType = ""
  ) {
    try {
      const fieldElement = findFieldElement(fieldId);
      if (!fieldElement) {
        console.warn(
          `Field with ID ${fieldId} not found in DOM - adding to non-visible container`
        );
        addOrphanedFieldMessage(fieldId, message, errorLevel, fieldType);
        return true;
      }

      // Create message element
      const messageElement = createMessageElement(message, errorLevel, fieldId);

      // Find the appropriate insertion point
      const insertionPoint = findMessageInsertionPoint(fieldElement, fieldType);
      if (insertionPoint) {
        insertionPoint.appendChild(messageElement);

        // Highlight related fields if any
        relatedFieldIds.forEach((relatedId) => {
          highlightField(relatedId);
        });

        console.log(
          `Added ${errorLevel} message to field ${fieldId}:`,
          message
        );
        return true;
      } else {
        console.warn(
          `Could not find insertion point for field ${fieldId} - adding to non-visible container`
        );
        addOrphanedFieldMessage(fieldId, message, errorLevel, fieldType);
        return true;
      }
    } catch (error) {
      console.error("Error adding field message:", error);
      addOrphanedFieldMessage(fieldId, message, errorLevel, fieldType);
      return false;
    }
  }

  /**
   * Clear all messages from all fields
   * @returns {number} Number of messages cleared
   */
  function clearAllMessages() {
    // Clear regular field messages
    const messages = document.querySelectorAll(".fs-observation-message");
    const count = messages.length;
    messages.forEach((message) => message.remove());

    // Clear orphaned messages
    const orphanedMessages = document.querySelectorAll(
      ".fs-buddy-orphaned-message"
    );
    const orphanedCount = orphanedMessages.length;
    orphanedMessages.forEach((message) => message.remove());

    // Hide orphaned container if empty
    const orphanedContainer = document.getElementById(
      "fs-buddy-orphaned-messages"
    );
    if (orphanedContainer) {
      orphanedContainer.style.display = "none";
    }

    // Clear all field highlights
    document
      .querySelectorAll(".fs-buddy-field-highlight")
      .forEach((element) => {
        element.classList.remove("fs-buddy-field-highlight");
      });

    const totalCount = count + orphanedCount;
    console.log(
      `Cleared ${count} regular messages and ${orphanedCount} orphaned messages (${totalCount} total)`
    );
    return totalCount;
  }

  /**
   * Clear messages from a specific field
   * @param {string} fieldId - The field ID
   * @returns {number} Number of messages cleared
   */
  function clearFieldMessages(fieldId) {
    const messages = document.querySelectorAll(
      `.fs-buddy-field-message[data-field-id="${fieldId}"]`
    );
    const count = messages.length;
    messages.forEach((message) => message.remove());
    removeFieldHighlight(fieldId);
    return count;
  }

  /**
   * Highlight a specific field
   * @param {string} fieldId - The field ID
   */
  function highlightField(fieldId) {
    const fieldElement = findFieldElement(fieldId);
    if (fieldElement) {
      const input = fieldElement.querySelector("input, select, textarea");
      if (input) {
        input.classList.add("fs-buddy-field-highlight");
      }
    }
  }

  /**
   * Remove highlight from a specific field
   * @param {string} fieldId - The field ID
   */
  function removeFieldHighlight(fieldId) {
    const fieldElement = findFieldElement(fieldId);
    if (fieldElement) {
      const input = fieldElement.querySelector("input, select, textarea");
      if (input) {
        input.classList.remove("fs-buddy-field-highlight");
      }
    }
  }

  /**
   * Debug function to show field containers
   */
  function debugShowFieldContainers() {
    console.log("=== DEBUG: Starting field container analysis ===");

    // Log all potential field containers
    const potentialContainers = document.querySelectorAll(
      '[id*="field"], [class*="field"], [class*="fs"], input, select, textarea'
    );
    console.log(
      `Found ${potentialContainers.length} potential field elements:`,
      potentialContainers
    );

    const fields = getAllFields();
    console.log(`Processed fields found: ${fields.length}`, fields);

    // Show a visual indicator for debug
    const debugDiv = document.createElement("div");
    debugDiv.style.position = "fixed";
    debugDiv.style.top = "10px";
    debugDiv.style.right = "10px";
    debugDiv.style.padding = "10px";
    debugDiv.style.backgroundColor = "red";
    debugDiv.style.color = "white";
    debugDiv.style.zIndex = "9999";
    debugDiv.style.borderRadius = "5px";
    debugDiv.innerHTML = `DEBUG: Found ${fields.length} fields`;
    document.body.appendChild(debugDiv);

    // Remove debug div after 3 seconds
    setTimeout(() => {
      if (debugDiv.parentNode) {
        debugDiv.parentNode.removeChild(debugDiv);
      }
    }, 3000);

    // Temporarily highlight all field containers
    fields.forEach((field, index) => {
      if (field.element) {
        field.element.style.outline = "3px dashed #ff0000";
        field.element.style.backgroundColor = "rgba(255, 0, 0, 0.1)";

        // Add a label
        const label = document.createElement("div");
        label.style.position = "absolute";
        label.style.top = "0";
        label.style.left = "0";
        label.style.backgroundColor = "red";
        label.style.color = "white";
        label.style.padding = "2px 5px";
        label.style.fontSize = "12px";
        label.style.zIndex = "1000";
        label.textContent = `Field ${field.id || index}`;
        field.element.style.position = "relative";
        field.element.appendChild(label);

        setTimeout(() => {
          field.element.style.outline = "";
          field.element.style.backgroundColor = "";
          if (label.parentNode) {
            label.parentNode.removeChild(label);
          }
        }, 5000);
      }
    });

    // Also try to find fields by common Formstack patterns
    const fsElements = document.querySelectorAll(
      '.fsFieldRow, .fsField, [id^="field"], [class*="fsField"]'
    );
    console.log(
      `Found ${fsElements.length} elements with Formstack patterns:`,
      fsElements
    );

    fsElements.forEach((element, index) => {
      element.style.border = "2px solid blue";
      setTimeout(() => {
        element.style.border = "";
      }, 5000);
    });
  }

  /**
   * Get information about a specific field
   * @param {string} fieldId - The field ID
   * @returns {object|null} Field information
   */
  function getFieldInfo(fieldId) {
    const fieldElement = findFieldElement(fieldId);
    if (!fieldElement) return null;

    const input = fieldElement.querySelector("input, select, textarea");
    const label = fieldElement.querySelector("label");

    return {
      id: fieldId,
      element: fieldElement,
      input: input,
      label: label ? label.textContent.trim() : "",
      type: input ? input.type || input.tagName.toLowerCase() : "unknown",
      name: input ? input.name : "",
      value: input ? input.value : "",
      required: input ? input.required : false,
    };
  }

  /**
   * Get all fields in the form
   * @returns {Array} Array of field information objects
   */
  function getAllFields() {
    const fields = [];
    const fieldElements = document.querySelectorAll(
      '[id^="field"], .fsFieldRow, .fsField'
    );

    fieldElements.forEach((element) => {
      const input = element.querySelector("input, select, textarea");
      if (input) {
        const fieldId = extractFieldId(element, input);
        if (fieldId) {
          const fieldInfo = getFieldInfo(fieldId);
          if (fieldInfo) {
            fields.push(fieldInfo);
          }
        }
      }
    });

    return fields;
  }

  /**
   * Add a message to the orphaned (non-visible) fields container
   * @param {string} fieldId - The field ID
   * @param {string} message - The message text
   * @param {string} errorLevel - The error level
   * @param {string} fieldType - The field type
   */
  function addOrphanedFieldMessage(fieldId, message, errorLevel, fieldType) {
    // Get or create the orphaned messages container
    let container = document.getElementById("fs-buddy-orphaned-messages");

    if (!container) {
      container = createOrphanedMessagesContainer();
    }

    // Create the message element for orphaned field
    const messageDiv = document.createElement("div");
    messageDiv.className = `fs-buddy-orphaned-message ${errorLevel}`;
    messageDiv.setAttribute("data-field-id", fieldId);

    // Create field info header
    const fieldHeader = document.createElement("div");
    fieldHeader.className = "fs-buddy-orphaned-field-header";
    fieldHeader.innerHTML = `
            <strong>Field ${fieldId}</strong> 
            ${
              fieldType
                ? `<span class="field-type">(type=${fieldType})</span>`
                : ""
            }
            <span class="non-visible-badge">Non-visible Field</span>
        `;

    // Create message content
    const messageContent = document.createElement("div");
    messageContent.className = "fs-buddy-orphaned-message-content";
    messageContent.innerHTML = message;

    messageDiv.appendChild(fieldHeader);
    messageDiv.appendChild(messageContent);

    // Add to container
    const messagesList = container.querySelector(
      ".fs-buddy-orphaned-messages-list"
    );
    messagesList.appendChild(messageDiv);

    // Show the container if it was hidden
    container.style.display = "block";

    console.log(`Added orphaned message for field ${fieldId}:`, message);
  }

  /**
   * Create the orphaned messages container
   */
  function createOrphanedMessagesContainer() {
    const container = document.createElement("div");
    container.id = "fs-buddy-orphaned-messages";
    container.className = "fs-buddy-orphaned-messages-container";

    // Add CSS styles for better readability
    const style = document.createElement("style");
    style.textContent = `
      .fs-buddy-orphaned-messages-container {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        margin: 20px 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      
      .fs-buddy-orphaned-messages-header {
        background: #e9ecef;
        padding: 15px 20px;
        border-bottom: 1px solid #dee2e6;
        border-radius: 8px 8px 0 0;
      }
      
      .fs-buddy-orphaned-messages-header h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
        font-weight: 600;
        color: #495057;
      }
      
      .fs-buddy-orphaned-messages-header p {
        margin: 0;
        font-size: 14px;
        color: #6c757d;
      }
      
      .fs-buddy-toggle-orphaned {
        background: #007bff;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        margin-top: 8px;
      }
      
      .fs-buddy-toggle-orphaned:hover {
        background: #0056b3;
      }
      
      .fs-buddy-orphaned-messages-list {
        padding: 0;
      }
      
      .fs-buddy-orphaned-message {
        border-bottom: 1px solid #dee2e6;
        padding: 15px 20px;
        background: white;
      }
      
      .fs-buddy-orphaned-message:last-child {
        border-bottom: none;
        border-radius: 0 0 8px 8px;
      }
      
      .fs-buddy-orphaned-field-header {
        margin-bottom: 10px;
        font-size: 14px;
        line-height: 1.4;
      }
      
      .fs-buddy-orphaned-field-header strong {
        color: #495057;
        font-weight: 600;
      }
      
      .field-type {
        color: #6c757d;
        font-style: italic;
      }
      
      .non-visible-badge {
        background: #ffc107;
        color: #212529;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 500;
        margin-left: 8px;
      }
      
      .fs-buddy-orphaned-message-content {
        font-size: 13px;
        line-height: 1.5;
        color: #495057;
      }
      
      .fs-buddy-orphaned-message-content pre {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        border-radius: 4px;
        padding: 12px;
        margin: 8px 0;
        font-size: 12px;
        line-height: 1.4;
        overflow-x: auto;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 300px;
        overflow-y: auto;
      }
      
      .fs-buddy-orphaned-message-content code {
        background: #f1f3f4;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 12px;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      }
      
      .fs-buddy-orphaned-message.debug {
        border-left: 4px solid #17a2b8;
      }
      
      .fs-buddy-orphaned-message.info {
        border-left: 4px solid #007bff;
      }
      
      .fs-buddy-orphaned-message.warn {
        border-left: 4px solid #ffc107;
      }
      
      .fs-buddy-orphaned-message.error {
        border-left: 4px solid #dc3545;
      }
    `;
    document.head.appendChild(style);

    // Create header
    const header = document.createElement("div");
    header.className = "fs-buddy-orphaned-messages-header";
    header.innerHTML = `
            <h3>📋 Messages for Non-Visible Fields</h3>
            <p>These messages belong to fields that are not visible on the form (descriptions, sections, embeds, etc.)</p>
        `;

    // Create collapsible toggle
    const toggle = document.createElement("button");
    toggle.className = "fs-buddy-toggle-orphaned";
    toggle.innerHTML = "▼ Hide Messages";
    toggle.onclick = function () {
      const messagesList = container.querySelector(
        ".fs-buddy-orphaned-messages-list"
      );
      const isVisible = messagesList.style.display !== "none";
      messagesList.style.display = isVisible ? "none" : "block";
      toggle.innerHTML = isVisible ? "▶ Show Messages" : "▼ Hide Messages";
    };

    // Create messages list
    const messagesList = document.createElement("div");
    messagesList.className = "fs-buddy-orphaned-messages-list";

    // Assemble container
    header.appendChild(toggle);
    container.appendChild(header);
    container.appendChild(messagesList);

    // Insert at the top of the form
    const formContainer = document.querySelector(".fsForm, form, body");
    if (formContainer) {
      formContainer.insertBefore(container, formContainer.firstChild);
    } else {
      document.body.appendChild(container);
    }

    return container;
  }

  /**
   * Remove hiding CSS classes to show form fields and sections while preserving UI dialogs
   * This is useful for debugging and analysis purposes
   */
  function showAllHiddenElements() {
    console.log("Removing hiding CSS classes to show form elements...");

    // Remove fsHidden class from form fields and sections only
    const fsHiddenElements = document.querySelectorAll(".fsHidden");
    fsHiddenElements.forEach((element) => {
      // Skip modal dialogs and UI elements
      if (shouldSkipElement(element)) {
        return;
      }
      element.classList.remove("fsHidden");
      console.log("Removed fsHidden from:", element.id || element.className);
    });

    // Remove hidden class from form fields and sections only
    const hiddenElements = document.querySelectorAll(".hidden");
    hiddenElements.forEach((element) => {
      // Skip modal dialogs and UI elements
      if (shouldSkipElement(element)) {
        return;
      }
      element.classList.remove("hidden");
      console.log("Removed hidden from:", element.id || element.className);
    });

    // Override CSS display properties for form fields and sections only
    const allElements = document.querySelectorAll("*");
    allElements.forEach((element) => {
      // Skip modal dialogs and UI elements
      if (shouldSkipElement(element)) {
        return;
      }

      const computedStyle = window.getComputedStyle(element);
      if (computedStyle.display === "none") {
        element.style.display = "block";
        console.log(
          "Forced display:block on:",
          element.id || element.className
        );
      }
    });

    console.log(
      "Form hiding classes removed. Form fields and sections should now be visible."
    );
  }

  /**
   * Check if an element should be skipped (preserved as hidden)
   * This prevents showing modal dialogs and other UI elements
   */
  function shouldSkipElement(element) {
    // Skip modal dialogs
    if (
      element.classList.contains("fs-ngdialog") ||
      element.classList.contains("fs-modal") ||
      element.classList.contains("fs-form-dialog") ||
      element.classList.contains("fs-form-dialog--hidden") ||
      element.classList.contains("fs-form-dialog__password") ||
      element.classList.contains("fs-form-dialog__textarea")
    ) {
      return true;
    }

    // Skip save/resume related elements
    if (
      element.id &&
      (element.id.includes("save") ||
        element.id.includes("resume") ||
        element.id.includes("password") ||
        element.id.includes("dialog"))
    ) {
      return true;
    }

    // Skip elements with dialog-related text content
    if (
      element.textContent &&
      (element.textContent.includes("save and resume") ||
        element.textContent.includes("password") ||
        element.textContent.includes("dialog") ||
        element.textContent.includes("modal"))
    ) {
      return true;
    }

    return false;
  }

  // Helper functions

  /**
   * Find the DOM element for a field
   * @param {string} fieldId - The field ID
   * @returns {Element|null} The field element
   */
  function findFieldElement(fieldId) {
    console.log(`Looking for field with ID: ${fieldId}`);

    // Try various selectors to find the field - Formstack specific
    const selectors = [
      `#field${fieldId}`,
      `#fsfield${fieldId}`,
      `[id="field${fieldId}"]`,
      `[id="fsfield${fieldId}"]`,
      `[data-field-id="${fieldId}"]`,
      `input[id="${fieldId}"]`,
      `select[id="${fieldId}"]`,
      `textarea[id="${fieldId}"]`,
      `input[name*="${fieldId}"]`,
      `select[name*="${fieldId}"]`,
      `textarea[name*="${fieldId}"]`,
      // Formstack specific patterns
      `.fsFieldRow[id*="${fieldId}"]`,
      `.fsField[id*="${fieldId}"]`,
      `[class*="field${fieldId}"]`,
      `[id*="${fieldId}"]`,
    ];

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          console.log(
            `Found field ${fieldId} with selector: ${selector}`,
            element
          );
          // Return the field container, not just the input
          const container =
            element.closest(
              ".fsFieldRow, .fsField, .form-group, .field-container"
            ) ||
            element.closest('[class*="field"]') ||
            element.parentElement;
          console.log(`Field container for ${fieldId}:`, container);
          return container;
        }
      } catch (e) {
        // Ignore selector errors
      }
    }

    console.warn(`Field ${fieldId} not found with any selector`);
    return null;
  }

  /**
   * Create a message element
   * @param {string} message - The message text
   * @param {string} errorLevel - The error level
   * @param {string} fieldId - The field ID
   * @returns {Element} The message element
   */
  function createMessageElement(message, errorLevel, fieldId) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `fs-observation-message fs-${errorLevel}`;
    messageDiv.setAttribute("data-field-id", fieldId);
    messageDiv.innerHTML = message;

    // Apply proper styling
    messageDiv.style.padding = "8px";
    messageDiv.style.margin = "5px 0";
    messageDiv.style.borderRadius = "4px";
    messageDiv.style.fontSize = "14px";
    messageDiv.style.display = "block";
    messageDiv.style.width = "100%";
    messageDiv.style.boxSizing = "border-box";
    messageDiv.style.border = "1px solid";

    // Style for pre tags (JSON content)
    const preTags = messageDiv.querySelectorAll("pre");
    preTags.forEach((pre) => {
      pre.style.backgroundColor = "rgba(0,0,0,0.05)";
      pre.style.padding = "8px";
      pre.style.borderRadius = "3px";
      pre.style.fontSize = "12px";
      pre.style.overflow = "auto";
      pre.style.maxHeight = "200px";
      pre.style.whiteSpace = "pre-wrap";
      pre.style.wordBreak = "break-word";
    });

    // Set color based on error level
    switch (errorLevel) {
      case "debug":
        messageDiv.style.backgroundColor = "#e8f4f8";
        messageDiv.style.color = "#0288d1";
        messageDiv.style.borderColor = "#0288d1";
        break;
      case "log":
        messageDiv.style.backgroundColor = "#e8f8f5";
        messageDiv.style.color = "#00796b";
        messageDiv.style.borderColor = "#00796b";
        break;
      case "warn":
        messageDiv.style.backgroundColor = "#fff8e1";
        messageDiv.style.color = "#d84315"; // Higher contrast dark orange
        messageDiv.style.borderColor = "#ff8f00";
        messageDiv.style.fontWeight = "500"; // Slightly bolder for better readability
        break;
      case "error":
        messageDiv.style.backgroundColor = "#ffebee";
        messageDiv.style.color = "#c62828";
        messageDiv.style.borderColor = "#c62828";
        break;
      case "info":
        messageDiv.style.backgroundColor = "#e8f5e8"; // Light green background
        messageDiv.style.color = "#2e7d32"; // Dark green text for good contrast
        messageDiv.style.borderColor = "#4caf50";
        break;
      case "logic":
      case "calculation":
        messageDiv.style.backgroundColor = "#f3e5f5";
        messageDiv.style.color = "#7b1fa2";
        messageDiv.style.borderColor = "#7b1fa2";
        break;
      default:
        messageDiv.style.backgroundColor = "#f5f5f5";
        messageDiv.style.color = "#666";
        messageDiv.style.borderColor = "#ddd";
    }

    return messageDiv;
  }

  /**
   * Find the best insertion point for a message
   * @param {Element} fieldElement - The field element
   * @param {string} fieldType - The field type
   * @returns {Element|null} The insertion point
   */
  function findMessageInsertionPoint(fieldElement, fieldType) {
    // Look for existing message containers
    let container = fieldElement.querySelector(
      ".fsValidationError, .field-help, .help-text"
    );

    if (!container) {
      // Create a container at the end of the field
      container = document.createElement("div");
      container.className = "fs-buddy-message-container";
      fieldElement.appendChild(container);
    }

    return container;
  }

  /**
   * Extract field ID from element
   * @param {Element} element - The field element
   * @param {Element} input - The input element
   * @returns {string|null} The field ID
   */
  function extractFieldId(element, input) {
    // Try to extract ID from various sources
    if (element.id && element.id.includes("field")) {
      return element.id.replace("field", "");
    }

    if (input.id) {
      return input.id.replace(/^field/, "");
    }

    if (input.name) {
      const match = input.name.match(/\d+/);
      return match ? match[0] : null;
    }

    return null;
  }

  console.log("FsBuddyMessageUtils loaded successfully");
})();
