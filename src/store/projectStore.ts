import { FileNode, Messaage, ModelConfig } from '@/types/types';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// The state now includes the actions
export interface ProjectState {
  files: FileNode[];
  terminal: string;
  chat: string;
  // Chat state
  chatMessages: Messaage[]
  isTyping: boolean;
  // AI config
  aiModelId?: string;
  aiModelConfig?: ModelConfig | null;
  // Opened files tracking
  openedFiles: Array<{ path: string; node: FileNode }>;
  // UI visibility
  showCopilot: boolean;
  // --- ACTIONS ---
  setFiles: (files: FileNode[]) => void;
  updateFileContent: (path: string, newContent: string) => void;
  // File operations
  createFile: (parentPath: string, fileName: string, content?: string) => void;
  createFolder: (parentPath: string, folderName: string) => void;
  renameNode: (path: string, newName: string) => void;
  deleteNode: (path: string) => void;
  appendToTerminal: (output: string) => void;
  clearTerminal: () => void;
  addChatMessage: (msg: { role: 'user' | 'assistant' | 'system'; content: string; timestamp?: string }) => void;
  clearChat: () => void;
  setTyping: (v: boolean) => void;
  setAiInfo: (aiModelId?: string, aiModelConfig?: ModelConfig | null) => void;
  setOpenedFiles: (files: Array<{ path: string; node: FileNode }>) => void;
  addOpenedFile: (file: { path: string; node: FileNode }) => void;
  removeOpenedFile: (path: string) => void;
  setShowCopilot: (show: boolean) => void;
  toggleCopilot: () => void;
}

// This type remains the same for the persisted part of the state
type StoredState = Pick<ProjectState, 'files' | 'terminal' | 'chat' | 'chatMessages' | 'aiModelId' | 'aiModelConfig' | 'openedFiles'>;

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

/**
 * Helper to add a new node (file or folder) to a specific path in the tree
 */
const addNodeToPath = (
  nodes: FileNode[],
  parentPath: string[],
  newNode: FileNode
): FileNode[] => {
  // If parentPath is empty, add to root
  if (parentPath.length === 0) {
    return [...nodes, newNode];
  }

  const [currentNodeName, ...restOfPath] = parentPath;

  return nodes.map((node) => {
    if (node.name === currentNodeName && node.children) {
      if (restOfPath.length === 0) {
        // This is the target folder, add the new node here
        return {
          ...node,
          children: [...node.children, newNode],
        };
      }
      // Continue traversing
      return {
        ...node,
        children: addNodeToPath(node.children, restOfPath, newNode),
      };
    }
    return node;
  });
};

/**
 * Helper to rename a node at a specific path
 */
const renameNodeAtPath = (
  nodes: FileNode[],
  path: string[],
  newName: string
): FileNode[] => {
  const [currentNodeName, ...restOfPath] = path;
  if (!currentNodeName) return nodes;

  return nodes.map((node) => {
    if (node.name === currentNodeName) {
      if (restOfPath.length === 0) {
        // This is the target node, rename it
        return { ...node, name: newName };
      }
      // Continue traversing if it's a folder
      if (node.children) {
        return {
          ...node,
          children: renameNodeAtPath(node.children, restOfPath, newName),
        };
      }
    }
    return node;
  });
};

/**
 * Helper to delete a node at a specific path
 */
const deleteNodeAtPath = (
  nodes: FileNode[],
  path: string[]
): FileNode[] => {
  const [currentNodeName, ...restOfPath] = path;
  if (!currentNodeName) return nodes;

  // If this is the last segment, filter out the node
  if (restOfPath.length === 0) {
    return nodes.filter((node) => node.name !== currentNodeName);
  }

  // Otherwise, traverse into children
  return nodes.map((node) => {
    if (node.name === currentNodeName && node.children) {
      return {
        ...node,
        children: deleteNodeAtPath(node.children, restOfPath),
      };
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
      chatMessages: [],
      isTyping: false,
      aiModelId: undefined,
      aiModelConfig: null,
      openedFiles: [],
      showCopilot: true,

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

      // --- CHAT ACTIONS ---
      addChatMessage: (msg) => set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
      clearChat: () => set({ chatMessages: [] }),
      setTyping: (v) => set({ isTyping: v }),

      // --- AI CONFIG ---
      setAiInfo: (aiModelId, aiModelConfig) => set({ aiModelId, aiModelConfig }),

      // --- OPENED FILES ACTIONS ---
      setOpenedFiles: (files) => set({ openedFiles: files }),
      addOpenedFile: (file) => set((state) => ({
        openedFiles: state.openedFiles.some(f => f.path === file.path)
          ? state.openedFiles
          : [...state.openedFiles, file]
      })),
      removeOpenedFile: (path) => set((state) => ({
        openedFiles: state.openedFiles.filter(f => f.path !== path)
      })),

      // --- UI VISIBILITY ACTIONS ---
      setShowCopilot: (show) => set({ showCopilot: show }),
      toggleCopilot: () => set((state) => ({ showCopilot: !state.showCopilot })),

      // --- FILE OPERATION ACTIONS ---
      createFile: (parentPath, fileName, content = '') => {
        const newFile: FileNode = {
          name: fileName,
          content,
          isEditable: true,
        };
        const pathSegments = parentPath ? parentPath.split('/') : [];
        const newFiles = addNodeToPath(get().files, pathSegments, newFile);
        set({ files: newFiles });
      },

      createFolder: (parentPath, folderName) => {
        const newFolder: FileNode = {
          name: folderName,
          children: [],
        };
        const pathSegments = parentPath ? parentPath.split('/') : [];
        const newFiles = addNodeToPath(get().files, pathSegments, newFolder);
        set({ files: newFiles });
      },

      renameNode: (path, newName) => {
        const pathSegments = path.split('/');
        const newFiles = renameNodeAtPath(get().files, pathSegments, newName);
        set({ files: newFiles });

        // Also update opened files if the renamed file is open
        const oldName = pathSegments[pathSegments.length - 1];
        const parentPath = pathSegments.slice(0, -1).join('/');
        const newPath = parentPath ? `${parentPath}/${newName}` : newName;

        set((state) => ({
          openedFiles: state.openedFiles.map((f) =>
            f.path === path ? { ...f, path: newPath, node: { ...f.node, name: newName } } : f
          ),
        }));
      },

      deleteNode: (path) => {
        const pathSegments = path.split('/');
        const newFiles = deleteNodeAtPath(get().files, pathSegments);
        set({ files: newFiles });

        // Also remove from opened files if deleted
        set((state) => ({
          openedFiles: state.openedFiles.filter((f) => !f.path.startsWith(path)),
        }));
      },
    }),
    {
      name: 'project-state-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): StoredState => ({
        files: state.files,
        chat: state.chat,
        terminal: state.terminal,
        chatMessages: state.chatMessages,
        aiModelId: state.aiModelId,
        aiModelConfig: state.aiModelConfig,
        openedFiles: state.openedFiles,
      }),
      version: 2,
      migrate: (persistedState, version) => {
        const state = (persistedState as Partial<StoredState>) || {};
        // Add any migration logic for future versions here
        return {
          files: state.files || [],
          chat: state.chat || '',
          terminal: state.terminal || '',
          chatMessages: state.chatMessages || [],
          aiModelId: state.aiModelId,
          aiModelConfig: state.aiModelConfig ?? null,
          openedFiles: state.openedFiles || [],
        };
      },
    }
  )
);