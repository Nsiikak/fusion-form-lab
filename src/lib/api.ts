import axios, { AxiosInstance, AxiosError } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "";

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export interface BookingQuote {
  base_price: number;
  items_total: number;
  vendor_service_fee: number;
  logistics_fee: number;
  vendor_total: number;
  platform_fee: number;
  platform_fee_rate: number;
  customer_total: number;
  items: Array<{ service_item_id: number; name: string; quantity: number; subtotal: number }>;
}

export interface CheckoutSession {
  booking_id: number;
  reference: string;
  amount_kobo: number;
  currency: string;
  email: string;
  customer_total: number;
}

export interface BookingAddon {
  id: number;
  items: { name: string; quantity: number; unit_price: number; subtotal: number }[];
  note: string | null;
  amount: number;
  platform_fee: number;
  customer_total: number;
  status: "proposed" | "paid" | "declined" | "withdrawn" | "refunded";
  paid_at: string | null;
  created_at: string | null;
}

export type MetricsParams = { days?: number; all_time?: boolean; start?: string; end?: string };

export interface Metrics {
  period: { start: string; end: string; days: number; unit: "day" | "week" | "month" };
  kpis: Record<string, number | null>;
  series: { period: string; bookings: number; gmv: number; revenue: number }[];
  by_category: { category: string; bookings: number; gmv: number }[];
  top_vendors: { vendor: string; bookings: number; gmv: number }[];
}

export interface CancellationPolicy { label: string; summary: string; tiers: [number, number][] }

export interface CancellationPreview {
  refund_amount: number;
  refund_pct: number;
  full_refund: boolean;
  vendor_retained?: number;
  reason: string;
  policy?: { key: string; label: string; summary: string; tiers: [number, number][] } | null;
}

export interface UpcomingEvent {
  id: number;
  event_date: string;
  status: string;
  health: "green" | "amber" | "red";
  note: string;
  vendor_name: string | null;
  vendor_phone: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  venue: string;
}

export interface ChatAttachment { url?: string; type: "image" | "quote"; booking_id?: number }

export interface ChatMessage {
  id: number;
  sender_role: "customer" | "vendor" | "system";
  mine: boolean;
  body: string;
  contact_hidden: boolean;
  attachments: ChatAttachment[];
  created_at: string | null;
}

export interface ConversationSummary {
  id: number;
  other: { name: string; image: string | null; subtitle: string; vendor_id: number };
  last_message_at: string | null;
  last_message_preview: string;
  unread: number;
  booking: { id: number; status: string; event_date: string } | null;
}

export interface ChatThread {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  contact_allowed: boolean;
  other_last_read_id: number;
}

export interface RefundAccount {
  bank_code: string;
  bank_name: string;
  account_name: string;
  account_number_masked: string;
  updated_at: string | null;
}

export interface AdminOverview {
  vendors_pending: number;
  open_disputes: number;
  refund_reviews: number;
  failed_payouts: number;
  failed_refunds: number;
  payouts_awaiting_approval: number;
  payouts_awaiting_otp: number;
  escrow_held: number;
  platform_earnings: number;
}

export interface AdminVendor {
  id: number;
  business_name: string;
  contact_name: string;
  email: string | null;
  phone_number: string | null;
  category: string;
  location: string;
  description: string | null;
  business_size: string;
  starting_price: number;
  logistics_fee: number | null;
  registration_number: string | null;
  cac_verified_name: string | null;
  cac_verification_attempted: boolean;
  has_bank_account: boolean;
  profile_image_url: string | null;
  gallery_images: string[];
  verification_status: "pending" | "approved" | "rejected";
  verification_note: string | null;
  verified_at: string | null;
  auto_verified: boolean;
  is_active: boolean;
  created_at: string | null;
}

export type CaseType =
  | "dispute" | "refund_review" | "payout_approval" | "awaiting_otp" | "failed_payout" | "failed_refund"
  | "refund_needs_details" | null;

