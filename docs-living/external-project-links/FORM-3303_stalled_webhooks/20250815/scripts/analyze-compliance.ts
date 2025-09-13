import * as fs from 'fs';
import * as path from 'path';

interface SubmissionReport {
  formId: string;
  submissionTime: string;
  referrer?: string;
  expectedSubmitActions: Array<{type: string, id: string}>;
  expectedSubmitActionsQueued: Array<{type: string, id: string}>;
  expectedSubmitActionsBlocking: Array<{type: string, id: string}>;
  actualSubmitActions: Array<{
    type: string, 
    id: string | null,
    runTime?: string,
    timeAfterSubmission?: number,
    isLikelyReRun?: boolean
  }>;
  systemSubmitActions?: Array<{
    type: string, 
    id: string | null,
    runTime?: string,
    timeAfterSubmission?: number,
    isLikelyReRun?: boolean
  }>;
}

function parseReportFilename(filename: string): {formId: string, startDate: string, endDate: string} | null {
  // Parse filename like: submitaction-2753595-202508150615-202508180715.json
  const match = filename.match(/submitaction-(\d+)-(\d{12})-(\d{12})\.json$/);
  
  if (!match) {
    return null;
  }
  
  const [, formId, startDateStr, endDateStr] = match;
  
  // Convert YYYYMMDDHHMM to readable format
  const formatDate = (dateStr: string) => {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    const hour = dateStr.substring(8, 10);
    const minute = dateStr.substring(10, 12);
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };
  
  return {
    formId,
    startDate: formatDate(startDateStr),
    endDate: formatDate(endDateStr)
  };
}

