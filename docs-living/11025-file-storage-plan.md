# File Storage & Management Plan

## Overview

Comprehensive file storage system for chat attachments, integrating proven patterns from how-do-you-know with chat-specific requirements and security controls.

## Implementation Order

**Priority: 6**
**Dependencies: 11001-authentication, 11010-database-schema, 11020-message-processing**
**Required Before: Robot integration (file-based diagnostics)**

## Features Included

### 1. File Upload & Processing

- Multi-format file support (images, documents, videos, etc.)
- Security scanning and validation
- Thumbnail/preview generation
- Queue-based processing pipeline
- Virus scanning integration

### 2. Storage Management (Adapted from how-do-you-know)

- Storage class abstraction
- File hashing and deduplication
- Automated retention policies
- Cloud storage integration
- Backup and recovery

### 3. Access Control

- Owner-based file permissions
- Room-specific file sharing
- Guest access restrictions
- Download tracking and auditing

### 4. Integration with Chat System

- File message type support
- Inline preview generation
- Share-in-chat functionality
- Batch-delay processing for large files

## Storage Architecture (Reusing how-do-you-know patterns)

### Storage Classes

```typescript
enum ChatFileStorageClass {
  TEMPORARY = 'chat-temporary', // 24 hours, quick uploads
  CONVERSATION = 'chat-conversation', // 2 years, standard chat files
  ARCHIVE = 'chat-archive', // 7 years, long-term storage
  COMPLIANCE = 'chat-compliance', // 10 years, regulatory requirements
}

interface StorageClassConfig {
  name: ChatFileStorageClass;
  retentionDays: number;
  maxFileSize: number;
  allowedMimeTypes: string[];
  requiresVirusScanning: boolean;
  generateThumbnails: boolean;
  compressionLevel: 'none' | 'standard' | 'aggressive';
  storageLocation: 'local' | 's3' | 'azure' | 'gcp';
}

const STORAGE_CLASS_CONFIGS: Record<ChatFileStorageClass, StorageClassConfig> =
  {
    [ChatFileStorageClass.TEMPORARY]: {
      name: ChatFileStorageClass.TEMPORARY,
      retentionDays: 1,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['image/*', 'text/*', 'application/pdf'],
      requiresVirusScanning: false,
      generateThumbnails: true,
      compressionLevel: 'standard',
      storageLocation: 'local',
    },
    [ChatFileStorageClass.CONVERSATION]: {
      name: ChatFileStorageClass.CONVERSATION,
      retentionDays: 730, // 2 years
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: ['*/*'], // All types allowed
      requiresVirusScanning: true,
      generateThumbnails: true,
      compressionLevel: 'standard',
      storageLocation: 's3',
    },
    // ... other storage classes
  };
```

### File Entity (Extended from how-do-you-know)

```typescript
@Entity('chat_files')
export class ChatFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Chat-specific fields
  @Column('uuid')
  uploadedBy: string;

  @Column('uuid', { nullable: true })
  messageId?: string; // Link to message if attached

  @Column('uuid')
  roomId: string; // Room where file was shared

  // File metadata (from how-do-you-know pattern)
  @Column()
  originalFilename: string;

  @Column()
  storedFilename: string;

  @Column('bigint')
  sizeInBytes: number;

  @Column()
  mimeType: string;

  @Column()
  fileHash: string;

  @Column()
  fileHashAlgorithm: string;

  @Column({ type: 'enum', enum: ChatFileStorageClass })
  storageClass: ChatFileStorageClass;

  @Column({ type: 'enum', enum: FileStatus })
  status: FileStatus;

  // Chat-specific metadata
  @Column('jsonb', { default: '{}' })
  chatMetadata: {
    thumbnailUrl?: string;
    previewUrl?: string;
    isPubliclyViewable?: boolean;
    sharedWithGuests?: boolean;
    downloadCount?: number;
    lastAccessedAt?: Date;
  };

  // Access control
  @Column('simple-array', { default: '' })
  allowedUserIds: string[]; // Users who can access this file

  @Column('simple-array', { default: '' })
  allowedRoomIds: string[]; // Rooms where this file is shared

  // Processing status
  @Column({ default: false })
  virusScanComplete: boolean;

  @Column({ default: false })
  thumbnailGenerated: boolean;

  @Column({ nullable: true })
  processingError?: string;

  // Timestamps (following how-do-you-know pattern)
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;
}
```

## Implementation Strategy

### File Service (Adapting how-do-you-know patterns)

