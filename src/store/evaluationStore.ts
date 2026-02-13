import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  EvaluationStatus,
  AssessmentCandidate,
  EvaluateSecureResponse,
  ExistingEvaluation,
  FeedbackCategories,
} from '@/types/assessment';
import { FileNode } from '@/types/types';

export interface EvaluationFormData {
  score: number;
  report: string;
  feedback_categories: FeedbackCategories;
}

export interface EvaluationState {
  // Auth
  urlToken: string | null;
  secureToken: string | null;
  status: EvaluationStatus;
  errorMessage: string | null;

  // Metadata
  candidate: AssessmentCandidate | null;
  round: { id: string; name: string | null; type: string } | null;

  // Project (original template)
  projectId: string | null;
  projectFiles: FileNode[];
  projectMetadata: {
    name?: string;
    description?: string;
    language?: string;
    framework?: string;
    entrypoint?: string;
  } | null;

  // Submission (candidate's work)
  submissionId: string | null;
  submissionFiles: FileNode[];
  submittedAt: string | null;
  syncCount: number;

  // Existing evaluation (pre-fill)
  existingEvaluation: ExistingEvaluation | null;

  // Form state
  formData: EvaluationFormData;

  // Editor UI
  activeFileSource: 'project' | 'submission';
  openedFiles: Array<{ path: string; node: FileNode; source: 'project' | 'submission' }>;
  activeFile: { path: string; node: FileNode; source: 'project' | 'submission' } | null;

  // Submission state
  isSubmitting: boolean;
  reviewSubmittedAt: string | null;
  reviewSubmittedBy: string | null;

  // Actions
  setUrlToken: (token: string) => void;
  setStatus: (status: EvaluationStatus) => void;
  setError: (message: string) => void;
  initFromSecureResponse: (data: EvaluateSecureResponse) => void;

  // Form actions
  setScore: (score: number) => void;
  setReport: (report: string) => void;
  setFeedbackCategory: (name: string, value: number) => void;
  removeFeedbackCategory: (name: string) => void;
  addFeedbackCategory: (name: string, value: number) => void;

  // Editor UI actions
  setActiveFileSource: (source: 'project' | 'submission') => void;
  openFile: (file: { path: string; node: FileNode; source: 'project' | 'submission' }) => void;
  closeFile: (path: string, source: 'project' | 'submission') => void;
  setActiveFile: (file: { path: string; node: FileNode; source: 'project' | 'submission' } | null) => void;

  // Submit actions
  setIsSubmitting: (v: boolean) => void;
  markReviewSubmitted: (evaluatedAt: string, evaluatedBy: string, score: number) => void;

  reset: () => void;
}

const DEFAULT_FEEDBACK_CATEGORIES: FeedbackCategories = {
  code_quality: 0,
  completeness: 0,
  architecture: 0,
  documentation: 0,
};

const initialFormData: EvaluationFormData = {
  score: 0,
  report: '',
  feedback_categories: { ...DEFAULT_FEEDBACK_CATEGORIES },
};

const initialState = {
  urlToken: null as string | null,
  secureToken: null as string | null,
  status: 'loading' as EvaluationStatus,
  errorMessage: null as string | null,
  candidate: null as AssessmentCandidate | null,
  round: null as { id: string; name: string | null; type: string } | null,
  projectId: null as string | null,
  projectFiles: [] as FileNode[],
  projectMetadata: null as { name?: string; description?: string; language?: string; framework?: string; entrypoint?: string } | null,
  submissionId: null as string | null,
  submissionFiles: [] as FileNode[],
  submittedAt: null as string | null,
  syncCount: 0,
  existingEvaluation: null as ExistingEvaluation | null,
  formData: { ...initialFormData },
  activeFileSource: 'submission' as 'project' | 'submission',
  openedFiles: [] as Array<{ path: string; node: FileNode; source: 'project' | 'submission' }>,
  activeFile: null as { path: string; node: FileNode; source: 'project' | 'submission' } | null,
  isSubmitting: false,
  reviewSubmittedAt: null as string | null,
  reviewSubmittedBy: null as string | null,
};

