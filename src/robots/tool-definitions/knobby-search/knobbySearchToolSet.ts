import { knobbySearchToolDefinitions } from './knobbySearchToolDefinitions';
import { KnobbySearchToolsEnum } from './types';
import type {
  IPreQueryArgs,
  IKeywordSearchArgs,
  INounSearchArgs,
  IProperNounSearchArgs,
  IDomainSearchArgs,
  IFreeTextSearchArgs,
  ISemanticSearchArgs,
  TOpenAIKnobbySearchToolSet
} from './types';

// Base URL for Information Services API
const INFO_SERVICES_BASE_URL = 'http://localhost:3505/information-services';

// Helper function to get authentication token from environment
const getAuthToken = (): string => {
  // Try the env variable first, fallback to the known dev token
  const token = process.env.ISTACK_BUDDY_INFO_SERVICES_BEARER_TOKEN || 'istack-buddy-dev-token-2024';
  return token;
};

// Helper function to make HTTP requests to Information Services API
const makeInfoServicesRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any
): Promise<any> => {
  try {
    const token = getAuthToken();
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const config: RequestInit = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    const fullUrl = `${INFO_SERVICES_BASE_URL}${endpoint}`;
    console.log(`KnobbySearch: Making ${method} request to ${fullUrl}`);
    
    const response = await fetch(fullUrl, config);
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Information Services API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Information Services request timeout after 30 seconds: ${endpoint}`);
    }
    console.error(`KnobbySearch API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw new Error(`Information Services request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Tool execution handler
const performKnobbySearchToolCall = async (
  toolName: string,
  toolArgs: any,
): Promise<string> => {
  try {
    let result: any;

    switch (toolName as KnobbySearchToolsEnum) {
      case KnobbySearchToolsEnum.PreQuery:
        {
          const args = toolArgs as IPreQueryArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/preQuery', 'POST', {
            query: args.query,
            minConfidence: args.minConfidence || 0.7,
            pageSize: args.pageSize || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.KeywordSearch:
        {
          const args = toolArgs as IKeywordSearchArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/keyword-search', 'POST', {
            keywords: args.keywords,
            channelIds: args.channelIds,
            maxConfidence: args.maxConfidence || 1,
            limit: args.limit || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.NounSearch:
        {
          const args = toolArgs as INounSearchArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/noun-search', 'POST', {
            nouns: args.nouns,
            channelIds: args.channelIds,
            maxConfidence: args.maxConfidence || 1,
            limit: args.limit || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.ProperNounSearch:
        {
          const args = toolArgs as IProperNounSearchArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/proper-noun-search', 'POST', {
            properNouns: args.properNouns,
            channelIds: args.channelIds,
            maxConfidence: args.maxConfidence || 1,
            limit: args.limit || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.DomainSearch:
        {
          const args = toolArgs as IDomainSearchArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/domain-search', 'POST', {
            domains: args.domains,
            channelIds: args.channelIds,
            maxConfidence: args.maxConfidence || 1,
            limit: args.limit || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.FreeTextSearch:
        {
          const args = toolArgs as IFreeTextSearchArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/free-text-search', 'POST', {
            freeText: args.freeText,
            channelIds: args.channelIds,
            maxConfidence: args.maxConfidence || 1,
            limit: args.limit || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.SemanticSearch:
        {
          const args = toolArgs as ISemanticSearchArgs;
          result = await makeInfoServicesRequest('/knowledge-bases/semantic-search', 'POST', {
            userPromptText: args.userPromptText,
            channelIds: args.channelIds,
            maxConfidence: args.maxConfidence || 1,
            limit: args.limit || 10
          });
        }
        break;

      case KnobbySearchToolsEnum.Comprehensive:
        {
          const args = toolArgs as { query: string; limit?: number };
          
          // Step 1: Call preQuery to analyze the user query
          const preQueryResult = await makeInfoServicesRequest('/knowledge-bases/preQuery', 'POST', {
            query: args.query,
            minConfidence: 0.7,
            pageSize: args.limit || 10
          });
          
          // Step 2: Use the preQuery result with top-results for comprehensive search
          result = await makeInfoServicesRequest('/knowledge-bases/top-results', 'POST', preQueryResult);
          
          // Add metadata about the comprehensive search process
          const comprehensiveResult = {
            searchType: 'comprehensive',
            query: args.query,
            preQueryAnalysis: {
              keywords: preQueryResult.keywords || [],
              nouns: preQueryResult.nouns || [],
              domains: preQueryResult.domains || [],
              aiTechnicalObservation: preQueryResult.aiTechnicalObservation || ''
            },
            results: result
          };
          
          result = comprehensiveResult;
        }
        break;

      default:
        throw new Error(`Unknown KnobbySearch tool: ${toolName}`);
    }

    // Format the result as a string for the robot
    // For preQuery, exclude chunk_embedding from display but keep it for internal use
    if (toolName === KnobbySearchToolsEnum.PreQuery && result.chunks) {
      const displayResult = {
        ...result,
        chunks: result.chunks.map((chunk: any) => {
          const { chunk_embedding, ...chunkWithoutEmbedding } = chunk;
          return chunkWithoutEmbedding;
        })
      };
      return JSON.stringify(displayResult, null, 2);
    }
    
    return JSON.stringify(result, null, 2);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return `Error executing ${toolName}: ${errorMessage}`;
  }
};

// Export the complete tool set
export const knobbySearchToolSet: TOpenAIKnobbySearchToolSet = {
  toolDefinitions: knobbySearchToolDefinitions,
  executeToolCall: performKnobbySearchToolCall,
};
