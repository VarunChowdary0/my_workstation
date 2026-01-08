"use client";

import { FileNode, Project } from "@/types/types";
import { createContext, useContext } from "react";

// Context to provide project files to all child routes/components
export const ProjectFilesContext = createContext<FileNode[] | undefined>(undefined);

export const useProjectFiles = () => {
    const ctx = useContext(ProjectFilesContext);
    if (ctx === undefined) {
        return [] as FileNode[];
    }
    return ctx;
};

// Context to provide full project data including metadata
export const ProjectContext = createContext<Project | undefined>(undefined);

export const useProject = () => {
    const ctx = useContext(ProjectContext);
    return ctx;
};