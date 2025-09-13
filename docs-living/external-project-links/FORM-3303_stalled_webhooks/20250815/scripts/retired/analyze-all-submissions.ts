import * as fs from 'fs';
import * as path from 'path';

interface LogContext {
  submissionId?: number | string;
}

interface LogData {
  context?: LogContext;
}

interface SubmissionRecord {
  submissionId: string;
  submissionDate: string;
}

interface ExpectedSubmission {
  submissionId: string;
  expectedTypes: string[];
}

function parseAllSubmissions(filePath: string): SubmissionRecord[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) return [];
  
  const submissions: SubmissionRecord[] = [];
  
  // Process each data row (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    try {
      // Extract the JSON part using regex - it's the last quoted section in each line
      const match = line.match(/,"(\{.*\})"/);
      if (match) {
        // Also extract the submission date from the _messagetime column
        const parts = line.split(',');
        if (parts.length >= 4) {
          const submissionDate = parts[1].replace(/^"|"$/g, ''); // _messagetime
          
          // Unescape the double quotes in the JSON
          const jsonString = match[1].replace(/""/g, '"');
          const logData: LogData = JSON.parse(jsonString);
          
          const submissionId = logData.context?.submissionId;
          if (submissionId !== undefined && submissionId !== null) {
            submissions.push({
              submissionId: String(submissionId),
              submissionDate
            });
          }
        }
      }
    } catch (error) {
      // Skip rows with invalid data - silently continue
    }
  }
  
  return submissions;
}

function parseExpectedSubmissions(filePath: string): Map<string, string[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) return new Map();
  
  const expectedMap = new Map<string, Set<string>>();
  
  // Process each data row (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    try {
      // Extract the JSON part using regex
      const match = line.match(/,"(\{.*\})"/);
      if (match) {
        // Extract integration type columns
        const parts = line.split(',');
        if (parts.length >= 5) {
          const queuedIntegrationType = parts[2].replace(/^"|"$/g, '');
          const blockingIntegrationType = parts[3].replace(/^"|"$/g, '');
          
          // Unescape the double quotes in the JSON
          const jsonString = match[1].replace(/""/g, '"');
          const logData: LogData = JSON.parse(jsonString);
          
          const submissionId = logData.context?.submissionId;
          if (submissionId !== undefined && submissionId !== null) {
            const submissionIdStr = String(submissionId);
            
            if (!expectedMap.has(submissionIdStr)) {
              expectedMap.set(submissionIdStr, new Set<string>());
            }
            
            const types = expectedMap.get(submissionIdStr)!;
            
            // Add integration types
            if (queuedIntegrationType && queuedIntegrationType !== '') {
              types.add(queuedIntegrationType);
            }
            if (blockingIntegrationType && blockingIntegrationType !== '') {
              types.add(blockingIntegrationType);
            }
          }
        }
      }
    } catch (error) {
      // Skip rows with invalid data - silently continue
    }
  }
  
  // Convert Sets to sorted arrays
  const result = new Map<string, string[]>();
  for (const [submissionId, typesSet] of expectedMap) {
    result.set(submissionId, Array.from(typesSet).sort());
  }
  
  return result;
}

function parseActualSubmissions(filePath: string): Set<string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) return new Set();
  
  const submissionIds = new Set<string>();
  
  // Process each data row (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    try {
      // Extract the JSON part using regex
      const match = line.match(/,"(\{.*\})"/);
      if (match) {
        // Unescape the double quotes in the JSON
        const jsonString = match[1].replace(/""/g, '"');
        const logData: LogData = JSON.parse(jsonString);
        
        const submissionId = logData.context?.submissionId;
        if (submissionId !== undefined && submissionId !== null) {
          submissionIds.add(String(submissionId));
        }
      }
    } catch (error) {
      // Skip rows with invalid data - silently continue
    }
  }
  
  return submissionIds;
}

function main() {
  const allSubmissionsFile = path.join(__dirname, '..', 'artifacts', 'all-submission.csv');
  const expectedFile = path.join(__dirname, '..', 'artifacts', 'expected-all-submitAction.csv');
  const actualPardotFile = path.join(__dirname, '..', 'artifacts', 'actual-pardot.csv');
  const actualSalesforceFile = path.join(__dirname, '..', 'artifacts', 'actual-salesforce.csv');
  
  // Check if all required files exist
  const requiredFiles = [allSubmissionsFile, expectedFile, actualPardotFile, actualSalesforceFile];
  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      console.error(`File not found: ${file}`);
      process.exit(1);
    }
  }
  
  try {
    // Load all data
    const allSubmissions = parseAllSubmissions(allSubmissionsFile);
    const expectedSubmissions = parseExpectedSubmissions(expectedFile);
    const actualPardotSubmissions = parseActualSubmissions(actualPardotFile);
    const actualSalesforceSubmissions = parseActualSubmissions(actualSalesforceFile);
    
    // Sort submissions by submissionId for consistent output
    allSubmissions.sort((a, b) => parseInt(a.submissionId) - parseInt(b.submissionId));
    
    // Process each submission
    for (const submission of allSubmissions) {
      const expectedTypes = expectedSubmissions.get(submission.submissionId);
      
      if (!expectedTypes || expectedTypes.length === 0) {
        // No submit action expected
        console.log(`${submission.submissionId}\t${submission.submissionDate}\tno submit action expected`);
      } else {
        // Process expected types and check if they actually ran
        const typeStatuses: string[] = [];
        
        for (const type of expectedTypes) {
          let status = type;
          
          if (type === 'pardot') {
            status = actualPardotSubmissions.has(submission.submissionId) ? 'pardot=found' : 'pardot=missing';
          } else if (type === 'salesforce') {
            status = actualSalesforceSubmissions.has(submission.submissionId) ? 'salesforce=found' : 'salesforce=missing';
          }
          
          typeStatuses.push(status);
        }
        
        console.log(`${submission.submissionId}\t${submission.submissionDate}\t${typeStatuses.join('\t')}`);
      }
    }
    
    console.error(`\nProcessed ${allSubmissions.length} total submissions`);
    console.error(`Expected submissions found: ${expectedSubmissions.size}`);
    console.error(`Actual pardot submissions found: ${actualPardotSubmissions.size}`);
    console.error(`Actual salesforce submissions found: ${actualSalesforceSubmissions.size}`);
    
  } catch (error) {
    console.error('Error processing files:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
