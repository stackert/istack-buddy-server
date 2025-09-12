const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for mock data
const jobs = new Map();
const files = new Map();
let jobIdCounter = 1;
let fileIdCounter = 1;

// Helper function to load sample results based on query name
function getSampleResults(queryName) {
  let fileName;

  switch (queryName) {
    case 'submitActionReport':
      fileName = 'fake-sumo-submit-action-report-form-5894350.json';
      break;
    case 'submissionCreatedForForm':
    default:
      fileName = 'fake-sumo-submissin-report-large.json';
      break;
  }

  const fakeResponsePath = path.join(__dirname, 'fake-responses', fileName);
  return JSON.parse(fs.readFileSync(fakeResponsePath, 'utf8'));
}

// Helper function to generate job IDs
function generateJobId() {
  return `job_${jobIdCounter++}`;
}

// Helper function to generate file IDs
function generateFileId() {
  return `file_${fileIdCounter++}`;
}

// Helper function to simulate processing delay
function simulateDelay(ms = 1000) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /information-services/context-sumo-report/query/submit
app.post(
  '/information-services/context-sumo-report/query/submit',
  async (req, res) => {
    console.log('📥 Received job submission:', req.body);

    const jobId = generateJobId();
    const job = {
      jobId,
      queryName: req.body.queryName || 'submissionCreatedForForm',
      subject: req.body.subject || {},
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    jobs.set(jobId, job);

    // Simulate job progression in background
    setTimeout(async () => {
      // Update to running
      job.status = 'running';
      job.progress = 25;
      job.updatedAt = new Date().toISOString();
      console.log(`🔄 Job ${jobId} is now running`);

      // Simulate more progress
      setTimeout(() => {
        job.progress = 75;
        job.updatedAt = new Date().toISOString();
        console.log(`🔄 Job ${jobId} is 75% complete`);

        // Complete the job and create a file
        setTimeout(() => {
          job.status = 'completed';
          job.progress = 100;
          job.updatedAt = new Date().toISOString();

          // Get the appropriate sample results based on query name
          const sampleResults = getSampleResults(job.queryName);

          // Create a file for the results
          const fileId = generateFileId();
          const file = {
            fileId,
            fileName: 'results.json',
            fileSize: JSON.stringify(sampleResults).length,
            contentType: 'application/json',
            createdAt: new Date().toISOString(),
            jobId: jobId,
            downloadUrl: `http://localhost:${PORT}/information-services/context-sumo-report/files/${fileId}/download`,
            sampleResults: sampleResults, // Store the results with the file
          };

          files.set(fileId, file);
          job.fileId = fileId;

          console.log(`✅ Job ${jobId} completed with file ${fileId}`);
        }, 2000);
      }, 1500);
    }, 1000);

    res.status(201).json({
      jobId,
      status: 'queued',
      estimatedDuration: '2-5 minutes',
      statusUrl: `/information-services/context-sumo-report/query/${jobId}/status`,
    });
  },
);

// GET /information-services/context-sumo-report/query/{jobId}/status
app.get(
  '/information-services/context-sumo-report/query/:jobId/status',
  (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(
      `📊 Status check for job ${jobId}: ${job.status} (${job.progress}%)`,
    );

    res.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      ...(job.error && { error: job.error }),
      ...(job.fileId && { fileId: job.fileId }),
    });
  },
);

// GET /information-services/context-sumo-report/query/{jobId}/results
app.get(
  '/information-services/context-sumo-report/query/:jobId/results',
  (req, res) => {
    const { jobId } = req.params;
    const job = jobs.get(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${jobId} does not exist`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({
        error: 'Job not completed',
        message: `Job ${jobId} is still ${job.status}`,
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📋 Results requested for job ${jobId}`);

    // Get the file data to return results
    const file = files.get(job.fileId);
    const results = file ? file.sampleResults : null;

    res.json({
      jobId: job.jobId,
      status: job.status,
      results: results,
      fileId: job.fileId,
    });
  },
);

