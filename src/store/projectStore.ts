import { FileNode } from '@/mock-data/projectFiles';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// The state now includes the actions
export interface ProjectState {
  files: FileNode[];
  terminal: string;
  chat: string;
  // --- ACTIONS ---
  setFiles: (files: FileNode[]) => void;
  updateFileContent: (path: string, newContent: string) => void;
  appendToTerminal: (output: string) => void;
  clearTerminal: () => void;
}

// This type remains the same for the persisted part of the state
type StoredState = Pick<ProjectState, 'files' | 'terminal' | 'chat'>;

/**
 * A recursive helper function to update a file's content without mutating state.
 * It traverses the file tree based on the path and rebuilds the tree with the updated node.
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
      // If this is the target file (last part of the path)
      if (restOfPath.length === 0 && !node.children) {
        return { ...node, content: newContent };
      }
      // If this is a folder in the path, recurse into its children
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

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // --- INITIAL STATE ---
      files: [],
      terminal: '',
      chat: '',

      // --- ACTIONS IMPLEMENTATION ---

      /**
       * Overwrites the entire file structure.
       * @param files The new array of root FileNodes.
       */
      setFiles: (files) => set({ files }),

      /**
       * Updates the content of a single file in the tree.
       * @param path The full path to the file (e.g., "src/components/Button.tsx").
       * @param newContent The new content for the file.
       */
      updateFileContent: (path, newContent) => {
        const pathSegments = path.split('/');
        const newFiles = updateNodeByPath(
          get().files,
          pathSegments,
          newContent
        );
        set({ files: newFiles });
      },

      /**
       * Appends a new line of text to the terminal output.
       * @param output The string to append.
       */
      appendToTerminal: (output) => {
        set((state) => ({ terminal: state.terminal + '\n' + output }));
      },

      /**
       * Clears the terminal output.
       */
      clearTerminal: () => set({ terminal: '' }),
    }),
    {
      name: 'project-state-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): StoredState => ({
        files: state.files,
        chat: state.chat,
        terminal: state.terminal,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const state = (persistedState as Partial<StoredState>) || {};
        // Add any migration logic for future versions here
        return {
          files: state.files || [],
          chat: state.chat || '',
          terminal: state.terminal || '',
        };
      },
    }
  )
);