#!/usr/bin/env ts-node

import { fsApiClient } from '../../src/robots/api/fsApiClient';

async function testMarvStatus() {
  console.log('🔍 Testing Marv status for form 5603242...');

  const apiKey = 'cc17435f8800943cc1abd3063a8fe44f';
  console.log(
    `🔑 Using API key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`,
  );

  const client = fsApiClient.setApiKey(apiKey);

  try {
    // Try to get form fields to test the API key
    const response = await (client as any).makeRequest(
      `/form/5603242.json`,
      'GET',
    );

    if (response.isSuccess) {
      console.log('✅ API key is valid and can access the form!');

      const fields = response.response?.fields || [];
      console.log(`📊 Form has ${fields.length} fields`);

      const marvEnabledField = fields.find(
        (field: any) => field.label === 'MARV_ENABLED',
      );

      if (marvEnabledField) {
        console.log('✅ Form IS Marv enabled!');
        console.log(`   MARV_ENABLED field ID: ${marvEnabledField.id}`);
      } else {
        console.log('❌ Form is NOT Marv enabled');
        console.log('   No MARV_ENABLED field found');
      }

      // Check for fields with logic
      const fieldsWithLogic = fields.filter(
        (field: any) => field.logic && Object.keys(field.logic).length > 0,
      );
      console.log(`📝 Found ${fieldsWithLogic.length} fields with logic`);

      if (fieldsWithLogic.length > 0) {
        console.log('   Fields with logic:');
        fieldsWithLogic.forEach((field: any) => {
          console.log(`   - ${field.label} (ID: ${field.id})`);
        });
      }
    } else {
      console.log('❌ API call failed:');
      console.log(response.errorItems?.join(', '));
    }
  } catch (error) {
    console.log('❌ Error:', error instanceof Error ? error.message : error);
  }
}

testMarvStatus();
