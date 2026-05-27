import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

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
    reVerify: async () => {
      const response = await apiClient.post("/api/vendors/me/re-verify");
      return response.data;
    },
    uploadImage: async (file: File, imageType: "profile" | "gallery" = "profile") => {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiClient.post(
        `/api/vendors/me/images?image_type=${imageType}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return response.data;
    },
    deleteGalleryImage: async (url: string) => {
      const response = await apiClient.delete(
        `/api/vendors/me/images?url=${encodeURIComponent(url)}`
      );
      return response.data;
    },
    list: async (params?: {
      category?: string;
      location?: string;
      min_price?: number;
      max_price?: number;
      search?: string;
      page?: number;
      limit?: number;
    }) => {
      const response = await apiClient.get("/api/vendors", { params });
      return response.data;
    },
    getById: async (vendorId: number) => {
      const response = await apiClient.get(`/api/vendors/${vendorId}`);
      return response.data;
    },
    getRecommended: async (limit?: number) => {
      const params = limit ? { limit } : {};
      const response = await apiClient.get("/api/vendors/recommended", { params });
      return response.data;
    },
  },
  bookings: {
    create: async (data: {
      vendor_id: number;
      event_id?: number;
      price: number;
      event_date: string;
      event_time?: string;
      notes?: string;
      payment_reference?: string;
    }) => {
      const response = await apiClient.post("/api/bookings", data);
      return response.data;
    },
    list: async (status?: string) => {
      const params = status ? { status } : {};
      const response = await apiClient.get("/api/bookings", { params });
      return response.data;
    },
    getById: async (bookingId: number) => {
      const response = await apiClient.get(`/api/bookings/${bookingId}`);
      return response.data;
    },
    updateStatus: async (bookingId: number, status: string) => {
      const response = await apiClient.put(`/api/bookings/${bookingId}/status?new_status=${status}`);
      return response.data;
    },
    delete: async (bookingId: number) => {
      await apiClient.delete(`/api/bookings/${bookingId}`);
    },
  },
  events: {
    create: async (data: {
      name: string;
      date: string;
      location: string;
      description?: string;
      total_budget?: number;
    }) => {
      const response = await apiClient.post("/api/events", data);
      return response.data;
    },
    list: async (status?: string) => {
      const params = status ? { status } : {};
      const response = await apiClient.get("/api/events", { params });
      return response.data;
    },
    getById: async (eventId: number) => {
      const response = await apiClient.get(`/api/events/${eventId}`);
      return response.data;
    },
    update: async (eventId: number, data: any) => {
      const response = await apiClient.put(`/api/events/${eventId}`, data);
      return response.data;
    },
    delete: async (eventId: number) => {
      await apiClient.delete(`/api/events/${eventId}`);
    },
    getBookings: async (eventId: number) => {
      const response = await apiClient.get(`/api/events/${eventId}/bookings`);
      return response.data;
    },
  },
  reviews: {
    create: async (data: {
      vendor_id: number;
      booking_id?: number;
      rating: number;
      comment?: string;
    }) => {
      const response = await apiClient.post("/api/reviews", data);
      return response.data;
    },
    getVendorReviews: async (vendorId: number) => {
      const response = await apiClient.get(`/api/reviews/vendor/${vendorId}`);
      return response.data;
    },
    getVendorRating: async (vendorId: number) => {
      const response = await apiClient.get(`/api/reviews/vendor/${vendorId}/rating`);
      return response.data;
    },
    list: async () => {
      const response = await apiClient.get("/api/reviews");
      return response.data;
    },
    update: async (reviewId: number, data: any) => {
      const response = await apiClient.put(`/api/reviews/${reviewId}`, data);
      return response.data;
    },
    delete: async (reviewId: number) => {
      await apiClient.delete(`/api/reviews/${reviewId}`);
    },
  },
  stats: {
    getCustomerStats: async () => {
      const response = await apiClient.get("/api/stats/customer");
      return response.data;
    },
    getVendorStats: async () => {
      const response = await apiClient.get("/api/stats/vendor");
      return response.data;
    },
  },
};

export default apiClient;
