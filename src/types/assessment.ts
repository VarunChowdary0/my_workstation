import { FileNode, ModelConfig } from './types';

// --- API Response Types ---

export interface AssessmentCandidate {
  id: string;
  name: string;
  email: string;
}

export interface AssessmentRound {
  id: string;
  name: string;
  type: string;
  duration_minutes: number;
  company_id: string;
}

export interface AssessmentProject {
  id: string;
  files: FileNode[];
  metadata: {
    name?: string;
    description?: string;
    language?: string;
    framework?: string;
    entrypoint?: string;
  };
  gpt_enabled?: boolean;
  aiModelId?: string;
  aiModelConfig?: ModelConfig | null;
}

export interface ExistingSubmission {
  files: FileNode[];
  sync_count: number;
  last_synced_at: string;
}

export interface VerifyTokenResponse {
  candidate: AssessmentCandidate;
  round: AssessmentRound;
  project: AssessmentProject;
  existing_submission: ExistingSubmission | null;
}

export interface SyncResponse {
  message: string;
  sync_count: number;
  last_synced_at: string;
}

export interface SubmitResponse {
  message: string;
  submitted_at: string;
  sync_count: number;
}

// --- UI State Types ---

export type AssessmentStatus =
  | 'loading'
  | 'ready'
  | 'submitted'
  | 'expired'
  | 'already_submitted'
  | 'error';
