"use client";

import { FileNode } from "@/types/types";
import { createContext, useContext } from "react";

// Context to provide project files to all child routes/components
export const ProjectFilesContext = createContext<FileNode[] | undefined>(undefined);

export const useProjectFiles = () => {
    const ctx = useContext(ProjectFilesContext);
    if (ctx === undefined) {
        // Optional: warn if hook used outside provider
        // console.warn("useProjectFiles must be used within ProjectFilesContext.Provider");
        return [] as FileNode[];
    }
    return ctx;
};