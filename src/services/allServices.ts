import { Messaage, ModelConfig, FileNode } from '@/types/types';
import axios from 'axios';

const API_BASE = "http://localhost:8000/api";
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
    }
}

