export type ModelProvider = "mib007" | "openai" | "anthropic" | "ollama" | "custom";

export interface ModelConfig {
  provider: ModelProvider;
  metered: boolean;
  byom: {
    enabled: boolean;
    provider: ModelProvider | "";
    apiKey: string;
    model: string;
    endpoint: string;   // for ollama/custom
  };
}
