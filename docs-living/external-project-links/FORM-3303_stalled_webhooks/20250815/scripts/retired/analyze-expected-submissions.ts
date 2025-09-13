import * as fs from 'fs';
import * as path from 'path';

interface LogContext {
  submissionId?: number | string;
}

interface LogData {
  context?: LogContext;
}

interface SubmissionData {
  submissionId: string;
  submissionTime: string;
  hasPardot: boolean;
  hasSalesforce: boolean;
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
      // Extract the JSON part using regex - it's the last quoted section in each line
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

function parseExpectedSubmissions(filePath: string): SubmissionData[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) return [];
  
  const submissions: SubmissionData[] = [];
  const processedSubmissions = new Set<string>(); // Track unique submissions
  
  // Process each data row (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    try {
      // Extract the JSON part using regex - it's the last quoted section in each line
      const match = line.match(/,"(\{.*\})"/);
      if (match) {
        // Also extract the other columns we need
        const parts = line.split(',');
        if (parts.length >= 5) {
          const messagetime = parts[1].replace(/^"|"$/g, ''); // _messagetime
          const queuedIntegrationType = parts[2].replace(/^"|"$/g, ''); // queuedIntegrationType
          const blockingIntegrationType = parts[3].replace(/^"|"$/g, ''); // blockingIntegrationType
          
          // Unescape the double quotes in the JSON
          const jsonString = match[1].replace(/""/g, '"');
          const logData: LogData = JSON.parse(jsonString);
          
          const submissionId = logData.context?.submissionId;
          if (submissionId !== undefined && submissionId !== null) {
            const submissionIdStr = String(submissionId);
            
            // Only process each submission once (take the first occurrence)
            if (!processedSubmissions.has(submissionIdStr)) {
              processedSubmissions.add(submissionIdStr);
              
              // Check if pardot and salesforce are present
              const hasPardot = queuedIntegrationType === 'pardot' || blockingIntegrationType === 'pardot';
              const hasSalesforce = queuedIntegrationType === 'salesforce' || blockingIntegrationType === 'salesforce';
              
              submissions.push({
                submissionId: submissionIdStr,
                submissionTime: messagetime,
                hasPardot,
                hasSalesforce
              });
            }
          }
        }
      }
    } catch (error) {
      // Skip rows with invalid data - silently continue
    }
  }
  
  return submissions;
}

function main() {
  const expectedFile = path.join(__dirname, '..', 'artifacts', 'expected-all-submitAction.csv');
  const actualPardotFile = path.join(__dirname, '..', 'artifacts', 'actual-pardot.csv');
  const actualSalesforceFile = path.join(__dirname, '..', 'artifacts', 'actual-salesforce.csv');
  
  if (!fs.existsSync(expectedFile)) {
    console.error(`File not found: ${expectedFile}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(actualPardotFile)) {
    console.error(`File not found: ${actualPardotFile}`);
    process.exit(1);
  }
  
  if (!fs.existsSync(actualSalesforceFile)) {
    console.error(`File not found: ${actualSalesforceFile}`);
    process.exit(1);
  }
  
  console.log('submissionId\tsubmissionTime\tpardot\tsalesforce');
  
  try {
    // Load actual submissions that ran
    const actualPardotSubmissions = parseActualSubmissions(actualPardotFile);
    const actualSalesforceSubmissions = parseActualSubmissions(actualSalesforceFile);
    
    // Load expected submissions
    const submissions = parseExpectedSubmissions(expectedFile);
    
    // Sort by submissionId for consistent output
    submissions.sort((a, b) => parseInt(a.submissionId) - parseInt(b.submissionId));
    
    for (const submission of submissions) {
      // Check if expected integrations actually ran
      let pardotStatus = 'N/A';
      let salesforceStatus = 'N/A';
      
      if (submission.hasPardot) {
        pardotStatus = actualPardotSubmissions.has(submission.submissionId) ? 'pardot=found' : 'pardot=missing';
      }
      
      if (submission.hasSalesforce) {
        salesforceStatus = actualSalesforceSubmissions.has(submission.submissionId) ? 'salesforce=found' : 'salesforce=missing';
      }
      
      console.log(`${submission.submissionId}\t${submission.submissionTime}\t${pardotStatus}\t${salesforceStatus}`);
    }
    
    console.error(`\nProcessed ${submissions.length} unique submissions`);
    console.error(`Actual pardot submissions found: ${actualPardotSubmissions.size}`);
    console.error(`Actual salesforce submissions found: ${actualSalesforceSubmissions.size}`);
    
  } catch (error) {
    console.error('Error processing file:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