function analyzeCompliance(): void {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: npx ts-node analyze-compliance.ts <reportFile>');
    console.error('Example: npx ts-node analyze-compliance.ts 20250815/reports/submitaction-2753595-202508150615-202508180715.json');
    process.exit(1);
  }
  
  const reportFile = args[0];
  
  if (!fs.existsSync(reportFile)) {
    console.error(`Error: Report file not found: ${reportFile}`);
    process.exit(1);
  }
  
  try {
    const reportContent = fs.readFileSync(reportFile, 'utf-8');
    const reportData: Record<string, SubmissionReport> = JSON.parse(reportContent);
    
    // Parse filename for details
    const fileInfo = parseReportFilename(path.basename(reportFile));
    
    console.log('🔍 SUBMIT ACTION COMPLIANCE ANALYSIS');
    console.log('═══════════════════════════════════════');
    console.log(`📁 Report: ${path.basename(reportFile)}`);
    
    if (fileInfo) {
      console.log(`🆔 Form ID: ${fileInfo.formId}`);
      console.log(`📅 Period: ${fileInfo.startDate} → ${fileInfo.endDate}`);
    }
    
    console.log(`📊 Total Submissions: ${Object.keys(reportData).length}`);
    console.log('');
    
    // Track compliance by action type
    const configuredActionsMap = new Map<string, {expected: number, actual: number, compliant: number, reRuns: number, avgTime: number}>();
    const systemActionsMap = new Map<string, {actual: number, reRuns: number, avgTime: number}>();
    
    let salesforceExpectedCount = 0;
    let salesforceActualCount = 0;
    let salesforceCompliantCount = 0;
    let totalReRuns = 0;
    let totalActionsWithTiming = 0;
    let totalTimeAfterSubmission = 0;
    
    // Analyze each submission
    for (const [submissionId, submission] of Object.entries(reportData)) {
      // Get all expected action types (from all three expected arrays)
      const allExpectedTypes = new Set<string>();
      
      submission.expectedSubmitActions?.forEach(action => allExpectedTypes.add(action.type));
      submission.expectedSubmitActionsQueued?.forEach(action => allExpectedTypes.add(action.type));
      submission.expectedSubmitActionsBlocking?.forEach(action => allExpectedTypes.add(action.type));
      
      // Get all actual action types (from both actual and system actions)
      const actualTypes = new Set<string>();
      submission.actualSubmitActions?.forEach(action => actualTypes.add(action.type));
      submission.systemSubmitActions?.forEach(action => actualTypes.add(action.type));
      
      // Track each expected action type (configured actions)
      allExpectedTypes.forEach(expectedType => {
        if (!configuredActionsMap.has(expectedType)) {
          configuredActionsMap.set(expectedType, {expected: 0, actual: 0, compliant: 0, reRuns: 0, avgTime: 0});
        }
        
        const stats = configuredActionsMap.get(expectedType)!;
        stats.expected++;
        
        if (actualTypes.has(expectedType)) {
          stats.compliant++;
        }
      });
      
      // Track configured action executions
      submission.actualSubmitActions?.forEach(action => {
        const actionType = action.type;
        
        if (!configuredActionsMap.has(actionType)) {
          configuredActionsMap.set(actionType, {expected: 0, actual: 0, compliant: 0, reRuns: 0, avgTime: 0});
        }
        
        const stats = configuredActionsMap.get(actionType)!;
        stats.actual++;
        
        // Track re-runs
        if (action.isLikelyReRun) {
          stats.reRuns++;
          totalReRuns++;
        }
        
        // Track timing data
        if (action.timeAfterSubmission !== undefined && action.timeAfterSubmission > 0) {
          totalTimeAfterSubmission += action.timeAfterSubmission;
          totalActionsWithTiming++;
        }
      });
      
      // Track system action executions
      submission.systemSubmitActions?.forEach(action => {
        const actionType = action.type;
        
        if (!systemActionsMap.has(actionType)) {
          systemActionsMap.set(actionType, {actual: 0, reRuns: 0, avgTime: 0});
        }
        
        const stats = systemActionsMap.get(actionType)!;
        stats.actual++;
        
        // Track re-runs for system actions too
        if (action.isLikelyReRun) {
          stats.reRuns++;
          totalReRuns++;
        }
        
        // Track timing data for all actions
        if (action.timeAfterSubmission !== undefined && action.timeAfterSubmission > 0) {
          totalTimeAfterSubmission += action.timeAfterSubmission;
          totalActionsWithTiming++;
        }
      });
      
      // Special tracking for Salesforce
      if (allExpectedTypes.has('salesforce')) {
        salesforceExpectedCount++;
        if (actualTypes.has('salesforce')) {
          salesforceActualCount++;
          salesforceCompliantCount++;
        }
      }
    }
    
    // Display configured actions compliance (only show actions that are actually expected)
    console.log('📈 CONFIGURED SUBMIT ACTIONS (Integration Compliance):');
    console.log('─────────────────────────────────────────────────────');
    
    const sortedConfiguredTypes = Array.from(configuredActionsMap.keys())
      .filter(actionType => configuredActionsMap.get(actionType)!.expected > 0) // Only show if actually expected
      .sort();
    
    if (sortedConfiguredTypes.length === 0) {
      console.log('   No configured submit actions found in this report.');
      console.log('');
    } else {
      for (const actionType of sortedConfiguredTypes) {
        const stats = configuredActionsMap.get(actionType)!;
        const complianceRate = Math.round((stats.compliant / stats.expected) * 100);
        const status = complianceRate === 100 ? '✅' : complianceRate === 0 ? '❌' : '⚠️';
        const reRunStatus = stats.reRuns > 0 ? '🔄' : '';
        
        console.log(`${status}${reRunStatus} ${actionType.toUpperCase()} (Configured Integration):`);
        console.log(`   Expected: ${stats.expected} submissions`);
        console.log(`   Actually ran: ${stats.compliant} submissions`);
        console.log(`   Likely re-runs: ${stats.reRuns}`);
        console.log(`   Compliance rate: ${complianceRate}%`);
        console.log('');
      }
    }
    
    // Display system actions
    console.log('🔧 SYSTEM SUBMIT ACTIONS (Automatic Behavior):');
    console.log('──────────────────────────────────────────────');
    
    const sortedSystemTypes = Array.from(systemActionsMap.keys()).sort();
    
    for (const actionType of sortedSystemTypes) {
      const stats = systemActionsMap.get(actionType)!;
      const reRunStatus = stats.reRuns > 0 ? '🔄' : '';
      
      console.log(`✅${reRunStatus} ${actionType.toUpperCase()} (System Action):`);
      console.log(`   Executions: ${stats.actual} (runs automatically)`);
      console.log(`   Likely re-runs: ${stats.reRuns}`);
      console.log(`   Status: Working as expected (system action)`);
      console.log('');
    }
    
    // Overall timing statistics
    console.log('⏱️ TIMING ANALYSIS:');
    console.log('──────────────────');
    console.log(`📊 Total submit action executions: ${totalActionsWithTiming}`);
    console.log(`🔄 Total likely re-runs: ${totalReRuns}`);
    if (totalActionsWithTiming > 0) {
      const avgSeconds = totalTimeAfterSubmission / totalActionsWithTiming;
      console.log(`⏰ Average time after submission: ${Math.round(avgSeconds * 100) / 100} seconds`);
      console.log(`📈 Re-run rate: ${Math.round((totalReRuns / totalActionsWithTiming) * 100)}%`);
    }
    console.log('');
    
    // Special focus on Salesforce
    console.log('🎯 SALESFORCE DETAILED ANALYSIS:');
    console.log('──────────────────────────────────');
    console.log(`📋 Submissions expecting Salesforce: ${salesforceExpectedCount}`);
    console.log(`✅ Submissions where Salesforce ran: ${salesforceCompliantCount}`);
    console.log(`❌ Submissions where Salesforce failed: ${salesforceExpectedCount - salesforceCompliantCount}`);
    console.log(`📊 Salesforce success rate: ${salesforceExpectedCount > 0 ? Math.round((salesforceCompliantCount / salesforceExpectedCount) * 100) : 0}%`);
    
    if (salesforceExpectedCount > 0 && salesforceCompliantCount === 0) {
      console.log('');
      console.log('🚨 CRITICAL ISSUE: All Salesforce submit actions are failing!');
      console.log('   This suggests a systematic problem with Salesforce integration.');
    }
    
  } catch (error: any) {
    console.error('Error analyzing report:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  analyzeCompliance();
}
