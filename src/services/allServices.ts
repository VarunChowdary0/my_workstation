import { Messaage, ModelConfig, FileNode } from '@/types/types';
import axios from 'axios';

// const API_BASE = "http://localhost:8000/api";
const API_BASE = "https://test-admin.apexhire.ai/api";
const EXEC_API_BASE = "http://localhost:8001/api";  // Code execution server

export interface RunProjectResponse {
    session_id: string;
    project_type: string;
    port: number;
    message: string;
}

export const allServices  = {
    getProject: async (pid: string) =>{
        const response = await axios.get(`${API_BASE}/projects/${pid}`);
        return response.data;
    },
    validate_token: async (token: string) =>{
        const response = await axios.post(`${API_BASE}/project/validate-token`, { token });
        return response.data;
    },
    assist: async (
        message: string,
        code: string,
        language: string,
        environment = 'code',
        aiModelId: string,
        aiModelConfig: ModelConfig,
        pastMessages: Messaage[]
    ) => {
        const response = await axios.post(API_BASE+"/project/assist", {
            message,
            code,
            language,
            environment,
            aiModelId,
            aiModelConfig,
            pastMessages
        });
        return response.data.answer;
    },

    // Code execution APIs (uses separate execution server on port 8001)
    runProject: async (files: FileNode[]): Promise<RunProjectResponse> => {
        const response = await axios.post(`${EXEC_API_BASE}/projects/run`, { files });
        return response.data;
    },

    stopProject: async (sessionId: string): Promise<void> => {
        await axios.post(`${EXEC_API_BASE}/projects/stop`, { session_id: sessionId });
    },

    cleanupSession: async (sessionId: string): Promise<void> => {
        await axios.delete(`${EXEC_API_BASE}/projects/session/${sessionId}`);
    },

    updateFile: async (sessionId: string, filePath: string, content: string): Promise<void> => {
        await axios.post(`${EXEC_API_BASE}/projects/update-file`, {
            session_id: sessionId,
            file_path: filePath,
            content: content
        });
    },

    // Notebook execution APIs
    notebook: {
        createSession: async (
            files?: FileNode[],
            requirementsTxt?: string
        ): Promise<{ session_id: string; message: string }> => {
            const response = await axios.post(`${EXEC_API_BASE}/notebook/sessions`, {
                files: files,
                requirements_txt: requirementsTxt
            });
            return response.data;
        },

        updateFile: async (sessionId: string, filePath: string, content: string): Promise<void> => {
            await axios.post(`${EXEC_API_BASE}/notebook/update-file`, {
                session_id: sessionId,
                file_path: filePath,
                content: content
            });
        },

        executeCell: async (
            sessionId: string,
            code: string,
            timeout: number = 60.0
        ): Promise<{
            execution_count: number;
            outputs: Array<{
                output_type: string;
                name?: string;
                text?: string[];
                data?: Record<string, unknown>;
                execution_count?: number;
                ename?: string;
                evalue?: string;
                traceback?: string[];
            }>;
            status: string;
        }> => {
            const response = await axios.post(`${EXEC_API_BASE}/notebook/execute`, {
                session_id: sessionId,
                code,
                timeout
            });
            return response.data;
        },

        getSession: async (sessionId: string): Promise<{
            session_id: string;
            execution_count: number;
            created_at: string;
            last_activity: string;
            is_alive: boolean;
            has_project: boolean;
        }> => {
            const response = await axios.get(`${EXEC_API_BASE}/notebook/sessions/${sessionId}`);
            return response.data;
        },

        listSessions: async (): Promise<{
            sessions: Array<{
                session_id: string;
                execution_count: number;
                created_at: string;
                last_activity: string;
                is_alive: boolean;
                has_project: boolean;
            }>;
        }> => {
            const response = await axios.get(`${EXEC_API_BASE}/notebook/sessions`);
            return response.data;
        },

        interruptKernel: async (sessionId: string): Promise<void> => {
            await axios.post(`${EXEC_API_BASE}/notebook/sessions/${sessionId}/interrupt`);
        },

        restartKernel: async (sessionId: string): Promise<void> => {
            await axios.post(`${EXEC_API_BASE}/notebook/sessions/${sessionId}/restart`);
        },

        deleteSession: async (sessionId: string): Promise<void> => {
            await axios.delete(`${EXEC_API_BASE}/notebook/sessions/${sessionId}`);
        },

        installPackages: async (
            sessionId: string,
            packages: string[]
        ): Promise<{
            success: boolean;
            installed: string[];
            failed: string[];
            output: string;
        }> => {
            const response = await axios.post(`${EXEC_API_BASE}/notebook/install`, {
                session_id: sessionId,
                packages
            });
            return response.data;
        }
    }
}

