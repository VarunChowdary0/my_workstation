import { Messaage, ModelConfig } from '@/types/types';
import axios from 'axios';

const API_BASE = "http://localhost:8000/api";

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
    }
}

