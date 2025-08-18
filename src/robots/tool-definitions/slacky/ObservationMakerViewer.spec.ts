import { ObservationMakerViewer } from './ObservationMakerViewer';

// Mock istack-buddy-utilities base classes/enums used by ObservationMakerViewer
jest.mock(
  'istack-buddy-utilities',
  () => ({
    ObservationMakers: { AbstractObservationMaker: class {} },
    EObservationSubjectType: { FORM: 'FORM' },
  }),
  { virtual: true },
);

describe('ObservationMakerViewer', () => {
  const buildLogItem = (overrides: Partial<any> = {}) => ({
    logLevel: 'info',
    messageSecondary: 'Short message',
    subjectId: 'subj-1',
    ...overrides,
  });

  it('fromObservationResults extracts logItems from response.logItems', () => {
    const input = {
      response: {
        logItems: [
          buildLogItem({ logLevel: 'warn' }),
          buildLogItem({ logLevel: 'error' }),
        ],
      },
    };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.getAllLogItems()).toHaveLength(2);
    expect(viewer.getWarningsAndErrors()).toHaveLength(2);
  });

  it('fromObservationResults extracts from array response', () => {
    const input = { response: [buildLogItem(), buildLogItem()] };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.getAllLogItems()).toHaveLength(2);
  });

  it('fromObservationResults extracts from response.observations', () => {
    const input = { response: { observations: [buildLogItem()] } };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.getAllLogItems()).toHaveLength(1);
  });

  it('fromObservationResults extracts from response.data', () => {
    const input = { response: { data: [buildLogItem(), buildLogItem()] } };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.getAllLogItems()).toHaveLength(2);
  });

  it('fromObservationResults handles single object response', () => {
    const input = { response: buildLogItem() };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.getAllLogItems()).toHaveLength(1);
  });

  it('formatForSlack returns no-issues message when no warnings or errors', () => {
    const input = {
      response: [
        buildLogItem({ logLevel: 'info' }),
        buildLogItem({ logLevel: 'debug' }),
      ],
    };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.formatForSlack()).toContain('No issues found');
  });

  it('formatForSlack lists warnings and errors with truncation', () => {
    const longMsg = 'x'.repeat(200);
    const input = {
      response: [
        buildLogItem({
          logLevel: 'warn',
          messageSecondary: longMsg,
          subjectId: 'subj-2',
        }),
        buildLogItem({
          logLevel: 'error',
          messageSecondary: 'short',
          subjectId: 'subj-3',
        }),
      ],
    };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    const formatted = viewer.formatForSlack();
    expect(formatted).toContain('Found 2 issue(s)');
    expect(formatted).toContain('WARNING');
    expect(formatted).toContain('ERROR');
    // truncated long message ends with ellipsis
    expect(formatted).toMatch(/\.\.\.$/m);
    // includes subject ids
    expect(formatted).toContain('`subj-2`');
    expect(formatted).toContain('`subj-3`');
  });

  it('formatAllForSlack lists all items with appropriate emojis', () => {
    const input = {
      response: [
        buildLogItem({ logLevel: 'debug' }),
        buildLogItem({ logLevel: 'info' }),
        buildLogItem({ logLevel: 'warn' }),
        buildLogItem({ logLevel: 'error' }),
      ],
    };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    const formatted = viewer.formatAllForSlack();
    expect(formatted).toContain('All Log Items (4 total)');
    expect(formatted).toContain('🔍 *DEBUG*');
    expect(formatted).toContain('ℹ️ *INFO*');
    expect(formatted).toContain('⚠️ *WARN*');
    expect(formatted).toContain('❌ *ERROR*');
  });

  it('getSummary counts levels accurately', () => {
    const input = {
      response: [
        buildLogItem({ logLevel: 'debug' }),
        buildLogItem({ logLevel: 'info' }),
        buildLogItem({ logLevel: 'warn' }),
        buildLogItem({ logLevel: 'error' }),
        buildLogItem({ logLevel: 'error' }),
      ],
    };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    const summary = viewer.getSummary();
    expect(summary).toContain('5 total');
    expect(summary).toContain('2 errors');
    expect(summary).toContain('1 warnings');
    expect(summary).toContain('1 info');
    expect(summary).toContain('1 debug');
  });

  it('getLogItemsByLevel filters by level', () => {
    const input = {
      response: [
        buildLogItem({ logLevel: 'info' }),
        buildLogItem({ logLevel: 'warn' }),
      ],
    };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    expect(viewer.getLogItemsByLevel('info')).toHaveLength(1);
    expect(viewer.getLogItemsByLevel('warn')).toHaveLength(1);
  });

  it('makeObservation returns isObservationTrue and current logItems', async () => {
    const input = { response: [buildLogItem(), buildLogItem()] };
    const viewer = ObservationMakerViewer.fromObservationResults(input);
    const result = await viewer.makeObservation({} as any);
    expect(result.isObservationTrue).toBe(true);
    expect(result.logItems).toHaveLength(2);
  });

  it('getObservationClassName returns class name', () => {
    const viewer = new ObservationMakerViewer();
    expect(viewer.getObservationClassName()).toBe('ObservationMakerViewer');
  });
});