```typescript
@Injectable()
export class ChatFileService {
  @RequirePermissions('chat:file:upload')
  async uploadFile(
    uploaderId: string,
    roomId: string,
    file: Express.Multer.File,
    options: FileUploadOptions,
  ): Promise<ChatFile> {
    // Validate upload permissions
    await this.validateUploadPermissions(uploaderId, roomId);

    // Determine storage class
    const storageClass = this.determineStorageClass(file, options);

    // Create file record
    const chatFile = await this.createFileRecord(
      uploaderId,
      roomId,
      file,
      storageClass,
    );

    // Queue for processing
    await this.queueFileProcessing(chatFile);

    return chatFile;
  }

  private async validateUploadPermissions(
    uploaderId: string,
    roomId: string,
  ): Promise<void> {
    // Check room access
    const canAccess = await this.roomService.canUserAccessRoom(
      uploaderId,
      roomId,
    );
    if (!canAccess) {
      throw new ForbiddenException('Cannot upload to this room');
    }

    // Check user role restrictions
    const userRole = await this.roomService.getUserRole(uploaderId, roomId);
    if (userRole === ParticipantRole.GUEST) {
      // Apply guest-specific restrictions
      await this.validateGuestUpload(uploaderId, roomId);
    }

    // Check file upload quota
    await this.checkUploadQuota(uploaderId);
  }

  private async queueFileProcessing(file: ChatFile): Promise<void> {
    const processingJob: FileProcessingJob = {
      fileId: file.id,
      uploaderId: file.uploadedBy,
      roomId: file.roomId,
      storageClass: file.storageClass,
      requiresVirusScanning:
        STORAGE_CLASS_CONFIGS[file.storageClass].requiresVirusScanning,
      generateThumbnails:
        STORAGE_CLASS_CONFIGS[file.storageClass].generateThumbnails,
      priority:
        file.storageClass === ChatFileStorageClass.TEMPORARY
          ? 'high'
          : 'normal',
    };

    await this.fileProcessingQueue.add('process-upload', processingJob);
  }
}
```

### File Processing Pipeline

```typescript
@Processor('file-processing')
export class FileProcessingConsumer {
  @Process('process-upload')
  async processFileUpload(job: Job<FileProcessingJob>): Promise<void> {
    const { fileId } = job.data;
    const file = await this.chatFileService.findById(fileId);

    try {
      // Phase 1: Move to permanent storage
      await this.moveToStorage(file);

      // Phase 2: Virus scanning
      if (job.data.requiresVirusScanning) {
        await this.performVirusScan(file);
      }

      // Phase 3: Generate thumbnails/previews
      if (job.data.generateThumbnails) {
        await this.generateThumbnails(file);
      }

      // Phase 4: Update file status
      await this.updateFileStatus(file, FileStatus.READY);

      // Phase 5: Notify users
      await this.notifyFileReady(file);
    } catch (error) {
      await this.handleProcessingError(file, error);
    }
  }

  private async performVirusScan(file: ChatFile): Promise<void> {
    const scanResult = await this.virusScanService.scanFile(
      file.storedFilename,
    );

    if (scanResult.infected) {
      // Quarantine infected file
      await this.quarantineFile(file, scanResult);
      throw new Error(`Virus detected: ${scanResult.threats.join(', ')}`);
    }

    // Mark as clean
    await this.chatFileRepository.update(file.id, {
      virusScanComplete: true,
      chatMetadata: {
        ...file.chatMetadata,
        virusScanResult: scanResult,
      },
    });
  }

  private async generateThumbnails(file: ChatFile): Promise<void> {
    if (!this.isImageOrVideo(file.mimeType)) {
      return;
    }

    const thumbnailPath = await this.thumbnailService.generateThumbnail(
      file.storedFilename,
      { width: 200, height: 200, quality: 80 },
    );

    const previewPath = await this.thumbnailService.generatePreview(
      file.storedFilename,
      { width: 800, height: 600, quality: 90 },
    );

    await this.chatFileRepository.update(file.id, {
      thumbnailGenerated: true,
      chatMetadata: {
        ...file.chatMetadata,
        thumbnailUrl: thumbnailPath,
        previewUrl: previewPath,
      },
    });
  }
}
```

## Security & Access Control

### File Access Validation

