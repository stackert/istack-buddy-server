#!/usr/bin/env ts-node

/**
 * Test script for the BullMQ job queue system
 *
 * This script demonstrates how to use the job queue system by:
 * 1. Creating sample jobs
 * 2. Monitoring job status
 * 3. Cleaning up jobs
 *
 * Run with: ts-node scripts/test-job-queue.ts
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { JobQueueService } from '../src/job-queue/job-queue.service';
import { BullBoardService } from '../src/job-queue/bull-board.service';
import { CustomLoggerService } from '../src/common/logger/custom-logger.service';

async function testJobQueue() {
  console.log('🚀 Starting Job Queue Test...\n');

  // Create NestJS application
  const app = await NestFactory.createApplicationContext(AppModule);
  const logger = app.get(CustomLoggerService);
  const jobQueueService = app.get(JobQueueService);
  const bullBoardService = app.get(BullBoardService);

  try {
    // Test 1: Queue a message delivery job
    console.log('📨 Testing message delivery job...');
    const messageJob = await jobQueueService.queueMessageDelivery(
      'user-123',
      'message-456',
      {
        delay: 0,
        priority: 5,
        attempts: 3,
      },
    );
    console.log(`✅ Message delivery job queued: ${messageJob.id}\n`);

    // Test 2: Queue a file processing job
    console.log('📁 Testing file processing job...');
    const fileJob = await jobQueueService.queueFileProcessing(
      'file-789',
      'user-123',
      'room-456',
      'standard',
      {
        requiresVirusScanning: true,
        generateThumbnails: true,
        priority: 'normal',
        delay: 0,
      },
    );
    console.log(`✅ File processing job queued: ${fileJob.id}\n`);

    // Test 3: Queue a notification job
    console.log('🔔 Testing notification job...');
    const notificationJob = await jobQueueService.queueNotification(
      'user-123',
      'message',
      'New Message',
      'You have a new message from John Doe',
      {
        metadata: {
          source: 'test-script',
          timestamp: new Date().toISOString(),
        },
        priority: 'normal',
        delay: 0,
      },
    );
    console.log(`✅ Notification job queued: ${notificationJob.id}\n`);

    // Test 4: Get queue statistics
    console.log('📊 Getting queue statistics...');
    const stats = await jobQueueService.getAllQueueStats();
    console.log('Queue Statistics:', JSON.stringify(stats, null, 2));
    console.log('');

    // Test 5: Wait a bit for jobs to process
    console.log('⏳ Waiting for jobs to process...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Test 6: Get updated statistics
    console.log('📊 Getting updated queue statistics...');
    const updatedStats = await jobQueueService.getAllQueueStats();
    console.log(
      'Updated Queue Statistics:',
      JSON.stringify(updatedStats, null, 2),
    );
    console.log('');

    // Test 7: Get job status
    console.log('🔍 Checking job status...');
    const messageJobStatus = await jobQueueService.getJobStatus(
      'message-queue',
      messageJob.id!,
    );
    if (messageJobStatus) {
      console.log(`Message job status: ${await messageJobStatus.getState()}`);
    }

    const fileJobStatus = await jobQueueService.getJobStatus(
      'file-processing',
      fileJob.id!,
    );
    if (fileJobStatus) {
      console.log(`File job status: ${await fileJobStatus.getState()}`);
    }

    const notificationJobStatus = await jobQueueService.getJobStatus(
      'notifications',
      notificationJob.id!,
    );
    if (notificationJobStatus) {
      console.log(
        `Notification job status: ${await notificationJobStatus.getState()}`,
      );
    }
    console.log('');

    // Test 8: Clean up completed jobs
    console.log('🧹 Cleaning up completed jobs...');
    await jobQueueService.cleanCompletedJobs(0); // Clean all completed jobs
    console.log('✅ Cleanup completed\n');

    // Test 9: Final statistics
    console.log('📊 Final queue statistics...');
    const finalStats = await jobQueueService.getAllQueueStats();
    console.log('Final Queue Statistics:', JSON.stringify(finalStats, null, 2));

    console.log('\n🎉 Job Queue Test Completed Successfully!');
    console.log('\n📋 Next Steps:');
    console.log(
      '1. Visit http://localhost:3500/admin/queues to see the Bull Board dashboard',
    );
    console.log(
      '2. Visit http://localhost:3500/api to see the API documentation',
    );
    console.log('3. Use the JobQueueService in your services to queue jobs');
    console.log('4. Monitor job processing via the dashboard or API endpoints');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the test
if (require.main === module) {
  testJobQueue()
    .then(() => {
      console.log('\n✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error);
      process.exit(1);
    });
}
