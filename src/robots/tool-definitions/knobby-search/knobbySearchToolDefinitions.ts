import OpenAI from 'openai';
import { KnobbySearchToolsEnum } from './types';

export const knobbySearchToolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  // Tool 1: PreQuery Analysis
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.PreQuery,
      description: 'Analyze and enhance a user query by extracting terms, keywords, domains, and metadata for search optimization',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Raw user query text to analyze',
            maxLength: 1000
          },
          minConfidence: {
            type: 'number',
            description: 'Minimum confidence threshold (0.0 to 1.0)',
            minimum: 0,
            maximum: 1
          },
          pageSize: {
            type: 'number',
            description: 'Maximum results per knowledge base (max 25)',
            minimum: 1,
            maximum: 25
          }
        },
        required: ['query']
      }
    }
  },

  // Tool 2: Keyword Search
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.KeywordSearch,
      description: 'Search knowledge bases using extracted keywords from preQuery analysis',
      parameters: {
        type: 'object',
        properties: {
          keywords: {
            type: 'array',
            items: { type: 'string' },
            description: 'Keywords from preQuery analysis'
          },
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional channel IDs to limit scope'
          },
          maxConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: 'number',
            minimum: 1
          }
        },
        required: ['keywords']
      }
    }
  },

  // Tool 3: Noun Search
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.NounSearch,
      description: 'Search knowledge bases using extracted nouns from preQuery analysis',
      parameters: {
        type: 'object',
        properties: {
          nouns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Nouns from preQuery analysis'
          },
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional channel IDs to limit scope'
          },
          maxConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: 'number',
            minimum: 1
          }
        },
        required: ['nouns']
      }
    }
  },

  // Tool 4: Proper Noun Search
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.ProperNounSearch,
      description: 'Search knowledge bases using extracted proper nouns (technologies, brands) from preQuery analysis',
      parameters: {
        type: 'object',
        properties: {
          properNouns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Proper nouns from preQuery analysis'
          },
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional channel IDs to limit scope'
          },
          maxConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: 'number',
            minimum: 1
          }
        },
        required: ['properNouns']
      }
    }
  },

  // Tool 5: Domain Search
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.DomainSearch,
      description: 'Search knowledge bases by domain categories (authentication, security, etc.) from preQuery analysis',
      parameters: {
        type: 'object',
        properties: {
          domains: {
            type: 'array',
            items: { type: 'string' },
            description: 'Domain categories from preQuery analysis'
          },
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional channel IDs to limit scope'
          },
          maxConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: 'number',
            minimum: 1
          }
        },
        required: ['domains']
      }
    }
  },

  // Tool 6: Free Text Search
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.FreeTextSearch,
      description: 'Search knowledge bases using free text terms from preQuery analysis',
      parameters: {
        type: 'object',
        properties: {
          freeText: {
            type: 'array',
            items: { type: 'string' },
            description: 'Free text terms from preQuery analysis'
          },
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional channel IDs to limit scope'
          },
          maxConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: 'number',
            minimum: 1
          }
        },
        required: ['freeText']
      }
    }
  },

  // Tool 7: Semantic Search
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.SemanticSearch,
      description: 'AI-powered semantic search using natural language understanding',
      parameters: {
        type: 'object',
        properties: {
          userPromptText: {
            type: 'string',
            description: 'User prompt text for semantic analysis'
          },
          channelIds: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional channel IDs to limit scope'
          },
          maxConfidence: {
            type: 'number',
            minimum: 0,
            maximum: 1
          },
          limit: {
            type: 'number',
            minimum: 1
          }
        },
        required: ['userPromptText']
      }
    }
  },

  // Tool 8: Comprehensive Search (RECOMMENDED)
  {
    type: 'function',
    function: {
      name: KnobbySearchToolsEnum.Comprehensive,
      description: 'RECOMMENDED: Complete two-step search workflow. Analyzes user query with preQuery, then executes comprehensive search using top-results endpoint. This is the most efficient approach for getting comprehensive results from all applicable search types.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Raw user query text to analyze and search',
            maxLength: 1000
          },
          limit: {
            type: 'number',
            description: 'Maximum results per search type (max 25)',
            minimum: 1,
            maximum: 25
          }
        },
        required: ['query']
      }
    }
  }
];
