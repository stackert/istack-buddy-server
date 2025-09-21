# Live Forms API (fsApi)

Without getting too technical, the infrastructure of our most recent Form builder (V4) has significantly changed. Due to these changes, some of the more custom solutions that involve modifying the DOM (especially form input elements) may not work as intended. Instead, we recommend utilizing the form’s API to make such changes to the form. Please refer to the API resource below to help get you started with customizing your forms.

Note: While we provide access to our API on all paid accounts, our support team is unable to assist with troubleshooting custom API setups.

The code provided in these examples are just examples. While some might be able to be plug and played into a real use case, others will need to be customized and tailored to meet your needs. These examples are designed to be used by those who are comfortable and confident with scripts.

Formstack Forms, have a special field type 'embed'.
It's intended to place javascript inside these fields in the form builder, which then will execute when the form is rendered.

# Examples

## Checkbox Field Monitor Script

This script monitors a specific checkbox field in a form for changes, extracts selected values, and processes them. Here's how it works:

### Components

#### Form and Field Initialization

- Constants `FORM_ID` and `CHECKBOX_FIELD_ID` serve as placeholders for form and checkbox field identifiers
- Form variable initialized using `window.fsApi().getForm(FORM_ID)` to get form object from Formstack API

#### `getCheckboxValues` Function

- Takes a `checkboxField` object as parameter
- Processes current values of the checkbox field
- Handles object format including `useOtherValue` and `otherValue` for custom inputs
- Extracts selected options by:
  - Retrieving current values
  - Looping through `valueObject` keys
  - Filtering based on predefined options
- Returns array of selected option values

### Event Listener Setup

- Registers event listener on the form
- Monitors for change events
- Validates if change relates to target checkbox field (`CHECKBOX_FIELD_ID`)
- When triggered:
  1. Retrieves checkbox field object
  2. Calls `getCheckboxValues` with field object
  3. Resolves promise with results

```javascript
<script>
// Formstack can not provide support for custom javascript.
// Replace with appropriate values
 'use strict';

const FORM_ID = 84;
const CHECKBOX_FIELD_ID = '548';

const form = window.fsApi().getForm(FORM_ID);

  function getCheckboxValues(checkboxField) {
    const valueObject = checkboxField.getValue();
    // will look something like:
    // {"0": null, "1": "value of option1", "2": null, "useOtherValue": true,"otherValue": "test" }

    // if options are required
    const options = checkboxField.getGeneralAttribute('options');
    const selectedOptions = Object.keys(valueObject).reduce(function(key, collected) {
      // capture other value if set
      if (key === 'useOtherValue' && valueObject[key]) {
        collected.push({ label: 'Other', value: valueObject['otherValue'] });
        return collected;
      }
      // already captured above
      if (key === 'otherValue') {
        return collected;
      }
      const value = valueObject[key];
      const possibleOption = options[key]
      if (value && possibleOption) {
        // make a copy so we don't mess up the actual options
        collected.push({ label: possibleOption.label, value: possibleOptions.value });
      }
    }, []);

    // to get an array of values only
    return Object.values(valueObject).filter(key => !!key);
}

form.registerFormEventListener({
  type: 'change',
    onFormEvent: function (event) {
        if (event.data.fieldId === CHECKBOX_FIELD_ID) {
            const checkboxField = form.getField(CHECKBOX_FIELD_ID);
      getCheckboxValues(checkboxField);
        }
        return Promise.resolve(event);
    }
  });
</script>
```

## Google Maps Places Autocomplete Integration

This code integrates Google Maps Places Autocomplete functionality into a form. It enhances the address field by suggesting addresses as users type and automatically populates form fields with the selected address components.

### Code Components

#### Strict Mode

- Uses `'use strict'` directive
- Enforces more secure and error-resistant code execution
- Helps prevent common coding mistakes and unsafe actions

### Variable Declarations

Constants defined:

- `FORM_ID`
- `FIELD_ID`
- `ADDRESS_1_ID`
- `API_KEY`

### Form and Field Retrieval

- Retrieves form using `window.fsApi().getForm(FORM_ID)`
- Retrieves specific field using `form.getField(FIELD_ID)`

### `embedAPI` Function

- Creates new `<script>` tag
- Sets `src` attribute to Google Maps JavaScript API URL
- Includes API key in URL
- Appends script to document `<head>`

### `initMap` Function

- Initializes Google Maps Places Autocomplete
- Retrieves address input field by ID
- Configures autocomplete for address suggestions
- Sets up place selection event listener
- Triggers `fillInAddress` when place is selected

### `fillInAddress` Function

- Extracts address components:
  - Street number
  - Route
  - City
  - State
  - Country
  - Postal code
- Populates form fields with extracted data

### Initialization

- Calls `embedAPI()` to load Google Maps API

