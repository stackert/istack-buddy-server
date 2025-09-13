import * as fs from 'fs';
import * as path from 'path';

interface LogContext {
  submissionId?: number | string;
}

interface LogData {
  context?: LogContext;
}

function parseCSVAndExtractSubmissions(filePath: string): Set<string> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() !== '');
  
  if (lines.length === 0) return new Set();
  
  const uniqueSubmissions = new Set<string>();
  
  // Process each data row (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    try {
      // Find the JSON part - it's the last quoted section in each line
      // Look for the pattern: ,"{ ... }"
      const match = line.match(/,"(\{.*\})"/);
      if (match) {
        // Unescape the double quotes in the JSON
        const jsonString = match[1].replace(/""/g, '"');
        const logData: LogData = JSON.parse(jsonString);
        
        const submissionId = logData.context?.submissionId;
        if (submissionId !== undefined && submissionId !== null) {
          uniqueSubmissions.add(String(submissionId));
        }
      }
    } catch (error) {
      // Skip rows with invalid JSON - silently continue
    }
  }
  
  return uniqueSubmissions;
}

function countUniqueSubmissionsInFile(filePath: string): number {
  try {
    console.log(`\nProcessing: ${path.basename(filePath)}`);
    
    const uniqueSubmissions = parseCSVAndExtractSubmissions(filePath);
    console.log(`  Unique submissions: ${uniqueSubmissions.size}`);
    
    return uniqueSubmissions.size;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return 0;
  }
}

function main() {
  const artifactsDir = path.join(__dirname, '..', 'artifacts');
  
  const files = [
    path.join(artifactsDir, 'actual-pardot.csv'),
    path.join(artifactsDir, 'actual-salesforce.csv'), 
    path.join(artifactsDir, 'expected-all-submitAction.csv')
  ];
  
  console.log('='.repeat(50));
  console.log('UNIQUE SUBMISSION COUNT ANALYSIS');
  console.log('='.repeat(50));
  
  const results: { [filename: string]: number } = {};
  
  for (const file of files) {
    const filename = path.basename(file);
    
    if (!fs.existsSync(file)) {
      console.log(`\n❌ File not found: ${filename}`);
      results[filename] = 0;
      continue;
    }
    
    results[filename] = countUniqueSubmissionsInFile(file);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  
  for (const [filename, count] of Object.entries(results)) {
    console.log(`${filename.padEnd(30)} ${count} unique submissions`);
  }
  
  console.log('='.repeat(50));
}

if (require.main === module) {
  main();
}
