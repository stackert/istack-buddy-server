import Anthropic from '@anthropic-ai/sdk';
import { slackyToolSet } from './slacky';
import { marvToolSet, formOverviewToolSet } from './marv';

// Base tool catalog interface
interface IToolCatalog {
  toolDefinitions: Anthropic.Messages.Tool[];
  executeToolCall: (
    toolName: string,
    toolArgs: any,
  ) => string | Promise<string> | any | undefined;
}

// Compose multiple tool catalogs into a single tool set
const createCompositeToolSet = (...catalogs: IToolCatalog[]) => ({
  toolDefinitions: catalogs.flatMap((catalog) => catalog.toolDefinitions),

  executeToolCall: async (toolName: string, toolArgs: any) => {
    // Try each catalog in order until one handles the tool
    for (const catalog of catalogs) {
      const result = catalog.executeToolCall(toolName, toolArgs);

      // If result is defined, this catalog handled the tool
      if (result !== undefined) {
        return await result; // Handle both sync and async results
      }
    }

    // No catalog handled this tool
    throw new Error(
      `Unknown tool: ${toolName}. Available tools: ${catalogs
        .flatMap((c) => c.toolDefinitions.map((t) => t.name))
        .join(', ')}`,
    );
  },
});

// Pre-configured tool sets for common use cases
const anthropicToolSet = createCompositeToolSet(
  slackyToolSet,
  formOverviewToolSet,
);

// Comprehensive tool set for Slack integration with ALL anthropic tools
const slackyComprehensiveToolSet = createCompositeToolSet(
  slackyToolSet,
  marvToolSet,
  formOverviewToolSet,
);

const slackyOnlyToolSet = createCompositeToolSet(slackyToolSet);
const marvOnlyToolSet = createCompositeToolSet(marvToolSet);

export {
  createCompositeToolSet,
  anthropicToolSet,
  slackyComprehensiveToolSet,
  slackyOnlyToolSet,
  marvOnlyToolSet,
};

export type { IToolCatalog };
