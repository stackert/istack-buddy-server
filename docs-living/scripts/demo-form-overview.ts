#!/usr/bin/env ts-node

/**
 * Demo: Form and Related Entity Overview
 *
 * This script demonstrates the new formAndRelatedEntityOverview function
 * that retrieves comprehensive form information from the Formstack API.
 */

import { fsApiClient } from '../../src/robots/api/fsApiClient';

async function demoFormOverview() {
  fsApiClient.setApiKey('bf77018720efca7df34b3503dbc486e8');

  const formId = '5603242';
  const result = await fsApiClient.formAndRelatedEntityOverview(formId);

  console.log(JSON.stringify(result, null, 2));
}

// Run the demo
demoFormOverview().catch(console.error);
