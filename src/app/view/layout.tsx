"use client";

import { allServices } from "@/services/allServices";
import { Project } from "@/types/types";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { ProjectFilesContext, ProjectContext } from "@/contexts/ProjectFilesContext";
import { Sparkles, Loader2 } from "lucide-react";
import { NOTEBOOK_DEMO_PROJECT } from "@/mock-data/notebookDemo";

// Map of mock project IDs to their data
const MOCK_PROJECTS: Record<string, Project> = {
    "notebook_demo": NOTEBOOK_DEMO_PROJECT,
};

export default function Layout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const project_id = params.id as string;
    const [project, setProject] = useState<Project>();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fecthProject = async (pid: string) => {
        setIsLoading(true);
        setError(null);
        try {
            // Check if this is a mock project first
            if (MOCK_PROJECTS[pid]) {
                setProject(MOCK_PROJECTS[pid]);
                return;
            }
            // Otherwise fetch from API
            const response = await allServices.getProject(pid);
            console.log(response);
            setProject(response);
        } catch (error) {
            console.error("Failed to fetch project:", error);
            setError("Failed to load project");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (project_id) {
            fecthProject(project_id);
        }
    }, [project_id]);

    const files = useMemo(() => project?.files ?? [], [project]);

    if (isLoading) {
        return <LoadingScreen />;
    }

    if (error) {
        return <ErrorScreen message={error} />;
    }

    return (
        <ProjectContext.Provider value={project}>
            <ProjectFilesContext.Provider value={files}>
                <AiMetaBar />
                {children}
            </ProjectFilesContext.Provider>
        </ProjectContext.Provider>
    );
}

function LoadingScreen() {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
                <p className="text-gray-400 text-sm">Loading project...</p>
            </div>
        </div>
    );
}

function ErrorScreen({ message }: { message: string }) {
    return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#181818]">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-red-500 text-2xl">!</span>
                </div>
                <p className="text-gray-400 text-sm">{message}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                >
                    Retry
                </button>
            </div>
        </div>
    );
}

function AiMetaBar() {
    const { aiModelId, aiModelConfig, showCopilot, toggleCopilot } = useProjectStore();

    const model = aiModelId || "gpt-4o-mini";
    const temperature = (aiModelConfig?.temperature as number) ?? 0.4;
    const maxTokens = aiModelConfig?.maxTokens ?? 2048;
    const systemMessage = aiModelConfig?.systemMessage ?? "You are a helpful coding assistant.";

    return (
        <div className="w-full border-b bg-muted/30 text-xs px-3 py-2 flex items-center gap-4">
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground">AI Model:</span>
                <span className="font-mono text-foreground">{model}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Temperature:</span>
                <span className="font-mono text-foreground">{temperature.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Max Tokens:</span>
                <span className="font-mono text-foreground">{maxTokens}</span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-muted-foreground">System:</span>
                <span className="font-mono text-foreground truncate max-w-48" title={systemMessage}>
                    {systemMessage}
                </span>
            </div>
            <div className="ml-auto">
                {!showCopilot && (
                    <button
                        onClick={toggleCopilot}
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        title="Open Copilot Chat (Ctrl+Alt+B)"
                    >
                        <Sparkles size={14} className="text-purple-400" />
                        <span>Copilot</span>
                    </button>
                )}
            </div>
        </div>
    );
}