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
  TOpenAIKnobbySearchToolSet,
} from './types';

// Base URL for Information Services API - loaded at runtime to ensure env vars are available
const getInfoServicesBaseUrl = (): string => {
  const url = process.env.INFORMATION_SERVICES_URL;
  console.log(`[KNOBBY-SEARCH-ENV] INFORMATION_SERVICES_URL: ${url}`);
  console.log(
    `[KNOBBY-SEARCH-ENV] All env vars starting with INFO:`,
    Object.keys(process.env).filter((key) => key.startsWith('INFO')),
  );
  if (!url) {
    throw new Error('INFORMATION_SERVICES_URL environment variable is not set');
  }
  return url;
};

// Helper function to get authentication token from environment
const getAuthToken = (): string => {
  // Try the env variable first, fallback to the known dev token
  const token =
    process.env.ISTACK_BUDDY_INFO_SERVICES_BEARER_TOKEN ||
    'istack-buddy-dev-token-2024';
  return token;
};

// Health check function
const checkHealth = async (): Promise<boolean> => {
  try {
    const INFO_SERVICES_BASE_URL = getInfoServicesBaseUrl();
    const healthUrl = `${INFO_SERVICES_BASE_URL}/health`;
    console.log(`[KNOBBY-SEARCH-HEALTH] Checking health at: ${healthUrl}`);

    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout for health check
    });

    const isHealthy = response.ok;
    console.log(
      `[KNOBBY-SEARCH-HEALTH] Health check result: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'} (${response.status})`,
    );
    return isHealthy;
  } catch (error) {
    console.log(
      `[KNOBBY-SEARCH-HEALTH] Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    return false;
  }
};

// Helper function to make HTTP requests to Information Services API
const makeInfoServicesRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: any,
): Promise<any> => {
  try {
    // Check health first
    const isHealthy = await checkHealth();
    if (!isHealthy) {
      throw new Error('Knowledge Buddy is out sick presently');
    }

    const token = getAuthToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
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

    const INFO_SERVICES_BASE_URL = getInfoServicesBaseUrl();
    const fullUrl = `${INFO_SERVICES_BASE_URL}${endpoint}`;
    console.log(`[KNOBBY-SEARCH-API] Making ${method} request to ${fullUrl}`);
    console.log(
      `[KNOBBY-SEARCH-API] Request body: ${body ? JSON.stringify(body, null, 2) : 'none'}`,
    );

    const response = await fetch(fullUrl, config);
    clearTimeout(timeoutId);

    console.log(
      `[KNOBBY-SEARCH-API] Response status: ${response.status} ${response.statusText}`,
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[KNOBBY-SEARCH-API] Error response body: ${errorText}`);
      //DEV-DEBUG-TODO Remove url
      throw new Error(
        `Server ${fullUrl} error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const responseData = await response.json();
    console.log(
      `[KNOBBY-SEARCH-API] Response data: ${JSON.stringify(responseData, null, 2)}`,
    );
    return responseData;
  } catch (error) {
    const INFO_SERVICES_BASE_URL = getInfoServicesBaseUrl();
    if (error.name === 'AbortError') {
      //DEV-DEBUG-TODO Remove url
      throw new Error(
        `Server ${INFO_SERVICES_BASE_URL}${endpoint} timeout after 30 seconds`,
      );
    }
    console.error(
      `KnobbySearch API Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
    //DEV-DEBUG-TODO Remove url
    throw new Error(
      `Server ${INFO_SERVICES_BASE_URL}${endpoint} connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
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
          result = await makeInfoServicesRequest(
            '/knowledge-bases/preQuery',
            'POST',
            {
              query: args.query,
              minConfidence: args.minConfidence || 0.7,
              pageSize: args.pageSize || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.KeywordSearch:
        {
          const args = toolArgs as IKeywordSearchArgs;
          result = await makeInfoServicesRequest(
            '/knowledge-bases/keyword-search',
            'POST',
            {
              keywords: args.keywords,
              channelIds: args.channelIds,
              maxConfidence: args.maxConfidence || 1,
              limit: args.limit || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.NounSearch:
        {
          const args = toolArgs as INounSearchArgs;
          result = await makeInfoServicesRequest(
            '/knowledge-bases/noun-search',
            'POST',
            {
              nouns: args.nouns,
              channelIds: args.channelIds,
              maxConfidence: args.maxConfidence || 1,
              limit: args.limit || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.ProperNounSearch:
        {
          const args = toolArgs as IProperNounSearchArgs;
          result = await makeInfoServicesRequest(
            '/knowledge-bases/proper-noun-search',
            'POST',
            {
              properNouns: args.properNouns,
              channelIds: args.channelIds,
              maxConfidence: args.maxConfidence || 1,
              limit: args.limit || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.DomainSearch:
        {
          const args = toolArgs as IDomainSearchArgs;
          result = await makeInfoServicesRequest(
            '/knowledge-bases/domain-search',
            'POST',
            {
              domains: args.domains,
              channelIds: args.channelIds,
              maxConfidence: args.maxConfidence || 1,
              limit: args.limit || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.FreeTextSearch:
        {
          const args = toolArgs as IFreeTextSearchArgs;
          result = await makeInfoServicesRequest(
            '/knowledge-bases/free-text-search',
            'POST',
            {
              freeText: args.freeText,
              channelIds: args.channelIds,
              maxConfidence: args.maxConfidence || 1,
              limit: args.limit || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.SemanticSearch:
        {
          const args = toolArgs as ISemanticSearchArgs;
          result = await makeInfoServicesRequest(
            '/knowledge-bases/semantic-search',
            'POST',
            {
              userPromptText: args.userPromptText,
              channelIds: args.channelIds,
              maxConfidence: args.maxConfidence || 1,
              limit: args.limit || 10,
            },
          );
        }
        break;

      case KnobbySearchToolsEnum.Comprehensive:
        {
          const args = toolArgs as { query: string; limit?: number };

          // Step 1: Call preQuery to analyze the user query
          const preQueryResult = await makeInfoServicesRequest(
            '/knowledge-bases/preQuery',
            'POST',
            {
              query: args.query,
              minConfidence: 0.7,
              pageSize: args.limit || 10,
            },
          );

          // Step 2: Use the preQuery result with top-results for comprehensive search
          result = await makeInfoServicesRequest(
            '/knowledge-bases/top-results',
            'POST',
            preQueryResult,
          );

          // Add metadata about the comprehensive search process
          const comprehensiveResult = {
            searchType: 'comprehensive',
            query: args.query,
            preQueryAnalysis: {
              keywords: preQueryResult.keywords || [],
              nouns: preQueryResult.nouns || [],
              domains: preQueryResult.domains || [],
              aiTechnicalObservation:
                preQueryResult.aiTechnicalObservation || '',
            },
            results: result,
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
        }),
      };
      return JSON.stringify(displayResult, null, 2);
    }

    return JSON.stringify(result, null, 2);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred';
    return `Error executing ${toolName}: ${errorMessage}`;
  }
};

// Export the complete tool set
export const knobbySearchToolSet: TOpenAIKnobbySearchToolSet = {
  toolDefinitions: knobbySearchToolDefinitions,
  executeToolCall: performKnobbySearchToolCall,
};
