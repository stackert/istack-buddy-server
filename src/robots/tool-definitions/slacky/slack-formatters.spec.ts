// Mock ObservationMakerViewer internals so we control outputs
jest.mock('./ObservationMakerViewer', () => ({
  ObservationMakerViewer: class {
    static fromObservationResults = jest.fn().mockReturnValue({
      getSummary: () => 'summary',
      formatForSlack: () => 'formatted',
      getObservationClassName: () => 'ObservationMakerViewer',
    });
  },
}));

const formatters = require('./slack-formatters');
const {
  slackyToolResultFormatter,
  formatValidationResult,
  formatFormOverviewResult,
  formatSumoQueryResult,
  formatSsoResult,
  formatGenericResult,
} = formatters;
const { ObservationMakerViewer } = require('./ObservationMakerViewer');

describe('slack-formatters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('slackyToolResultFormatter routes to specific formatters and handles errors', () => {
    expect(
      slackyToolResultFormatter(
        'fsRestrictedApiFormCalculationValidation',
        {} as any,
      ),
    ).toContain('Calculation Validation');
    expect(
      slackyToolResultFormatter(
        'fsRestrictedApiFormLogicValidation',
        {} as any,
      ),
    ).toContain('Logic Validation');
    expect(
      slackyToolResultFormatter('fsRestrictedApiFormAndRelatedEntityOverview', {
        response: {},
      }),
    ).toContain('Form Overview');
    expect(slackyToolResultFormatter('sumoLogicQuery', 'ok')).toContain(
      'Sumo Logic',
    );
    expect(slackyToolResultFormatter('ssoAutoFillAssistance', 'ok')).toContain(
      'SSO Auto-fill',
    );
    expect(slackyToolResultFormatter('unknownFn', { a: 1 })).toContain(
      'unknownFn',
    );

    // error path: make viewer throw inside validation formatter
    const viewerSpy = jest
      .spyOn(ObservationMakerViewer as any, 'fromObservationResults')
      .mockImplementation(() => {
        throw new Error('boom');
      });
    const res = slackyToolResultFormatter(
      'fsRestrictedApiFormCalculationValidation',
      { response: {} },
    );
    expect(res).toContain('Error formatting result');
    viewerSpy.mockRestore();
  });

  it('formatValidationResult builds validation text and uses viewer outputs', () => {
    // Ensure the viewer returns the expected stub
    jest
      .spyOn(ObservationMakerViewer as any, 'fromObservationResults')
      .mockReturnValue({
        getSummary: () => 'summary',
        formatForSlack: () => 'formatted',
        getObservationClassName: () => 'ObservationMakerViewer',
      });
    const text = formatValidationResult(
      'fsRestrictedApiFormCalculationValidation',
      { response: {} },
    );
    expect(text).toContain('Calculation Validation');
    expect(text).toContain('summary');
    expect(text).toContain('formatted');

    const logicText = formatValidationResult(
      'fsRestrictedApiFormLogicValidation',
      { response: {} },
    );
    expect(logicText).toContain('Logic Validation');
  });

  it('formatFormOverviewResult handles missing response', () => {
    expect(formatFormOverviewResult(undefined as any)).toContain(
      'No data received',
    );
  });

  it('formatFormOverviewResult formats core fields and lists', () => {
    const text = formatFormOverviewResult({
      response: {
        formId: 'F1',
        url: 'https://example.com',
        version: 'v2',
        submissions: 1234,
        submissionsToday: 12,
        fieldCount: 8,
        isActive: true,
        encrypted: false,
        timezone: 'UTC',
        isOneQuestionAtATime: false,
        hasApprovers: true,
        isWorkflowForm: false,
        submitActions: [{ id: 'a1', name: 'Save' }],
        notificationEmails: [{ id: 'n1' }],
        confirmationEmails: [{ email: 'user@example.com' }],
      },
    });
    expect(text).toContain('Form Overview');
    expect(text).toContain('Form ID');
    expect(text).toContain('Submit Actions');
    expect(text).toContain('Notification Emails');
    expect(text).toContain('Confirmation Emails');
  });

  it('formatSumoQueryResult validates input', () => {
    expect(formatSumoQueryResult('data')).toContain('Sumo Logic');
    expect(formatSumoQueryResult(undefined as any)).toContain(
      'Invalid result format',
    );
  });

  it('formatSsoResult validates input', () => {
    expect(formatSsoResult('data')).toContain('SSO Auto-fill');
    expect(formatSsoResult(undefined as any)).toContain(
      'Invalid result format',
    );
  });

  it('formatGenericResult stringifies objects', () => {
    const text = formatGenericResult('myFn', { a: 1 });
    expect(text).toContain('myFn');
    expect(text).toContain('"a": 1');
  });
});
