import { Test, TestingModule } from '@nestjs/testing';
import {
  FileManagerService,
  STORAGE_CLASS,
  FileContent,
} from './file-manager.service';

// Override the global fs mock to include promises
const mockFs = require('fs');
mockFs.promises = {
  writeFile: jest.fn(),
  readFile: jest.fn(),
  stat: jest.fn(),
  unlink: jest.fn(),
  access: jest.fn(),
  readdir: jest.fn(),
  mkdir: jest.fn(),
};

// Fix the global path mock to include extname
const mockPath = require('path');
mockPath.extname = jest.fn((filePath) => {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot === -1 ? '' : filePath.substring(lastDot);
});

describe('FileManagerService', () => {
  let service: FileManagerService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [FileManagerService],
    }).compile();

    service = module.get<FileManagerService>(FileManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should store file content', async () => {
    const fileContent: FileContent = {
      content: 'test content',
      contentType: 'text/plain',
    };

    mockFs.promises.writeFile.mockResolvedValue(undefined);

    const result = await service.put(fileContent, STORAGE_CLASS.TEMP);

    expect(result).toContain('-');
    expect(mockFs.promises.writeFile).toHaveBeenCalled();
  });

  it('should retrieve file content', async () => {
    const fileId = 'test-file.txt';
    const expectedContent = Buffer.from('file content');

    mockFs.promises.readFile.mockResolvedValue(expectedContent);

    const result = await service.get(fileId);

    expect(result).toEqual(expectedContent);
    expect(mockFs.promises.readFile).toHaveBeenCalled();
  });

  it('should get file metadata', async () => {
    const fileId = 'test-file.json';
    const mockStats = {
      birthtime: new Date('2023-01-01'),
      mtime: new Date('2023-01-02'),
      size: 100,
    };
    const fileContent = Buffer.from('{"test": "data"}');

    mockFs.promises.stat.mockResolvedValue(mockStats);
    mockFs.promises.readFile.mockResolvedValue(fileContent);

    const result = await service.getMetaDetails(fileId);

    expect(result.fileId).toBe(fileId);
    expect(result.fileSize).toBe(100);
    expect(mockFs.promises.stat).toHaveBeenCalled();
    expect(mockFs.promises.readFile).toHaveBeenCalled();
  });

  it('should delete file', async () => {
    const fileId = 'test-file.txt';

    mockFs.promises.unlink.mockResolvedValue(undefined);

    await service.delete(fileId);

    expect(mockFs.promises.unlink).toHaveBeenCalled();
  });

  it('should check if file exists', async () => {
    const fileId = 'test-file.txt';

    mockFs.promises.access.mockResolvedValue(undefined);

    const result = await service.exists(fileId);

    expect(result).toBe(true);
    expect(mockFs.promises.access).toHaveBeenCalled();
  });

  it('should list files', async () => {
    const mockFiles = ['file1.txt', 'file2.json'];
    const mockStats = {
      isFile: () => true,
      isDirectory: () => false,
    };

    mockFs.promises.readdir.mockResolvedValue(mockFiles);
    mockFs.promises.stat.mockResolvedValue(mockStats);

    const result = await service.listFiles(STORAGE_CLASS.TEMP);

    expect(Array.isArray(result)).toBe(true);
    expect(mockFs.promises.readdir).toHaveBeenCalled();
  });

  it('should cleanup old files', async () => {
    const mockFiles = ['old-file.txt'];
    const oldFileStats = {
      birthtime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      mtime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      size: 100,
      isFile: () => true,
      isDirectory: () => false,
    };

    mockFs.promises.readdir.mockResolvedValue(mockFiles);
    mockFs.promises.stat
      .mockResolvedValueOnce({ isFile: () => true, isDirectory: () => false })
      .mockResolvedValueOnce(oldFileStats);
    mockFs.promises.readFile.mockResolvedValue(Buffer.from('old content'));
    mockFs.promises.unlink.mockResolvedValue(undefined);

    const result = await service.cleanupOldFiles(
      STORAGE_CLASS.TEMP,
      24 * 60 * 60 * 1000,
    );

    expect(typeof result).toBe('number');
    expect(mockFs.promises.readdir).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    mockFs.promises.writeFile.mockRejectedValue(new Error('Write failed'));

    const fileContent: FileContent = {
      content: 'test',
      contentType: 'text/plain',
    };

    await expect(
      service.put(fileContent, STORAGE_CLASS.TEMP),
    ).rejects.toThrow();
  });

  it('should handle file not found', async () => {
    mockFs.promises.readFile.mockRejectedValue(new Error('File not found'));

    await expect(service.get('nonexistent.txt')).rejects.toThrow();
  });

  it('should return false for non-existent file', async () => {
    mockFs.promises.access.mockRejectedValue(new Error('File not found'));

    const result = await service.exists('nonexistent.txt');

    expect(result).toBe(false);
  });

  describe('enums and interfaces', () => {
    it('should have correct storage class values', () => {
      expect(STORAGE_CLASS.TEMP).toBe('temp');
      expect(STORAGE_CLASS.SHORT_TERM).toBe('short-term');
    });
  });
});
