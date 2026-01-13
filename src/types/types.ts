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

// Jupyter Notebook types
export interface NotebookOutput {
  output_type: "stream" | "execute_result" | "display_data" | "error";
  name?: string; // for stream: "stdout" | "stderr"
  text?: string[]; // for stream output
  data?: Record<string, unknown>; // for execute_result/display_data
  execution_count?: number;
  ename?: string; // for error
  evalue?: string; // for error
  traceback?: string[]; // for error
}

export interface NotebookCell {
  id?: string;
  cell_type: "code" | "markdown" | "raw";
  source: string | string[];
  metadata?: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: NotebookOutput[];
}

export interface NotebookContent {
  cells: NotebookCell[];
  metadata: {
    kernelspec?: {
      display_name: string;
      language: string;
      name: string;
    };
    language_info?: {
      name: string;
      version: string;
    };
  };
  nbformat: number;
  nbformat_minor: number;
}