import axios from 'axios';

// Create a simple axios instance for feedback
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5800';

const feedbackApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface FeedbackData {
  score: number; // 1 to 10 scale (1=very poor, 10=excellent)
  comment?: string;
  page?: string;
  country?: string;
  user_id?: number;
}

export interface FeedbackResponse {
  message: string;
  data?: any;
  status: string;
}

export const feedbackService = {
  // Submit feedback
  async submitFeedback(feedback: FeedbackData): Promise<FeedbackResponse> {
    try {
      const response = await feedbackApi.post('/api/feedback/', feedback);
      return response.data;
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      throw new Error(error.response?.data?.detail || 'Failed to submit feedback');
    }
  },

  // Get feedback (for admin purposes)
  async getFeedback(page?: string): Promise<any[]> {
    try {
      const params = page ? { page } : {};
      const response = await feedbackApi.get('/api/feedback/', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error getting feedback:', error);
      throw new Error(error.response?.data?.detail || 'Failed to get feedback');
    }
  }
};
