import { Test, TestingModule } from '@nestjs/testing';
import { FileProcessingProcessor } from './file-processing.processor';
import { FileManagerService } from '../../file-manager/file-manager.service';

describe('FileProcessingProcessor', () => {
  let processor: FileProcessingProcessor;
  let mockFileManagerService: jest.Mocked<FileManagerService>;

  beforeEach(async () => {
    mockFileManagerService = {
      exists: jest.fn(),
      get: jest.fn(),
      getMetaDetails: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileProcessingProcessor,
        {
          provide: FileManagerService,
          useValue: mockFileManagerService,
        },
      ],
    }).compile();

    processor = module.get<FileProcessingProcessor>(FileProcessingProcessor);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('handleFileProcessing', () => {
    it('should process metadata extraction operation', async () => {
      const mockJob = {
        data: {
          fileId: 'file-123',
          userId: 'user-456',
          operation: 'metadata-extraction',
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      mockFileManagerService.exists.mockResolvedValue(true);
      mockFileManagerService.getMetaDetails.mockResolvedValue({
        contentType: 'text/plain',
        fileSize: 100,
        tokenSize: 25,
      });

      await expect(
        processor.handleFileProcessing(mockJob as any),
      ).resolves.not.toThrow();
      expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    });

    it('should throw error for non-existing file', async () => {
      const mockJob = {
        data: {
          fileId: 'file-123',
          userId: 'user-456',
          operation: 'metadata-extraction',
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      mockFileManagerService.exists.mockResolvedValue(false);

      await expect(
        processor.handleFileProcessing(mockJob as any),
      ).rejects.toThrow('File file-123 not found');
    });

    it('should throw error for unknown operation', async () => {
      const mockJob = {
        data: {
          fileId: 'file-123',
          userId: 'user-456',
          operation: 'unknown-operation' as any,
        },
        updateProgress: jest.fn().mockResolvedValue(undefined),
      };

      mockFileManagerService.exists.mockResolvedValue(true);

      await expect(
        processor.handleFileProcessing(mockJob as any),
      ).rejects.toThrow('Unknown file processing operation: unknown-operation');
    });
  });
});
