import OpenAI from 'openai';

// Knobby Search tool names enum
export enum KnobbySearchToolsEnum {
  PreQuery = 'knobby_search_prequery',
  KeywordSearch = 'knobby_search_keyword',
  NounSearch = 'knobby_search_noun',
  ProperNounSearch = 'knobby_search_proper_noun',
  DomainSearch = 'knobby_search_domain',
  FreeTextSearch = 'knobby_search_free_text',
  SemanticSearch = 'knobby_search_semantic',
  Comprehensive = 'knobby_search_comprehensive'
}

// Main tool set type for OpenAI Knobby Search tools
export type TOpenAIKnobbySearchToolSet = {
  toolDefinitions: OpenAI.Chat.Completions.ChatCompletionTool[];
  executeToolCall: (
    toolName: string,
    toolArgs: any,
  ) => string | Promise<string>;
};

// Arguments for PreQuery tool
export interface IPreQueryArgs {
  query: string;
  minConfidence?: number;
  pageSize?: number;
}

// Arguments for Keyword Search tool
export interface IKeywordSearchArgs {
  keywords: string[];
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
}

// Arguments for Noun Search tool
export interface INounSearchArgs {
  nouns: string[];
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
}

// Arguments for Proper Noun Search tool
export interface IProperNounSearchArgs {
  properNouns: string[];
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
}

// Arguments for Domain Search tool
export interface IDomainSearchArgs {
  domains: string[];
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
}

// Arguments for Free Text Search tool
export interface IFreeTextSearchArgs {
  freeText: string[];
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
}

// Arguments for Semantic Search tool
export interface ISemanticSearchArgs {
  userPromptText: string;
  channelIds?: string[];
  maxConfidence?: number;
  limit?: number;
}
