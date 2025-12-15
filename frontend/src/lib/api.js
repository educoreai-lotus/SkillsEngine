/**
 * API Client for Skills Engine Backend
 */

import axios from 'axios';

// Resolve API base URL from environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_API_BASE_URL environment variable');
}

// In production, localhost is generally not recommended as the API host,
// but we only log a warning instead of throwing to avoid breaking builds.
if (
  process.env.NODE_ENV === 'production' &&
  /localhost|127\.0\.0\.1/i.test(API_BASE_URL)
) {
  // eslint-disable-next-line no-console
  console.warn(
    'Warning: Using a localhost API base URL in production. ' +
    'Ensure this is intentional for your Docker/network setup.'
  );
}

// Helpful log only in development to verify the configured API base URL
if (process.env.NODE_ENV !== 'production') {
  // eslint-disable-next-line no-console
  console.log('__API__', API_BASE_URL);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  // User Profile
  getUserProfile: async (userId) => {
    const response = await apiClient.get(`/api/user/${userId}`);
    const data = response.data;
    // Backend typically returns { success: true, data: profile }
    const profile = data?.data ?? data;
    return profile;
  },

  // Competencies
  getCompetencies: async () => {
    const response = await apiClient.get('/api/competency-subcompetency/parents');
    return response.data;
  },

  getCompetencyById: async (competencyId) => {
    const response = await apiClient.get(`/api/competencies/${competencyId}`);
    return response.data;
  },

  getCompetencyHierarchy: async (competencyId) => {
    const response = await apiClient.get(`/api/competencies/${competencyId}/hierarchy`);
    return response.data;
  },

  getCompetencyCompleteHierarchy: async (competencyId) => {
    const response = await apiClient.get(`/api/competencies/${competencyId}/complete-hierarchy`);
    return response.data;
  },

  getCompetencyMGS: async (competencyId) => {
    const response = await apiClient.get(`/api/competencies/${competencyId}/mgs`);
    return response.data;
  },

  searchCompetencies: async (query, options = {}) => {
    const params = new URLSearchParams();
    params.append('q', query);
    if (options.limit) params.append('limit', options.limit);
    if (options.offset) params.append('offset', options.offset);
    const response = await apiClient.get(`/api/competencies/search?${params.toString()}`);
    return response.data;
  },

  // Skills
  getSkills: async () => {
    const response = await apiClient.get('/api/skills/roots');
    return response.data;
  },

  getSkillById: async (skillId) => {
    const response = await apiClient.get(`/api/skills/${skillId}`);
    return response.data;
  },

  getSkillTree: async (skillId) => {
    const response = await apiClient.get(`/api/skills/${skillId}/tree`);
    return response.data;
  },

  getSkillMGS: async (skillId) => {
    const response = await apiClient.get(`/api/skills/${skillId}/mgs`);
    return response.data;
  },

  // CSV Import (Trainer only)
  importCSV: async (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    const response = await apiClient.post('/api/competencies/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  validateCSV: async (file) => {
    const formData = new FormData();
    formData.append('csv', file);
    const response = await apiClient.post('/api/competencies/import/validate', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // User Competency
  getUserCompetencies: async (userId, params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.competency_id) queryParams.append('competency_id', params.competency_id);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);

    const queryString = queryParams.toString();
    const url = `/api/user-competency/${userId}${queryString ? `?${queryString}` : ''}`;

    const response = await apiClient.get(url);
    return response.data;
  },

  getUserCompetency: async (userId, competencyId) => {
    const response = await apiClient.get(`/api/user-competency/${userId}/${competencyId}`);
    return response.data;
  },

  updateUserCompetency: async (userId, competencyId, data) => {
    const response = await apiClient.put(`/api/user-competency/${userId}/${competencyId}`, data);
    return response.data;
  },

  deleteUserCompetency: async (userId, competencyId) => {
    const response = await apiClient.delete(`/api/user-competency/${userId}/${competencyId}`);
    return response.data;
  },

  // User Career Path
  getCurrentCareerPath: async (userId) => {
    const response = await apiClient.get(`/api/user-career-path/${userId}`);
    return response.data;
  },

  getAllCareerPaths: async (userId) => {
    const response = await apiClient.get(`/api/user-career-path/${userId}/all`);
    return response.data;
  },

  addCareerPath: async (userId, competencyId) => {
    const response = await apiClient.post('/api/user-career-path', {
      user_id: userId,
      competency_id: competencyId,
    });
    return response.data;
  },

  deleteCareerPath: async (userId, competencyId) => {
    const response = await apiClient.delete(`/api/user-career-path/${userId}/${competencyId}`);
    return response.data;
  },

  deleteAllCareerPaths: async (userId) => {
    const response = await apiClient.delete(`/api/user-career-path/${userId}`);
    return response.data;
  },
};

export default api;

