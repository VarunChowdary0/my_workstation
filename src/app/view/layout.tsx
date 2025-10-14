"use client";

import { allServices } from "@/services/allServices";
import { Project } from "@/types/types";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { ProjectFilesContext } from "@/contexts/ProjectFilesContext";

export default function Layout({
    children,
}: { 
    children: React.ReactNode;  
}) {
    const params = useParams();
    const project_id = params.id as string;
    const [project, setProject] = useState<Project>();

    const fecthProject = async (pid: string) => {
        try{
            const response = await allServices.getProject(pid);
            setProject(response);
        }
        catch(error){
            console.error("Failed to fetch project:", error);
        }
    }
    useEffect(() => {
        if(project_id){
            fecthProject(project_id);
        }
    },[project_id]);
        const files = useMemo(() => project?.files ?? [], [project]);
        return (
            <ProjectFilesContext.Provider value={files}>
                <AiMetaBar />
                {children}
            </ProjectFilesContext.Provider>
        );
}

function AiMetaBar() {
    const { aiModelId, aiModelConfig } = useProjectStore();
    
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
        </div>
    );
}