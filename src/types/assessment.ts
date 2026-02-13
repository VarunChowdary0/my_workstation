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

// --- Evaluation API Types ---

export interface EvaluationSubmission {
  id: string;
  files: FileNode[];
  submitted_at: string;
  sync_count: number;
}

export interface FeedbackCategories {
  [key: string]: number;
}

export interface ExistingEvaluation {
  score: number;
  report: string;
  feedback_categories: FeedbackCategories;
  evaluated_by: string;
  evaluated_at: string;
}

export interface EvaluateSecureResponse {
  secure_token: string;
  expires_in_seconds: number;
  candidate: AssessmentCandidate;
  round: {
    id: string;
    name: string | null;
    type: string;
  };
  project: {
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
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
    };
  };
  submission: EvaluationSubmission;
  existing_evaluation: ExistingEvaluation | null;
}

export interface SubmitReviewResponse {
  message: string;
  score: number;
  evaluated_at: string;
  evaluated_by: string;
}

export type EvaluationStatus =
  | 'loading'
  | 'ready'
  | 'expired'
  | 'error'
  | 'not_found'
  | 'forbidden'
  | 'submitting'
  | 'submitted';
