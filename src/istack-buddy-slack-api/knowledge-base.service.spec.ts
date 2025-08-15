import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeBaseService } from './knowledge-base.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeBaseService],
    }).compile();

    service = module.get<KnowledgeBaseService>(KnowledgeBaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSearchResults', () => {
    it('should return fake search results for slack:cx-formstack', async () => {
      const results = await service.getSearchResults({
        kb: 'slack:cx-formstack',
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Check structure of first result
      const firstResult = results[0];
      expect(firstResult).toHaveProperty('message_link');
      expect(firstResult).toHaveProperty('excerpt_text');
      expect(firstResult).toHaveProperty('relevance_score');
      expect(firstResult).toHaveProperty('original_post_date');
      expect(firstResult).toHaveProperty('author');

      // Check that relevance score is between 0 and 1
      expect(firstResult.relevance_score).toBeGreaterThanOrEqual(0);
      expect(firstResult.relevance_score).toBeLessThanOrEqual(1);

      // Check that excerpt text contains "Forms Core" for cx-formstack
      expect(firstResult.excerpt_text).toContain('Forms Core');
      // Check that excerpt text contains the search parameters
      expect(firstResult.excerpt_text).toContain('{kb: slack:cx-formstack}');
    });

    it('should return fake search results for slack:forms-sso-autofill', async () => {
      const results = await service.getSearchResults({
        kb: 'slack:forms-sso-autofill',
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Check that excerpt text contains "SSO" for forms-sso-autofill
      const firstResult = results[0];
      expect(firstResult.excerpt_text).toContain('SSO');
      // Check that excerpt text contains the search parameters
      expect(firstResult.excerpt_text).toContain(
        '{kb: slack:forms-sso-autofill}',
      );
    });

    it('should return fake search results for slack:cx-f4sf', async () => {
      const results = await service.getSearchResults({ kb: 'slack:cx-f4sf' });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Check that excerpt text contains "F4SF" for cx-f4sf
      const firstResult = results[0];
      expect(firstResult.excerpt_text).toContain('F4SF');
      // Check that excerpt text contains the search parameters
      expect(firstResult.excerpt_text).toContain('{kb: slack:cx-f4sf}');
    });

    it('should return fake search results for slack:all', async () => {
      const results = await service.getSearchResults({ kb: 'slack:all' });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Check that excerpt text contains original content for slack:all
      const firstResult = results[0];
      expect(firstResult.excerpt_text).toContain('form configuration');
      // Check that excerpt text contains the search parameters
      expect(firstResult.excerpt_text).toContain('{kb: slack:all}');
    });

    it('should return fake search results for unknown channel', async () => {
      const results = await service.getSearchResults({
        kb: 'slack:unknown-channel',
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(3);

      // Check that excerpt text contains the search parameters
      const firstResult = results[0];
      expect(firstResult.excerpt_text).toContain('{kb: slack:unknown-channel}');
    });
  });
});