```typescript
@Injectable()
export class FileAccessService {
  async validateFileAccess(
    userId: string,
    fileId: string,
    action: 'view' | 'download' | 'share',
  ): Promise<boolean> {
    const file = await this.chatFileService.findById(fileId);
    if (!file) return false;

    // Check room access
    const canAccessRoom = await this.roomService.canUserAccessRoom(
      userId,
      file.roomId,
    );
    if (!canAccessRoom) return false;

    // Check file-specific permissions
    if (
      file.allowedUserIds.length > 0 &&
      !file.allowedUserIds.includes(userId)
    ) {
      return false;
    }

    // Guest-specific restrictions
    const userRole = await this.roomService.getUserRole(userId, file.roomId);
    if (userRole === ParticipantRole.GUEST) {
      return await this.validateGuestFileAccess(userId, file, action);
    }

    return true;
  }

  private async validateGuestFileAccess(
    userId: string,
    file: ChatFile,
    action: string,
  ): Promise<boolean> {
    // Guests can only access files explicitly shared with them
    if (!file.chatMetadata.sharedWithGuests) {
      return false;
    }

    // Guests cannot share files
    if (action === 'share') {
      return false;
    }

    // Check if guest is alone in room (guest protection)
    const hasEmployeeInRoom = await this.roomService.hasEmployeeInRoom(
      file.roomId,
    );
    if (!hasEmployeeInRoom) {
      return false; // Guest protection violation
    }

    return true;
  }
}
```

### File Download Controller

```typescript
@Controller('files')
export class FileController {
  @Get(':fileId/download')
  @RequirePermissions('chat:file:download')
  async downloadFile(
    @Param('fileId') fileId: string,
    @CurrentUser() user: User,
    @Res() response: Response,
  ): Promise<void> {
    // Validate access
    const canAccess = await this.fileAccessService.validateFileAccess(
      user.id,
      fileId,
      'download',
    );

    if (!canAccess) {
      throw new ForbiddenException('Cannot access this file');
    }

    const file = await this.chatFileService.findById(fileId);

    // Get file stream
    const fileStream = await this.storageService.getFileStream(
      file.storedFilename,
    );

    // Set headers
    response.set({
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${file.originalFilename}"`,
      'Content-Length': file.sizeInBytes.toString(),
    });

    // Track download
    await this.auditService.logFileAccess(user.id, fileId, 'download');

    // Stream file
    fileStream.pipe(response);
  }

  @Get(':fileId/thumbnail')
  async getThumbnail(
    @Param('fileId') fileId: string,
    @CurrentUser() user: User,
    @Res() response: Response,
  ): Promise<void> {
    const canAccess = await this.fileAccessService.validateFileAccess(
      user.id,
      fileId,
      'view',
    );
    if (!canAccess) {
      throw new ForbiddenException('Cannot access this file');
    }

    const file = await this.chatFileService.findById(fileId);

    if (!file.chatMetadata.thumbnailUrl) {
      throw new NotFoundException('Thumbnail not available');
    }

    const thumbnailStream = await this.storageService.getFileStream(
      file.chatMetadata.thumbnailUrl,
    );

    response.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600',
    });

    thumbnailStream.pipe(response);
  }
}
```

## Integration with Message System

### File Message Integration

```typescript
@Injectable()
export class FileMessageService {
  async createFileMessage(
    senderId: string,
    roomId: string,
    files: ChatFile[],
    caption?: string,
  ): Promise<Message> {
    // Create message with file attachments
    const message = await this.messageService.sendMessage(senderId, {
      roomId,
      type: MessageType.FILE,
      content: caption || 'File attachment',
      deliveryStatus: DeliveryStatus.BATCH_DELAY, // Files use batch-delay
      metadata: {
        fileAttachments: files.map((file) => ({
          fileId: file.id,
          filename: file.originalFilename,
          mimeType: file.mimeType,
          size: file.sizeInBytes,
          thumbnailUrl: file.chatMetadata.thumbnailUrl,
          previewUrl: file.chatMetadata.previewUrl,
        })),
      },
    });

    // Link files to message
    await this.linkFilesToMessage(files, message.id);

    return message;
  }

