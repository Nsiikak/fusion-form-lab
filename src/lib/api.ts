import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
// https://plagohive-backend.onrender.com

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Token management
const TOKEN_KEY = "auth_token";

export const tokenManager = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  removeToken: (): void => {
    localStorage.removeItem(TOKEN_KEY);
  },
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenManager.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      tokenManager.removeToken();
      // You can dispatch an event or use router here if needed
      window.dispatchEvent(new CustomEvent("auth:logout"));
    }
    return Promise.reject(error);
  }
);

// API methods
export const api = {
  auth: {
    register: async (data: {
      email: string;
      password: string;
      full_name?: string;
      phone_number?: string;
      role?: "customer" | "vendor" | "admin";
    }) => {
      const response = await apiClient.post("/api/auth/register", data);
      return response.data;
    },
    login: async (email: string, password: string) => {
      const response = await apiClient.post("/api/auth/login-json", {
        email,
        password,
      });
      const { access_token } = response.data;
      if (access_token) {
        tokenManager.setToken(access_token);
      }
      return response.data;
    },
    getCurrentUser: async () => {
      const response = await apiClient.get("/api/auth/me");
      return response.data;
    },
    logout: () => {
      tokenManager.removeToken();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    },
  },
  vendors: {
    register: async (data: {
      email: string;
      password: string;
      business_name: string;
      contact_name: string;
      category: string;
      location: string;
      description?: string;
      starting_price: number;
      business_size: string;
      registration_number?: string;
      phone_number?: string;
    }) => {
      const response = await apiClient.post("/api/vendors/register", data);
      // Auto-login after vendor registration
      const loginResponse = await apiClient.post("/api/auth/login-json", {
        email: data.email,
        password: data.password,
      });
      const { access_token } = loginResponse.data;
      if (access_token) {
        tokenManager.setToken(access_token);
      }
      return response.data;
    },
    getMyVendor: async () => {
      const response = await apiClient.get("/api/vendors/me");
      return response.data;
    },
    updateMyVendor: async (data: any) => {
      const response = await apiClient.put("/api/vendors/me", data);
      return response.data;
    },
  },
};

export default apiClient;