export const useEvaluationStore = create<EvaluationState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setUrlToken: (token) => set({ urlToken: token }),
      setStatus: (status) => set({ status }),
      setError: (message) => set({ status: 'error', errorMessage: message }),

      initFromSecureResponse: (data: EvaluateSecureResponse) => {
        const formData: EvaluationFormData = data.existing_evaluation
          ? {
              score: data.existing_evaluation.score,
              report: data.existing_evaluation.report,
              feedback_categories: { ...data.existing_evaluation.feedback_categories },
            }
          : { ...initialFormData };

        set({
          status: 'ready',
          errorMessage: null,
          secureToken: data.secure_token,
          candidate: data.candidate,
          round: data.round,
          projectId: data.project.id,
          projectFiles: data.project.files,
          projectMetadata: data.project.metadata,
          submissionId: data.submission.id,
          submissionFiles: data.submission.files,
          submittedAt: data.submission.submitted_at,
          syncCount: data.submission.sync_count,
          existingEvaluation: data.existing_evaluation,
          formData,
        });
      },

      setScore: (score) =>
        set((state) => ({ formData: { ...state.formData, score } })),

      setReport: (report) =>
        set((state) => ({ formData: { ...state.formData, report } })),

      setFeedbackCategory: (name, value) =>
        set((state) => ({
          formData: {
            ...state.formData,
            feedback_categories: {
              ...state.formData.feedback_categories,
              [name]: value,
            },
          },
        })),

      removeFeedbackCategory: (name) =>
        set((state) => {
          const { [name]: _, ...rest } = state.formData.feedback_categories;
          return {
            formData: {
              ...state.formData,
              feedback_categories: rest,
            },
          };
        }),

      addFeedbackCategory: (name, value) =>
        set((state) => ({
          formData: {
            ...state.formData,
            feedback_categories: {
              ...state.formData.feedback_categories,
              [name]: value,
            },
          },
        })),

      setActiveFileSource: (source) => set({ activeFileSource: source }),

      openFile: (file) =>
        set((state) => {
          const exists = state.openedFiles.some(
            (f) => f.source === file.source && f.path === file.path
          );
          return {
            openedFiles: exists ? state.openedFiles : [...state.openedFiles, file],
            activeFile: file,
          };
        }),

      closeFile: (path, source) =>
        set((state) => {
          const newFiles = state.openedFiles.filter(
            (f) => !(f.path === path && f.source === source)
          );
          const newActive =
            state.activeFile?.path === path && state.activeFile?.source === source
              ? newFiles[newFiles.length - 1] || null
              : state.activeFile;
          return { openedFiles: newFiles, activeFile: newActive };
        }),

      setActiveFile: (file) => set({ activeFile: file }),

      setIsSubmitting: (v) => set({ isSubmitting: v }),

      markReviewSubmitted: (evaluatedAt, evaluatedBy, score) =>
        set({
          status: 'submitted',
          isSubmitting: false,
          reviewSubmittedAt: evaluatedAt,
          reviewSubmittedBy: evaluatedBy,
          formData: { ...get().formData, score },
        }),

      reset: () => set({ ...initialState, formData: { ...initialFormData } }),
    }),
    {
      name: 'evaluation-state-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        urlToken: state.urlToken,
        secureToken: state.secureToken,
        status: state.status,
        candidate: state.candidate,
        round: state.round,
        projectId: state.projectId,
        projectFiles: state.projectFiles,
        projectMetadata: state.projectMetadata,
        submissionId: state.submissionId,
        submissionFiles: state.submissionFiles,
        submittedAt: state.submittedAt,
        syncCount: state.syncCount,
        existingEvaluation: state.existingEvaluation,
        formData: state.formData,
        openedFiles: state.openedFiles,
      }),
    }
  )
);