  @EventPattern('file.processing.completed')
  async handleFileProcessingCompleted(data: { fileId: string }): Promise<void> {
    const file = await this.chatFileService.findById(data.fileId);

    if (file.messageId) {
      // Update message status from batch-delay to delivered
      await this.messageService.updateDeliveryStatus(
        file.messageId,
        DeliveryStatus.DELIVERED,
      );

      // Broadcast updated message to room
      const message = await this.messageService.findById(file.messageId);
      await this.messageBroadcastService.broadcastMessage(message);
    }
  }
}
```

## Storage Backend Integration

### Cloud Storage Service

```typescript
@Injectable()
export class CloudStorageService {
  async uploadFile(
    fileData: Buffer,
    filename: string,
    storageClass: ChatFileStorageClass,
  ): Promise<string> {
    const config = STORAGE_CLASS_CONFIGS[storageClass];

    switch (config.storageLocation) {
      case 's3':
        return await this.uploadToS3(fileData, filename, config);
      case 'azure':
        return await this.uploadToAzure(fileData, filename, config);
      case 'local':
        return await this.uploadToLocal(fileData, filename, config);
      default:
        throw new Error(
          `Unsupported storage location: ${config.storageLocation}`,
        );
    }
  }

  private async uploadToS3(
    fileData: Buffer,
    filename: string,
    config: StorageClassConfig,
  ): Promise<string> {
    const key = this.generateStorageKey(filename, config);

    const uploadParams = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: fileData,
      ContentType: this.getMimeTypeFromFilename(filename),
      StorageClass: this.getS3StorageClass(config),
      ServerSideEncryption: 'AES256',
    };

    const result = await this.s3Client.upload(uploadParams).promise();
    return result.Key;
  }

  private generateStorageKey(
    filename: string,
    config: StorageClassConfig,
  ): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const uuid = uuidv4();
    const extension = path.extname(filename);

    return `chat-files/${config.name}/${year}/${month}/${day}/${uuid}${extension}`;
  }
}
```

## File Retention & Cleanup

### Automated Cleanup Service

```typescript
@Injectable()
export class FileRetentionService {
  @Cron('0 2 * * *') // Run daily at 2 AM
  async performRetentionCleanup(): Promise<void> {
    for (const storageClass of Object.values(ChatFileStorageClass)) {
      await this.cleanupExpiredFiles(storageClass);
    }
  }

  private async cleanupExpiredFiles(
    storageClass: ChatFileStorageClass,
  ): Promise<void> {
    const config = STORAGE_CLASS_CONFIGS[storageClass];
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - config.retentionDays);

    const expiredFiles = await this.chatFileRepository.find({
      where: {
        storageClass,
        createdAt: LessThan(expirationDate),
        deletedAt: IsNull(),
      },
    });

    for (const file of expiredFiles) {
      await this.archiveOrDeleteFile(file);
    }

    this.logger.log(
      `Cleaned up ${expiredFiles.length} expired files for storage class ${storageClass}`,
    );
  }

  private async archiveOrDeleteFile(file: ChatFile): Promise<void> {
    if (file.storageClass === ChatFileStorageClass.COMPLIANCE) {
      // Move to cold storage instead of deleting
      await this.moveToArchiveStorage(file);
    } else {
      // Soft delete the file
      await this.chatFileRepository.softDelete(file.id);

      // Remove from storage backend
      await this.storageService.deleteFile(file.storedFilename);

      // Clean up thumbnails
      if (file.chatMetadata.thumbnailUrl) {
        await this.storageService.deleteFile(file.chatMetadata.thumbnailUrl);
      }
    }
  }
}
```

## Testing Strategy

### Unit Tests

```typescript
describe('ChatFileService', () => {
  describe('File Upload', () => {
    it('should validate file permissions before upload', async () => {
      // Test permission validation
    });

    it('should apply guest restrictions', async () => {
      // Test guest upload restrictions
    });

    it('should queue files for processing', async () => {
      // Test processing queue
    });
  });

  describe('File Access', () => {
    it('should enforce room-based access control', async () => {
      // Test access control
    });

    it('should track file downloads', async () => {
      // Test audit logging
    });
  });
});
```

### Integration Tests

- End-to-end file upload flow
- Virus scanning integration
- Thumbnail generation
- Storage backend failover
- Retention policy enforcement

## Monitoring & Analytics

### File Storage Metrics

- Upload success/failure rates
- Processing time by file type
- Storage utilization by class
- Download frequency
- Virus detection rates

### Alerts

- Failed virus scans
- Storage quota approaching
- Processing queue backlogs
- Unusual file activity

## Success Criteria

- [ ] Secure file upload with virus scanning
- [ ] Thumbnail generation for images/videos
- [ ] Guest access restrictions enforced
- [ ] Integration with message system working
- [ ] Automated retention policies active
- [ ] Cloud storage backend operational
- [ ] File download tracking and auditing
- [ ] > 90% test coverage with security testing