// GET /information-services/context-sumo-report/files/{fileId}
app.get(
  '/information-services/context-sumo-report/files/:fileId',
  (req, res) => {
    const { fileId } = req.params;
    const file = files.get(fileId);

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
        message: `File with ID ${fileId} does not exist`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📁 File info requested for ${fileId}: ${file.fileName}`);

    res.json({
      fileId: file.fileId,
      fileName: file.fileName,
      fileSize: file.fileSize,
      contentType: file.contentType,
      createdAt: file.createdAt,
      downloadUrl: file.downloadUrl,
    });
  },
);

// GET /information-services/context-sumo-report/files/{fileId}/download
app.get(
  '/information-services/context-sumo-report/files/:fileId/download',
  (req, res) => {
    const { fileId } = req.params;
    const file = files.get(fileId);

    if (!file) {
      return res.status(404).json({
        error: 'File not found',
        message: `File with ID ${fileId} does not exist`,
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`⬇️ File download requested for ${fileId}: ${file.fileName}`);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.json(file.sampleResults);
  },
);

// GET /information-services/context-sumo-report/files (list files)
app.get('/information-services/context-sumo-report/files', (req, res) => {
  console.log('📂 Files list requested');

  const filesList = Array.from(files.values()).map((file) => ({
    fileId: file.fileId,
    fileName: file.fileName,
    fileSize: file.fileSize,
    createdAt: file.createdAt,
    jobId: file.jobId,
  }));

  res.json({
    files: filesList,
  });
});

// POST /information-services/knowledge-bases/preQuery
app.post('/information-services/knowledge-bases/preQuery', (req, res) => {
  console.log('📥 Received knowledge base preQuery:', req.body);

  // Load and return real preQuery response from live server
  try {
    const preQueryDataPath = path.join(
      __dirname,
      'fake-responses/fake-preQuery-form.json',
    );

    if (fs.existsSync(preQueryDataPath)) {
      const realPreQueryData = JSON.parse(
        fs.readFileSync(preQueryDataPath, 'utf8'),
      );
      console.log('📋 Returning real preQuery data with 1536 embeddings');

      // Override the query with the submitted query while keeping real embeddings
      realPreQueryData.query = req.body.query || realPreQueryData.query;
      realPreQueryData.minConfidence =
        req.body.minConfidence || realPreQueryData.minConfidence;
      realPreQueryData.pageSize =
        req.body.pageSize || realPreQueryData.pageSize;

      res.json(realPreQueryData);
      return;
    }
  } catch (error) {
    console.error('❌ Error loading real preQuery data:', error.message);
  }

  // Fallback if real data not available
  console.log('⚠️ Real preQuery data not found, using simplified response');
  const preQueryResponse = {
    query: req.body.query || 'form',
    minConfidence: req.body.minConfidence || 0.7,
    pageSize: req.body.pageSize || 10,
    originalText: req.body.query || 'form',
    keywords: ['form', 'configuration', 'functionality'],
    nouns: ['customer', 'platform', 'form', 'setup'],
    properNouns: ['Formstack'],
    domains: ['BACKEND:SUBMIT-ACTIONS'],
    userPromptText: req.body.query || 'form',
    applicableKnowledgeBase: ['CONTEXT-DOCUMENTS', 'SLACK'],
    subjects: null,
  };

  res.json(preQueryResponse);
});

// POST /information-services/knowledge-bases/top-results
app.post('/information-services/knowledge-bases/top-results', (req, res) => {
  console.log('📥 Received knowledge base top-results search:', req.body);

  // Load the real knowledge base search data
  try {
    const kbDataPath = path.join(
      __dirname,
      'fake-responses',
      'fake-knowledge-base-search-form.json',
    );

    if (fs.existsSync(kbDataPath)) {
      const kbData = JSON.parse(fs.readFileSync(kbDataPath, 'utf8'));
      console.log('📋 Returning real knowledge base search data');
      res.json(kbData);
    } else {
      console.log(
        '⚠️ Knowledge base mock data not found, returning minimal response',
      );
      res.json({
        searchKeywords: {
          SLACK: [],
          'CONTEXT-DOCUMENTS': [],
        },
        searchTypesExecuted: ['searchKeywords'],
        totalSearchTypes: 1,
      });
    }
  } catch (error) {
    console.error('❌ Error loading knowledge base data:', error.message);
    res.status(500).json({
      error: 'Failed to load knowledge base data',
      message: error.message,
    });
  }
});

// POST /information-services/context-dynamic/form
app.post('/information-services/context-dynamic/form', (req, res) => {
  console.log('📥 Received context-dynamic form request:', req.body);

  const { formId } = req.body;

  if (!formId) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'formId is required',
    });
  }

  // Generate mock form context data with random IDs but realistic structure
  const mockFormContext = {
    form: {
      formId: formId,
      activeAuthProviderName: 'SAML Provider',
      protectionType: 'SSO',
      submitActions: [
        {
          submitActionId: Math.floor(Math.random() * 1000000) + 100000,
          name: 'Webhook to CRM',
          type: 'webhook',
          isActive: true,
          hasLogic: false,
        },
        {
          submitActionId: Math.floor(Math.random() * 1000000) + 100000,
          name: 'Salesforce Integration',
          type: 'salesforce',
          isActive: true,
          hasLogic: true,
        },
        {
          submitActionId: Math.floor(Math.random() * 1000000) + 100000,
          name: 'Email Notification',
          type: 'email',
          isActive: false,
          hasLogic: false,
        },
      ],
      confirmationEmails: [
        {
          confirmationEmailId: Math.floor(Math.random() * 1000000) + 200000,
          name: 'Thank You Email',
          payloadType: 'html',
          hasLogic: true,
        },
      ],
      notificationEmails: [
        {
          notificationEmailId: Math.floor(Math.random() * 1000000) + 300000,
          name: 'Admin Notification',
          payloadType: 'text',
          hasLogic: false,
        },
        {
          notificationEmailId: Math.floor(Math.random() * 1000000) + 300000,
          name: 'Manager Alert',
          payloadType: 'html',
          hasLogic: true,
        },
      ],
      formPlugins: [
        {
          formPluginId: Math.floor(Math.random() * 1000000) + 400000,
          type: 'analytics',
          isActive: true,
        },
        {
          formPluginId: Math.floor(Math.random() * 1000000) + 400000,
          type: 'captcha',
          isActive: false,
        },
      ],
      smartLists: [
        {
          smartListId: Math.floor(Math.random() * 1000000) + 500000,
          name: 'US States',
          fieldIds: [101, 102],
          useSeparateValues: true,
          useImages: false,
        },
        {
          smartListId: Math.floor(Math.random() * 1000000) + 500000,
          name: 'Countries',
          fieldIds: [103],
          useSeparateValues: false,
          useImages: true,
        },
      ],
    },
  };

  console.log(`📋 Returning mock form context for formId: ${formId}`);
  res.json(mockFormContext);
});

// Health check endpoint
app.get('/information-services/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0-mock',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint with API info
app.get('/', (req, res) => {
  res.json({
    name: 'iStack Buddy Information Services Mock Server',
    version: '1.0.0',
    endpoints: {
      'POST /information-services/context-sumo-report/query/submit':
        'Submit a Sumo query job',
      'GET /information-services/context-sumo-report/query/{jobId}/status':
        'Check job status',
      'GET /information-services/context-sumo-report/query/{jobId}/results':
        'Get job results',
      'GET /information-services/context-sumo-report/files/{fileId}':
        'Get file metadata',
      'GET /information-services/context-sumo-report/files/{fileId}/download':
        'Download file',
      'GET /information-services/context-sumo-report/files': 'List all files',
      'POST /information-services/knowledge-bases/preQuery':
        'Knowledge base preQuery',
      'POST /information-services/knowledge-bases/top-results':
        'Knowledge base search',
      'POST /information-services/context-dynamic/form': 'Get form context',
      'GET /information-services/health': 'Health check',
    },
    note: 'This mock server simulates the information services API for development purposes',
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    statusCode: 500,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Endpoint ${req.method} ${req.path} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log('🚀 iStack Buddy Information Services Mock Server');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('   POST /information-services/context-sumo-report/query/submit');
  console.log(
    '   GET  /information-services/context-sumo-report/query/{jobId}/status',
  );
  console.log(
    '   GET  /information-services/context-sumo-report/query/{jobId}/results',
  );
  console.log(
    '   GET  /information-services/context-sumo-report/files/{fileId}',
  );
  console.log(
    '   GET  /information-services/context-sumo-report/files/{fileId}/download',
  );
  console.log('   GET  /information-services/context-sumo-report/files');
  console.log('   POST /information-services/knowledge-bases/preQuery');
  console.log('   POST /information-services/knowledge-bases/top-results');
  console.log('   POST /information-services/context-dynamic/form');
  console.log('   GET  /information-services/health');
  console.log('');
  console.log(
    '🔄 Jobs will automatically progress: pending → running → completed',
  );
  console.log('📁 Files are created when jobs complete');
  console.log('💾 All data is stored in memory (resets on restart)');
});