export interface AdminCase {
  id: number;
  case_type: CaseType;
  status: string;
  event_date: string;
  created_at: string;
  paid_at: string | null;
  vendor_name: string | null;
  vendor_category: string | null;
  vendor_email: string | null;
  vendor_phone: string | null;
  vendor_has_bank_account: boolean;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  price: number;              // what the customer paid
  vendor_total: number;
  platform_fee: number | null;
  commission_amount: number | null;
  payout_amount: number | null;
  payout_status: string;
  payout_error: string | null;
  payout_reference: string | null;
  payment_reference: string | null;
  refund_status: string;
  dispute_reason: string | null;
  disputed_at: string | null;
  resolution: "refund" | "release" | null;
  resolution_note: string | null;
  resolved_at: string | null;
  notes: string | null;
  service_items_snapshot: Array<{ name: string; quantity: number; subtotal: number }> | null;
  receipt_number?: string | null;
  payout_statement_number?: string | null;
  customer_refund_account?: { bank_name: string; account_number: string; account_name: string } | null;
}

// Token management
const TOKEN_KEY = "auth_token";

const REFRESH_KEY = "refresh_token";

export const tokenManager = {
  getToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken: (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),
  setTokens: (access: string, refresh?: string | null): void => {
    localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  removeToken: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// One shared refresh at a time, so parallel 401s don't each try to refresh
let refreshing: Promise<string | null> | null = null;
const refreshAccessToken = (): Promise<string | null> => {
  const refresh = tokenManager.getRefresh();
  if (!refresh) return Promise.resolve(null);
  refreshing ??= axios
    .post(`${API_BASE_URL}/api/auth/refresh`, { refresh_token: refresh })
    .then((r) => { tokenManager.setTokens(r.data.access_token, r.data.refresh_token); return r.data.access_token as string; })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
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
  async (error: AxiosError) => {
    const original: any = error.config;
    // Expired session: renew it once with the refresh token, then retry the request
    if (error.response?.status === 401 && original && !original._retried && !String(original.url).includes("/api/auth/")) {
      original._retried = true;
      const fresh = await refreshAccessToken();
      if (fresh) {
        original.headers = { ...(original.headers || {}), Authorization: `Bearer ${fresh}` };
        return apiClient(original);
      }
    }
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
      const { access_token, refresh_token } = response.data;
      if (access_token) {
        tokenManager.setTokens(access_token, refresh_token);
      }
      return response.data;
    },
    getCurrentUser: async () => {
      const response = await apiClient.get("/api/auth/me");
      return response.data;
    },
    updateMe: async (data: { full_name?: string; phone_number?: string }) =>
      (await apiClient.patch("/api/auth/me", data)).data,
    logout: () => {
      tokenManager.removeToken();
      window.dispatchEvent(new CustomEvent("auth:logout"));
    },
    forgotPassword: async (email: string) => {
      const response = await apiClient.post("/api/auth/forgot-password", { email });
      return response.data;
    },
    resetPassword: async (token: string, new_password: string) => {
      const response = await apiClient.post("/api/auth/reset-password", { token, new_password });
      return response.data;
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
      logistics_fee?: number;
      base_state?: string;
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
      const { access_token, refresh_token } = loginResponse.data;
      if (access_token) {
        tokenManager.setTokens(access_token, refresh_token);
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
    resolveAccount: async (account_number: string, bank_code: string) => {
      const response = await apiClient.get("/api/vendors/me/resolve-account", {
        params: { account_number, bank_code },
      });
      return response.data as { account_name: string; account_number: string };
    },
    list: async (params?: {
      category?: string;
      location?: string;
      min_price?: number;
      max_price?: number;
      available_on?: string;
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
    availability: async (vendorId: number, start: string, end: string): Promise<{ unavailable: string[] }> =>
      (await apiClient.get(`/api/vendors/${vendorId}/availability`, { params: { start, end } })).data,
    myAvailability: async (): Promise<{ blocked_dates: string[]; daily_capacity: number | null }> =>
      (await apiClient.get("/api/vendors/me/availability")).data,
    setMyAvailability: async (body: { blocked_dates: string[]; daily_capacity: number | null }) =>
      (await apiClient.put("/api/vendors/me/availability", body)).data,
    advanceEligibility: async () => (await apiClient.get("/api/vendors/me/advance-eligibility")).data,
    getRecommended: async (limit?: number) => {
      const params = limit ? { limit } : {};
      const response = await apiClient.get("/api/vendors/recommended", { params });
      return response.data;
    },
  },
  serviceItems: {
    getForVendor: async (vendorId: number) => {
      const response = await apiClient.get(`/api/service-items/vendor/${vendorId}`);
      return response.data;
    },
    getMine: async () => {
      const response = await apiClient.get("/api/service-items/me");
      return response.data;
    },
    create: async (data: {
      name: string;
      description?: string;
      unit_price: number;
      unit_label: string;
      is_active?: boolean;
    }) => {
      const response = await apiClient.post("/api/service-items", data);
      return response.data;
    },
    update: async (itemId: number, data: Partial<{
      name: string;
      description: string;
      unit_price: number;
      unit_label: string;
      is_active: boolean;
    }>) => {
      const response = await apiClient.put(`/api/service-items/${itemId}`, data);
      return response.data;
    },
    delete: async (itemId: number) => {
      await apiClient.delete(`/api/service-items/${itemId}`);
    },
  },
  bookings: {
    /** Server-computed, customer-facing price breakdown. Never compute totals client-side. */
    quote: async (data: {
      vendor_id: number;
      service_items?: Array<{ service_item_id: number; quantity: number }>;
    }): Promise<BookingQuote> => {
      const response = await apiClient.post("/api/bookings/quote", data);
      return response.data;
    },
    /** Step 1 of checkout: reserves an unpaid booking and returns what the Paystack popup needs. */
    create: async (data: {
      vendor_id: number;
      event_id?: number;
      event_date: string;
      event_time?: string;
      notes?: string;
      service_items?: Array<{ service_item_id: number; quantity: number }>;
      event_address?: {
        venue_name?: string;
        city?: string;
        state?: string;
        delivery_instructions?: string;
      };
    }): Promise<CheckoutSession> => {
      const response = await apiClient.post("/api/bookings", data);
      return response.data;
    },
    /** Customer reports a problem; payment stays in escrow until an admin decides. */
    openDispute: async (bookingId: number, reason: string, noShow = false) => {
      const response = await apiClient.post(`/api/bookings/${bookingId}/dispute`, { reason, no_show: noShow });
      return response.data;
    },
    declineQuote: async (bookingId: number) => (await apiClient.post(`/api/bookings/${bookingId}/quote/decline`)).data,
    reductionPreview: async (bookingId: number, lines: { index: number; quantity: number }[]) =>
      (await apiClient.post(`/api/bookings/${bookingId}/reductions/preview`, { lines })).data,
    reduce: async (bookingId: number, lines: { index: number; quantity: number }[], reason?: string) =>
      (await apiClient.post(`/api/bookings/${bookingId}/reductions`, { lines, reason })).data,
    addons: async (bookingId: number): Promise<BookingAddon[]> =>
      (await apiClient.get(`/api/bookings/${bookingId}/addons`)).data,
    proposeAddon: async (bookingId: number, items: { name: string; quantity: number; unit_price: number }[], note?: string): Promise<BookingAddon> =>
      (await apiClient.post(`/api/bookings/${bookingId}/addons`, { items, note })).data,
    addonCheckout: async (bookingId: number, addonId: number): Promise<{ reference: string; amount_kobo: number; customer_total: number; email: string }> =>
      (await apiClient.post(`/api/bookings/${bookingId}/addons/${addonId}/checkout`)).data,
    addonVerify: async (bookingId: number, addonId: number): Promise<BookingAddon> =>
      (await apiClient.post(`/api/bookings/${bookingId}/addons/${addonId}/verify`)).data,
    addonRespond: async (bookingId: number, addonId: number, action: "decline" | "withdraw"): Promise<BookingAddon> =>
      (await apiClient.post(`/api/bookings/${bookingId}/addons/${addonId}/${action}`)).data,
    policies: async (): Promise<Record<string, CancellationPolicy>> =>
      (await apiClient.get("/api/bookings/policies")).data,
    cancellationPreview: async (bookingId: number): Promise<CancellationPreview> =>
      (await apiClient.get(`/api/bookings/${bookingId}/cancellation-preview`)).data,
    cancel: async (bookingId: number, reason?: string, requestReview = false) =>
      (await apiClient.post(`/api/bookings/${bookingId}/cancel`, { reason, request_review: requestReview })).data,
    vendorCancelPreview: async (bookingId: number): Promise<{ fee: number; fee_rate: number; severity: string }> =>
      (await apiClient.get(`/api/bookings/${bookingId}/vendor-cancel-preview`)).data,
    vendorCancel: async (bookingId: number, reason: string) =>
      (await apiClient.post(`/api/bookings/${bookingId}/vendor-cancel`, { reason })).data,
    reconfirm: async (bookingId: number) => (await apiClient.post(`/api/bookings/${bookingId}/reconfirm`)).data,
    checkIn: async (bookingId: number) => (await apiClient.post(`/api/bookings/${bookingId}/check-in`)).data,
    noShowResponse: async (bookingId: number, message: string) =>
      (await apiClient.post(`/api/bookings/${bookingId}/no-show-response`, { message })).data,
    /** Step 2 of checkout: confirms the Paystack payment server-side. */
    verifyPayment: async (bookingId: number, reference?: string) => {
      // Paystack can take a few seconds to confirm (especially bank transfers): retry briefly before giving up
      let last: any;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const response = await apiClient.post(`/api/bookings/${bookingId}/verify-payment`, reference ? { reference } : {});
          return response.data;
        } catch (e: any) {
          last = e;
          const code = e?.response?.status;
          if (code !== 402 && code !== 502) throw e;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      throw last;
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
  messages: {
    conversations: async (): Promise<ConversationSummary[]> =>
      (await apiClient.get("/api/messages/conversations")).data,
    unreadCount: async (): Promise<number> =>
      (await apiClient.get("/api/messages/unread-count")).data.unread,
    start: async (vendorId: number): Promise<ConversationSummary> =>
      (await apiClient.post("/api/messages/conversations", { vendor_id: vendorId })).data,
    forBooking: async (bookingId: number): Promise<{ id: number }> =>
      (await apiClient.get(`/api/messages/conversations/for-booking/${bookingId}`)).data,
    thread: async (id: number, afterId = 0): Promise<ChatThread> =>
      (await apiClient.get(`/api/messages/conversations/${id}`, { params: { after_id: afterId } })).data,
    send: async (id: number, body: string, attachments?: ChatAttachment[]): Promise<ChatMessage> =>
      (await apiClient.post(`/api/messages/conversations/${id}/messages`, { body, attachments })).data,
    sendQuote: async (id: number, body: any): Promise<{ booking_id: number; message_id: number }> =>
      (await apiClient.post(`/api/messages/conversations/${id}/quote`, body)).data,
    uploadPhoto: async (id: number, file: File): Promise<ChatAttachment> => {
      const form = new FormData();
      form.append("file", file);
      return (await apiClient.post(`/api/messages/conversations/${id}/photos`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })).data;
    },
  },
  account: {
    favorites: async (): Promise<any[]> => (await apiClient.get("/api/account/favorites")).data,
    addFavorite: async (vendorId: number) => { await apiClient.put(`/api/account/favorites/${vendorId}`); },
    removeFavorite: async (vendorId: number) => { await apiClient.delete(`/api/account/favorites/${vendorId}`); },
    getRefundAccount: async (): Promise<{ refund_account: RefundAccount | null }> =>
      (await apiClient.get("/api/account/refund-account")).data,
    saveRefundAccount: async (data: { bank_code: string; bank_name: string; account_number: string }) =>
      (await apiClient.put("/api/account/refund-account", data)).data as {
        refund_account: RefundAccount; name_matches: boolean; refunds_resumed: number;
      },
    deleteRefundAccount: async () => {
      await apiClient.delete("/api/account/refund-account");
    },
    requestDeletion: async (password: string): Promise<{ delete_on: string; grace_days: number }> =>
      (await apiClient.post("/api/account/delete", { password })).data,
  },
  documents: {
    /** Downloads a booking's PDF (receipt for customers, payout statement for vendors). */
    download: async (bookingId: number, kind: "receipt" | "payout-statement") => {
      const response = await apiClient.get(`/api/bookings/${bookingId}/${kind}`, { responseType: "blob" });
      const disposition: string = response.headers["content-disposition"] || "";
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] || `plagohive-${kind}-${bookingId}.pdf`;
      const url = URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
  },
  support: {
    cases: async () => (await apiClient.get("/api/support/cases")).data,
    lookup: async (q: string) => (await apiClient.get("/api/support/lookup", { params: { q } })).data,
    upcoming: async () => (await apiClient.get("/api/support/upcoming")).data,
    conversation: async (bookingId: number, reason: string) =>
      (await apiClient.get("/api/support/conversations/between", { params: { booking_id: bookingId, reason } })).data,
    notes: async (bookingId: number) => (await apiClient.get("/api/support/notes", { params: { booking_id: bookingId } })).data,
    addNote: async (bookingId: number, note: string) => (await apiClient.post("/api/support/notes", { booking_id: bookingId, note })).data,
    escalate: async (body: { booking_id?: number; category: string; priority: string; note: string }) =>
      (await apiClient.post("/api/support/escalations", body)).data,
    escalations: async () => (await apiClient.get("/api/support/escalations")).data,
    notifications: async (recipient?: string) => (await apiClient.get("/api/support/notifications", { params: recipient ? { recipient } : {} })).data,
    resend: async (reference: string) => (await apiClient.post(`/api/support/notifications/${reference}/resend`)).data,
    nudgeVendor: async (bookingId: number) => (await apiClient.post(`/api/support/bookings/${bookingId}/nudge-vendor`)).data,
  },
  admin: {
    escalations: async (status?: string) => (await apiClient.get("/api/admin/escalations", { params: status ? { status } : {} })).data,
    resolveEscalation: async (id: number, resolution_note: string) =>
      (await apiClient.post(`/api/admin/escalations/${id}/resolve`, { resolution_note })).data,
    supportUsers: async () => (await apiClient.get("/api/admin/support-users")).data,
    createSupportUser: async (email: string, full_name: string) => (await apiClient.post("/api/admin/support-users", { email, full_name })).data,
    deactivateSupportUser: async (id: number) => (await apiClient.post(`/api/admin/support-users/${id}/deactivate`)).data,
    retention: async () => (await apiClient.get("/api/admin/retention")).data,
    conversationBetween: async (bookingId: number, reason: string) =>
      (await apiClient.get("/api/admin/conversations/between", { params: { booking_id: bookingId, reason } })).data,
    auditFlagged: async () => (await apiClient.get("/api/admin/audit/flagged")).data,
    auditChatAccess: async () => (await apiClient.get("/api/admin/audit/chat-access")).data,
    auditNotifications: async () => (await apiClient.get("/api/admin/audit/notifications")).data,
    overview: async (): Promise<AdminOverview> => (await apiClient.get("/api/admin/overview")).data,
    vendors: async (params: { status: string; q?: string; page?: number }) =>
      (await apiClient.get("/api/admin/vendors", { params })).data as {
        vendors: AdminVendor[]; total: number; page: number; total_pages: number;
      },
    decideVerification: async (vendorId: number, decision: "approved" | "rejected", note?: string) =>
      (await apiClient.post(`/api/admin/vendors/${vendorId}/verification`, { decision, note })).data as AdminVendor,
    setVendorActive: async (vendorId: number, is_active: boolean, note?: string) =>
      (await apiClient.post(`/api/admin/vendors/${vendorId}/active`, { is_active, note })).data as AdminVendor,
    cases: async (): Promise<AdminCase[]> => (await apiClient.get("/api/admin/cases")).data,
    history: async (): Promise<AdminCase[]> => (await apiClient.get("/api/admin/cases/history")).data,
    resolve: async (bookingId: number, outcome: "refund" | "release", note: string) =>
      (await apiClient.post(`/api/admin/bookings/${bookingId}/resolve`, { outcome, note })).data as AdminCase,
    approvePayout: async (bookingId: number) =>
      (await apiClient.post(`/api/admin/bookings/${bookingId}/approve-payout`)).data as AdminCase,
    upcoming: async (): Promise<UpcomingEvent[]> => (await apiClient.get("/api/admin/upcoming")).data,
    metrics: async (params: MetricsParams): Promise<Metrics> =>
      (await apiClient.get("/api/admin/metrics", { params })).data,
    downloadReport: async (params: MetricsParams, format: "pdf" | "csv") => {
      const response = await apiClient.get("/api/admin/metrics/report", { params: { ...params, format }, responseType: "blob" });
      const name = /filename="([^"]+)"/.exec(response.headers["content-disposition"] || "")?.[1] || `plagohive-kpis.${format}`;
      const url = URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement("a");
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    syncPayout: async (bookingId: number) =>
      (await apiClient.post(`/api/admin/bookings/${bookingId}/sync-payout`)).data as AdminCase,
    retryPayout: async (bookingId: number) =>
      (await apiClient.post(`/api/admin/bookings/${bookingId}/retry-payout`)).data as AdminCase,
    retryRefund: async (bookingId: number) =>
      (await apiClient.post(`/api/admin/bookings/${bookingId}/retry-refund`)).data as AdminCase,
  },
  events: {
    create: async (data: {
      name: string;
      date: string;
      location: string;
      description?: string;
      total_budget?: number;
      event_type?: string;
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
