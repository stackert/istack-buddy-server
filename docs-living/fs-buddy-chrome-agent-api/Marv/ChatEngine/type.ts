interface IOpenAiConfig {
  // *tmc* this will need to be renamed because its both openAi and formstack auth config
  // also we'll want to configure fs endpoint here, so that it can be changed for dev environment
  apiKey: string;
  modelName: string;
  // fsApiKey: string;
}

export type { IOpenAiConfig };
