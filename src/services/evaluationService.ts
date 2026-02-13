import axios from 'axios';
import {
  EvaluateSecureResponse,
  SubmitReviewResponse,
  FeedbackCategories,
} from '@/types/assessment';

const API_BASE = "http://localhost:8000/api/project-assessment";

export const evaluationService = {
  verifyEvaluationToken: async (token: string): Promise<EvaluateSecureResponse> => {
    const response = await axios.post(`${API_BASE}/evaluate/secure`, { token });
    return response.data;
  },

  submitReview: async (
    token: string,
    score: number,
    report: string,
    feedback_categories: FeedbackCategories
  ): Promise<SubmitReviewResponse> => {
    const response = await axios.post(`${API_BASE}/evaluate/submit-review`, {
      token,
      score,
      report,
      feedback_categories,
    });
    return response.data;
  },
};
