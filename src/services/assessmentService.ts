import axios from 'axios';
import { VerifyTokenResponse, SyncResponse, SubmitResponse } from '@/types/assessment';
import { FileNode } from '@/types/types';

const API_BASE = "http://localhost:8000/api/project-assessment";

export const assessmentService = {
  verifyToken: async (token: string): Promise<VerifyTokenResponse> => {
    const response = await axios.post(`${API_BASE}/verify-token`, { token });
    return response.data;
  },

  syncFiles: async (token: string, files: FileNode[]): Promise<SyncResponse> => {
    const response = await axios.post(`${API_BASE}/sync`, { token, files });
    return response.data;
  },

  submitAssessment: async (token: string, files: FileNode[]): Promise<SubmitResponse> => {
    const response = await axios.post(`${API_BASE}/submit`, { token, files });
    return response.data;
  },
};
