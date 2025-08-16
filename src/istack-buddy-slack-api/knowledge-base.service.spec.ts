import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { KnowledgeBaseService } from './knowledge-base.service';
import { of, throwError } from 'rxjs';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let httpService: HttpService;

  const mockHttpService = {
    post: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    service = module.get<KnowledgeBaseService>(KnowledgeBaseService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSearchResults', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call external API and return formatted results', async () => {
      const mockApiResponse = [
        {
          message_link:
            'https://slack.com/app_redirect?channel=C1234567890&message_ts=1234567890.123456',
          excerpt_text: 'API result text',
          relevance_score: 0.95,
          channelId: 'C1234567890',
          original_post_date: '2024-01-15T10:30:00Z',
          author: 'U1234567890',
        },
      ];

      mockHttpService.post.mockReturnValue(
        of({ data: { searchResult: mockApiResponse } }),
      );

      const results = await service.getSearchResults({
        q: 'form prefill issues',
        channels: '#cx-formstack',
      });

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:3502/istack-buddy/search/slack',
        { q: 'form prefill issues', channels: '#cx-formstack' },
      );

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(1);

      // Check structure of first result
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('message_link');
      expect(firstResult).toHaveProperty('excerpt_text');
      expect(firstResult).toHaveProperty('relevance_score');
      expect(firstResult).toHaveProperty('channelId');
      expect(firstResult).toHaveProperty('original_post_date');
      expect(firstResult).toHaveProperty('author');

      // Check that relevance score is between 0 and 1
      expect(firstResult.relevance_score).toBeGreaterThanOrEqual(0);
      expect(firstResult.relevance_score).toBeLessThanOrEqual(1);
    });

    it('should throw KNOWLEDGE_BUDDY_OFFLINE error when API call fails', async () => {
      mockHttpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(
        service.getSearchResults({ q: 'test query', channels: '#test' }),
      ).rejects.toThrow('KNOWLEDGE_BUDDY_OFFLINE');

      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:3502/istack-buddy/search/slack',
        { q: 'test query', channels: '#test' },
      );
    });

    it('should handle empty API response', async () => {
      mockHttpService.post.mockReturnValue(of({ data: { searchResult: [] } }));

      const results = await service.getSearchResults({
        q: 'no results query',
        channels: '#empty',
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    it('should handle malformed API response', async () => {
      mockHttpService.post.mockReturnValue(
        of({ data: { searchResult: 'invalid response' } }),
      );

      const results = await service.getSearchResults({
        q: 'test query',
        channels: '#invalid',
      });

      expect(results).toBeDefined();
      expect(results).toBe('invalid response');
    });

    it('should handle API response with missing fields', async () => {
      const mockApiResponse = [
        {
          message_link: 'https://slack.com/test',
          // Missing other required fields
        },
        {
          excerpt_text: 'Some text',
          relevance_score: 'invalid_score', // Invalid type
        },
      ];

      mockHttpService.post.mockReturnValue(
        of({ data: { searchResult: mockApiResponse } }),
      );

      const results = await service.getSearchResults({
        q: 'partial data query',
        channels: '#partial',
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(2);

      // Check that missing fields are returned as-is
      expect(results[0].excerpt_text).toBeUndefined();
      expect(results[1].relevance_score).toBe('invalid_score');
    });
  });
});