```javascript
<script>
// Formstack can not provide support for custom javascript.
// Replace with appropriate values
 'use strict';
  const FORM_ID = 'YOUR FORM';
  const FIELD_ID = 'ADDRESS FIELD';
  const ADDRESS_1_ID = 'field' + FIELD_ID + '-address';

  const API_KEY = 'YOUR_API_KEY';

  const form = window.fsApi().getForm(FORM_ID);
  const field = form.getField(FIELD_ID);

  function embedAPI() {
    var scriptTag = document.createElement('script');
    //Change the API key in this URL
    scriptTag.setAttribute('src', 'https://maps.googleapis.com/maps/api/js?key= ' + API_KEY + '&libraries=places&callback=initMap&solution_channel=GMP_QB_addressselection_v1_cA');

    document.head.appendChild(scriptTag);
  }

  function initMap() {
    //CHange the field ID to point to the address block
    const autocompleteInput = document.getElementById(ADDRESS_1_ID);
    const autocomplete = new google.maps.places.Autocomplete(autocompleteInput, {
      fields: ['address_components', 'geometry', 'name'],
      types: ['address'],
    });
    autocomplete.addListener('place_changed', function() {
      const place = autocomplete.getPlace();
      console.log(place);
      if (!place.geometry) {
        // User entered the name of a Place that was not suggested and
        // pressed the Enter key, or the Place Details request failed.
        window.alert('No details available for input: \'' + place.name + '\'');
        return;
      }
      fillInAddress(place);
    });

    function fillInAddress(place) {  // optional parameter
      const addressNameFormat = {
        'street_number': 'short_name',
        'route': 'long_name',
        'locality': 'long_name',
        'administrative_area_level_1': 'short_name',
        'country': 'long_name',
        'postal_code': 'short_name',
      };

      const getAddressComp = function(type) {
        for (const component of place.address_components) {
          if (component.types[0] === type) {
            return component[addressNameFormat[type]];
          }
        }
        return '';
      };
      const addressValue = {
        address: getAddressComp('street_number') + ' ' + getAddressComp('route'),
        address2: '',
        city: getAddressComp('locality'),
        state: getAddressComp('administrative_area_level_1'),
        country: getAddressComp('country'),
        zip: getAddressComp('postal_code'),
      };

      field.setValue(addressValue);
    }
  }

  embedAPI();
</script>
```

## end of examples

# fsApi Documentation

## @formstack/forms-renderer Documentation

### Core Types

### TFSForm

The form renderer object on the page, usually `window.FSForm`

```typescript
type TFSForm = {
  _actions: any;
  _store: any;
  plugins: any;
  render: TRenderForm;
};
```

Example usage:

```javascript
FSForm.render({
    id: FORM_ID,
    viewkey: VIEW_KEY,
    target: document.getElementById('fsform-container'),
    fullscreen: true,
}, {
    formResponse: { ... },
});
```

### TFieldValueFile

Type definition for file upload field values:

```typescript
type TFieldValueFile = {
  uploads?: {
    [filename: string]: string;
  };
  url?: string;
  value?: IStoreValueFileValue[];
};
```

## Field Types

### IFieldTypeAttributesUnion

Union type for all possible field attributes in the form renderer.

### Other Field Value Types

- `TFieldValueText` - Text input values
- `TFieldValueEmail` - Email field values
- `TFieldValueNumber` - Numeric input values
- `TFieldValuePhone` - Phone number values
- `TFieldValueCheckbox` - Checkbox field values
- `TFieldValueRadio` - Radio button values
- `TFieldValueSelect` - Select dropdown values
- `TFieldValueTextArea` - Multi-line text values
- `TFieldValueAddress` - Address field values
- `TFieldValueName` - Name field values
- `TFieldValueCreditCard` - Credit card field values
- `TFieldValueMatrix` - Matrix field values
- `TFieldValueProduct` - Product field values
- `TFieldValueRating` - Rating field values
- `TFieldValueSignature` - Signature field values

## Interfaces

### Core Interfaces

- `IAbstractEntity` - Base entity interface
- `IAbstractFieldParent` - Parent field interface
- `IApi` - Core API interface
- `IFieldApi` - Field-specific API interface
- `IFormApi` - Form-level API interface
- `IFormEventData` - Form event data interface
- `IFormEventListener` - Event listener interface
- `IPagingContext` - Pagination context interface
- `ISectionApi` - Section API interface

## Enums

- `CssSelectorClasses` - CSS class name constants
- `FormEvents` - Form event type constants

##

### IFieldApi.getGeneralAttribute

So the valid keys for getGeneralAttribute are:

- autofill - Autofill settings
- columnSpan - Column span value
- hidden - Whether field is hidden
- hideLabel - Whether to hide the field label
- id - Field ID
- isRootSection - Whether field is a root section
- label - Field label text
- language - Field language code
- options - Array of field options
- readOnly - Whether field is read-only
- required - Whether field is required
- section - Section ID
- shouldForceSkipValidation - Skip validation flag
- supportingText - Supporting/help text
- type - Field type
- unique - Whether field requires unique values
- useCallout - Whether to use callout styling

These are the standard general attributes that apply to all field types. Some field types may have additional type-specific attributes that would be accessed through getTypeAttribute instead