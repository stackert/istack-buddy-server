# iStack Buddy Information Services Mock Server

A simple mock server that mimics the information services API for development and testing purposes.

## Features

This mock server provides the 3 core endpoints needed for Sumo query processing:

1. **Submit Job** - `POST /information-services/context-sumo-report/query/submit`
2. **Check Status** - `GET /information-services/context-sumo-report/query/{jobId}/status`
3. **Download File** - `GET /information-services/context-sumo-report/files/{fileId}`

## Quick Start

### Install Dependencies

```bash
cd test-data/mock-servers
npm install
```

### Start the Server

```bash
npm start
# or
node information-services-mock.js
```

The server will start on `http://localhost:3001` by default.

## API Endpoints

### Submit a Query Job

```bash
curl -X POST http://localhost:3001/information-services/context-sumo-report/query/submit \
  -H "Content-Type: application/json" \
  -d '{
    "queryName": "submissionCreatedForForm",
    "subject": {
      "formId": "12345",
      "startDate": "2025-09-09",
      "endDate": "2025-09-10"
    }
  }'
```

Response:

```json
{
  "jobId": "job_1",
  "status": "queued",
  "estimatedDuration": "2-5 minutes",
  "statusUrl": "/information-services/context-sumo-report/query/job_1/status"
}
```

### Check Job Status

```bash
curl http://localhost:3001/information-services/context-sumo-report/query/job_1/status
```

Response:

```json
{
  "jobId": "job_1",
  "status": "completed",
  "progress": 100,
  "createdAt": "2025-09-10T12:00:00.000Z",
  "updatedAt": "2025-09-10T12:02:30.000Z",
  "fileId": "file_1"
}
```

### Get File Info

```bash
curl http://localhost:3001/information-services/context-sumo-report/files/file_1
```

Response:

```json
{
  "fileId": "file_1",
  "fileName": "results.json",
  "fileSize": 1234,
  "contentType": "application/json",
  "createdAt": "2025-09-10T12:02:30.000Z",
  "downloadUrl": "http://localhost:3001/information-services/context-sumo-report/files/file_1/download"
}
```

### Download File

```bash
curl http://localhost:3001/information-services/context-sumo-report/files/file_1/download
```

Returns the sample results JSON data.

## Behavior

- **Automatic Job Progress**: Jobs automatically progress from `pending` → `running` → `completed` over ~4.5 seconds
- **File Creation**: When a job completes, a file is automatically created with sample data
- **In-Memory Storage**: All data is stored in memory and resets when the server restarts
- **Realistic Data**: All completed jobs return realistic fake data from `fake-responses/fake-sumo-submissin-report-large.json`

## Additional Endpoints

- `GET /` - API information and available endpoints
- `GET /information-services/health` - Health check
- `GET /information-services/context-sumo-report/files` - List all files
- `GET /information-services/context-sumo-report/query/{jobId}/results` - Get job results directly

## Configuration

- **Port**: Set `PORT` environment variable (default: 3001)
- **Sample Data**: Edit `fake-responses/fake-sumo-submissin-report-large.json` to customize the returned data

## Development Notes

This mock server is designed to be as simple as possible while still providing realistic behavior for the Sumo query workflow. It uses Express.js with minimal dependencies and stores everything in memory for simplicity.

Perfect for:

- Local development
- Integration testing
- Demos and prototyping
- Understanding the API flow

## Logs

The server provides console output showing:

- 📥 Job submissions
- 🔄 Job progress updates
- ✅ Job completions
- 📊 Status checks
- 📁 File requests
- ⬇️ File downloads
