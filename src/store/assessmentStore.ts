import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  AssessmentStatus,
  AssessmentCandidate,
  AssessmentRound,
  AssessmentProject,
  VerifyTokenResponse,
} from '@/types/assessment';
import { FileNode, ModelConfig } from '@/types/types';

/**
 * Recursive helper to update a file's content in the tree without mutation.
 * Duplicated from projectStore since it's a pure function.
 */
const updateNodeByPath = (
  nodes: FileNode[],
  path: string[],
  newContent: string
): FileNode[] => {
  const [currentNodeName, ...restOfPath] = path;
  if (!currentNodeName) return nodes;

  return nodes.map((node) => {
    if (node.name === currentNodeName) {
      if (restOfPath.length === 0 && !node.children) {
        return { ...node, content: newContent };
      }
      if (node.children) {
        return {
          ...node,
          children: updateNodeByPath(node.children, restOfPath, newContent),
        };
      }
    }
    return node;
  });
};

export interface AssessmentState {
  // Auth
  token: string | null;
  status: AssessmentStatus;
  errorMessage: string | null;

  // Metadata
  candidate: AssessmentCandidate | null;
  round: AssessmentRound | null;
  project: AssessmentProject | null;

  // File state
  files: FileNode[];

  // Timer
  startedAt: number | null;
  durationMinutes: number | null;

  // Sync state
  syncCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;

  // Submission
  isSubmitting: boolean;
  submittedAt: string | null;

  // AI config
  gptEnabled: boolean;
  aiModelId?: string;
  aiModelConfig?: ModelConfig | null;

  // Editor UI
  openedFiles: Array<{ path: string; node: FileNode }>;
  showCopilot: boolean;

  // Actions
  setToken: (token: string) => void;
  setStatus: (status: AssessmentStatus) => void;
  setError: (message: string) => void;
  initFromVerification: (data: VerifyTokenResponse) => void;
  setFiles: (files: FileNode[]) => void;
  updateFileContent: (path: string, newContent: string) => void;
  setSyncState: (syncCount: number, lastSyncedAt: string) => void;
  setIsSyncing: (v: boolean) => void;
  setIsSubmitting: (v: boolean) => void;
  markSubmitted: (submittedAt: string, syncCount: number) => void;
  setOpenedFiles: (files: Array<{ path: string; node: FileNode }>) => void;
  addOpenedFile: (file: { path: string; node: FileNode }) => void;
  removeOpenedFile: (path: string) => void;
  setShowCopilot: (show: boolean) => void;
  toggleCopilot: () => void;
  reset: () => void;
}

const initialState = {
  token: null as string | null,
  status: 'loading' as AssessmentStatus,
  errorMessage: null as string | null,
  candidate: null as AssessmentCandidate | null,
  round: null as AssessmentRound | null,
  project: null as AssessmentProject | null,
  files: [] as FileNode[],
  startedAt: null as number | null,
  durationMinutes: null as number | null,
  syncCount: 0,
  lastSyncedAt: null as string | null,
  isSyncing: false,
  isSubmitting: false,
  submittedAt: null as string | null,
  gptEnabled: false,
  aiModelId: undefined as string | undefined,
  aiModelConfig: null as ModelConfig | null | undefined,
  openedFiles: [] as Array<{ path: string; node: FileNode }>,
  showCopilot: false,
};

export const useAssessmentStore = create<AssessmentState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setToken: (token) => set({ token }),
      setStatus: (status) => set({ status }),
      setError: (message) => set({ status: 'error', errorMessage: message }),

      initFromVerification: (data: VerifyTokenResponse) => {
        const files = data.existing_submission?.files ?? data.project.files;
        set({
          status: 'ready',
          errorMessage: null,
          candidate: data.candidate,
          round: data.round,
          project: data.project,
          files,
          durationMinutes: data.round.duration_minutes,
          startedAt: Date.now(),
          gptEnabled: data.project.gpt_enabled ?? false,
          aiModelId: data.project.aiModelId,
          aiModelConfig: data.project.aiModelConfig,
          syncCount: data.existing_submission?.sync_count ?? 0,
          lastSyncedAt: data.existing_submission?.last_synced_at ?? null,
          showCopilot: data.project.gpt_enabled ?? false,
        });
      },

      setFiles: (files) => set({ files }),

      updateFileContent: (path, newContent) => {
        const pathSegments = path.split('/');
        const newFiles = updateNodeByPath(get().files, pathSegments, newContent);
        set({ files: newFiles });
      },

      setSyncState: (syncCount, lastSyncedAt) => set({ syncCount, lastSyncedAt }),
      setIsSyncing: (v) => set({ isSyncing: v }),
      setIsSubmitting: (v) => set({ isSubmitting: v }),

      markSubmitted: (submittedAt, syncCount) =>
        set({
          status: 'submitted',
          submittedAt,
          syncCount,
          isSubmitting: false,
        }),

      setOpenedFiles: (files) => set({ openedFiles: files }),
      addOpenedFile: (file) =>
        set((state) => ({
          openedFiles: state.openedFiles.some((f) => f.path === file.path)
            ? state.openedFiles
            : [...state.openedFiles, file],
        })),
      removeOpenedFile: (path) =>
        set((state) => ({
          openedFiles: state.openedFiles.filter((f) => f.path !== path),
        })),

      setShowCopilot: (show) => set({ showCopilot: show }),
      toggleCopilot: () => set((state) => ({ showCopilot: !state.showCopilot })),

      reset: () => set({ ...initialState }),
    }),
    {
      name: 'assessment-state-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        token: state.token,
        status: state.status,
        candidate: state.candidate,
        round: state.round,
        project: state.project,
        files: state.files,
        startedAt: state.startedAt,
        durationMinutes: state.durationMinutes,
        syncCount: state.syncCount,
        lastSyncedAt: state.lastSyncedAt,
        submittedAt: state.submittedAt,
        gptEnabled: state.gptEnabled,
        aiModelId: state.aiModelId,
        aiModelConfig: state.aiModelConfig,
        openedFiles: state.openedFiles,
      }),
    }
  )
);
