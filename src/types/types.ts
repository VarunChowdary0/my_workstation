export interface FileNode {
  name: string;
  content?: string;
  isEditable?: boolean;
  children?: FileNode[] | null;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemMessage: string;
}

export interface Project {
  id: string;
  files: FileNode[];
  metadata: {
    name?: string;
    description?: string;
    language?: string;
    framework?: string;
    runtime?: string;
    version?: string;
    entrypoint?: string;
    repository_url?: string;
    branch?: string;
    maintainers?: string[];
    license?: string;
    tags?: string[];
    scripts?: {
      dev?: string;
      build?: string;
      start?: string;
      test?: string;
    };
    dependencies?: Record<string, string>;
    dev_dependencies?: Record<string, string>;
    env?: Record<string, string>;
    docker?: {
      context?: string;
      dockerfile?: string;
      image?: string;
      target?: string;
      build_args?: Record<string, string>;
    };
  };
  gpt_enabled?: boolean;
  aiModelId?: string;
  aiModelConfig?: ModelConfig | null;
  aiModeConfigs?: Record<string, ModelConfig> | null;
}

export interface Messaage{
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}