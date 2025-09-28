import { Test, TestingModule } from '@nestjs/testing';
import { ObservationMakerSumoReport } from './ObservationMakerSumoQuery';

// Import actual mock data from the JSON files
const mockSumoQueryDataLarge = require('../../test-data/mock-servers/fake-responses/fake-sumo-submissin-report-large.json');
const mockSumoQueryDataSmall = require('../../test-data/mock-servers/fake-responses/fake-sumo-submissin-report-small.json');

describe('ObservationMakerSumoReport', () => {
  let observationMaker: ObservationMakerSumoReport;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ObservationMakerSumoReport],
    }).compile();

    observationMaker = module.get<ObservationMakerSumoReport>(
      ObservationMakerSumoReport,
    );
  });

  describe('Sumo Report Analysis', () => {
    it('should generate accurate metrics that match the actual data in the large report file', async () => {
      const context = {
        resources: {
          sumoNamedQuery: mockSumoQueryDataLarge,
        },
      };

      const result = await observationMaker.makeObservation(context);

      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);

      // Calculate expected values from the actual mock data
      const expectedRecordCount = mockSumoQueryDataLarge.records.length;
      const uniqueIps = new Set(
        mockSumoQueryDataLarge.records
          .map((r: any) => r.ip)
          .filter((ip: any) => ip && ip.trim() !== ''),
      );
      const expectedUniqueIpCount = uniqueIps.size;
      const partialSubmissions = mockSumoQueryDataLarge.records.filter(
        (r: any) => r.isPartialSubmission === true,
      ).length;
      const completeSubmissions = mockSumoQueryDataLarge.records.filter(
        (r: any) => r.isPartialSubmission === false,
      ).length;
      const uniqueReferrers = new Set(
        mockSumoQueryDataLarge.records
          .map((r: any) => r.referrer)
          .filter((ref: any) => ref && ref.trim() !== ''),
      );
      const expectedUniqueReferrerCount = uniqueReferrers.size;
      const submissionMethods = new Map();
      mockSumoQueryDataLarge.records.forEach((r: any) => {
        if (r.submissionMethod) {
          submissionMethods.set(
            r.submissionMethod,
            (submissionMethods.get(r.submissionMethod) || 0) + 1,
          );
        }
      });

      // Verify record count
      const recordCountItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Number of records (submissions)'),
      );
      expect(recordCountItems.length).toBe(1);
      expect(recordCountItems[0].messageSecondary).toBe(
        `Number of records (submissions): ${expectedRecordCount}`,
      );
      expect(recordCountItems[0].subjectId).toBe(
        mockSumoQueryDataLarge.queryName,
      );

      // Verify unique IP count
      const uniqueIpItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Number of unique IP addresses'),
      );
      expect(uniqueIpItems.length).toBe(1);
      expect(uniqueIpItems[0].messageSecondary).toBe(
        `Number of unique IP addresses: ${expectedUniqueIpCount}`,
      );
      expect(uniqueIpItems[0].subjectId).toBe(
        `${mockSumoQueryDataLarge.queryName}:line-item`,
      );

      // Verify partial submissions count
      const partialSubmissionItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Partial submissions'),
      );
      expect(partialSubmissionItems.length).toBe(1);
      const expectedPartialPercentage =
        expectedRecordCount > 0
          ? ((partialSubmissions / expectedRecordCount) * 100).toFixed(1)
          : '0';
      expect(partialSubmissionItems[0].messageSecondary).toBe(
        `Partial submissions: ${partialSubmissions} (${expectedPartialPercentage}%), Complete submissions: ${completeSubmissions}`,
      );
      expect(partialSubmissionItems[0].subjectId).toBe(
        `${mockSumoQueryDataLarge.queryName}:line-item`,
      );

      // Verify unique referrers count
      const uniqueReferrerItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Number of unique referrers'),
      );
      expect(uniqueReferrerItems.length).toBe(1);
      expect(uniqueReferrerItems[0].messageSecondary).toBe(
        `Number of unique referrers: ${expectedUniqueReferrerCount}`,
      );
      expect(uniqueReferrerItems[0].subjectId).toBe(
        `${mockSumoQueryDataLarge.queryName}:line-item`,
      );

      // Verify submission methods
      const submissionMethodItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Submission methods'),
      );
      expect(submissionMethodItems.length).toBe(1);
      const expectedMethodCounts = Array.from(submissionMethods.entries())
        .map(([method, count]) => `${method}: ${count}`)
        .join(', ');
      expect(submissionMethodItems[0].messageSecondary).toBe(
        `Submission methods - ${expectedMethodCounts}`,
      );
      expect(submissionMethodItems[0].subjectId).toBe(
        `${mockSumoQueryDataLarge.queryName}:line-item`,
      );

      // Verify query metadata
      const metadataItems = result.logItems.filter((item) =>
        item.messageSecondary.includes(
          `Query '${mockSumoQueryDataLarge.queryName}'`,
        ),
      );
      expect(metadataItems.length).toBe(1);
      expect(metadataItems[0].messageSecondary).toBe(
        `Query '${mockSumoQueryDataLarge.queryName}' returned ${mockSumoQueryDataLarge.messageCount} total records from Sumo Logic`,
      );
      expect(metadataItems[0].subjectId).toBe(mockSumoQueryDataLarge.queryName);

      // Verify all subjectIds use the query name (no fallbacks allowed)
      result.logItems.forEach((logItem) => {
        expect(logItem.subjectId).toMatch(
          /^submissionCreatedForForm(:line-item)?$/,
        );
      });
    });

    it('should generate accurate metrics that match the actual data in the small report file', async () => {
      const context = {
        resources: {
          sumoNamedQuery: mockSumoQueryDataSmall,
        },
      };

      const result = await observationMaker.makeObservation(context);

      expect(result.isObservationTrue).toBe(true);
      expect(Array.isArray(result.logItems)).toBe(true);

      // Calculate expected values from the small mock data
      const expectedRecordCount = mockSumoQueryDataSmall.records.length;
      const uniqueIps = new Set(
        mockSumoQueryDataSmall.records
          .map((r: any) => r.ip)
          .filter((ip: any) => ip && ip.trim() !== ''),
      );
      const expectedUniqueIpCount = uniqueIps.size;
      const partialSubmissions = mockSumoQueryDataSmall.records.filter(
        (r: any) => r.isPartialSubmission === true,
      ).length;
      const completeSubmissions = mockSumoQueryDataSmall.records.filter(
        (r: any) => r.isPartialSubmission === false,
      ).length;
      const uniqueReferrers = new Set(
        mockSumoQueryDataSmall.records
          .map((r: any) => r.referrer)
          .filter((ref: any) => ref && ref.trim() !== ''),
      );
      const expectedUniqueReferrerCount = uniqueReferrers.size;
      const submissionMethods = new Map();
      mockSumoQueryDataSmall.records.forEach((r: any) => {
        if (r.submissionMethod) {
          submissionMethods.set(
            r.submissionMethod,
            (submissionMethods.get(r.submissionMethod) || 0) + 1,
          );
        }
      });

      // Verify record count
      const recordCountItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Number of records (submissions)'),
      );
      expect(recordCountItems.length).toBe(1);
      expect(recordCountItems[0].messageSecondary).toBe(
        `Number of records (submissions): ${expectedRecordCount}`,
      );
      expect(recordCountItems[0].subjectId).toBe(
        mockSumoQueryDataSmall.queryName,
      );

      // Verify unique IP count
      const uniqueIpItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Number of unique IP addresses'),
      );
      expect(uniqueIpItems.length).toBe(1);
      expect(uniqueIpItems[0].messageSecondary).toBe(
        `Number of unique IP addresses: ${expectedUniqueIpCount}`,
      );
      expect(uniqueIpItems[0].subjectId).toBe(
        `${mockSumoQueryDataSmall.queryName}:line-item`,
      );

      // Verify partial submissions count
      const partialSubmissionItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Partial submissions'),
      );
      expect(partialSubmissionItems.length).toBe(1);
      const expectedPartialPercentage =
        expectedRecordCount > 0
          ? ((partialSubmissions / expectedRecordCount) * 100).toFixed(1)
          : '0';
      expect(partialSubmissionItems[0].messageSecondary).toBe(
        `Partial submissions: ${partialSubmissions} (${expectedPartialPercentage}%), Complete submissions: ${completeSubmissions}`,
      );
      expect(partialSubmissionItems[0].subjectId).toBe(
        `${mockSumoQueryDataSmall.queryName}:line-item`,
      );

      // Verify unique referrers count
      const uniqueReferrerItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Number of unique referrers'),
      );
      expect(uniqueReferrerItems.length).toBe(1);
      expect(uniqueReferrerItems[0].messageSecondary).toBe(
        `Number of unique referrers: ${expectedUniqueReferrerCount}`,
      );
      expect(uniqueReferrerItems[0].subjectId).toBe(
        `${mockSumoQueryDataSmall.queryName}:line-item`,
      );

      // Verify submission methods
      const submissionMethodItems = result.logItems.filter((item) =>
        item.messageSecondary.includes('Submission methods'),
      );
      expect(submissionMethodItems.length).toBe(1);
      const expectedMethodCounts = Array.from(submissionMethods.entries())
        .map(([method, count]) => `${method}: ${count}`)
        .join(', ');
      expect(submissionMethodItems[0].messageSecondary).toBe(
        `Submission methods - ${expectedMethodCounts}`,
      );
      expect(submissionMethodItems[0].subjectId).toBe(
        `${mockSumoQueryDataSmall.queryName}:line-item`,
      );

      // Verify query metadata
      const metadataItems = result.logItems.filter((item) =>
        item.messageSecondary.includes(
          `Query '${mockSumoQueryDataSmall.queryName}'`,
        ),
      );
      expect(metadataItems.length).toBe(1);
      expect(metadataItems[0].messageSecondary).toBe(
        `Query '${mockSumoQueryDataSmall.queryName}' returned ${mockSumoQueryDataSmall.messageCount} total records from Sumo Logic`,
      );
      expect(metadataItems[0].subjectId).toBe(mockSumoQueryDataSmall.queryName);

      // Verify all subjectIds use the query name (no fallbacks allowed)
      result.logItems.forEach((logItem) => {
        expect(logItem.subjectId).toMatch(
          /^submissionCreatedForForm(:line-item)?$/,
        );
      });
    });
  });
});
