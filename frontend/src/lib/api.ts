import axios from "axios";

export const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api/v1",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) {
        try {
          const { data } = await axios.post('/api/v1/auth/refresh', { refresh_token: refresh })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  login: (email: string, password: string) => {
    const form = new URLSearchParams()
    form.append('username', email)
    form.append('password', password)
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
  register:       (data: object)                        => api.post('/auth/register', data),
  me:             ()                                     => api.get('/auth/me'),
  updateMe:       (data: object)                        => api.patch('/auth/me', data),
  changePassword: (oldPwd: string, newPwd: string)      =>
    api.post('/auth/change-password', null, {
      params: { old_password: oldPwd, new_password: newPwd },
    }),
}

// ── Datasets ──────────────────────────────────────────────────────────────────
// FIX 1: '/datasets/' with trailing slash — prevents FastAPI 307 redirect loop
//         Without the slash, FastAPI redirects /datasets → /datasets/
//         The redirect drops the Authorization header → 401 → infinite loop
export const datasetsApi = {
  list:    (skip = 0, limit = 20) => api.get('/datasets/', { params: { skip, limit } }),
  get:     (id: string)           => api.get(`/datasets/${id}`),
  upload:  (formData: FormData)   =>
    api.post('/datasets/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update:  (id: string, data: object) => api.patch(`/datasets/${id}`, data),
  delete:  (id: string)               => api.delete(`/datasets/${id}`),
  columns: (id: string)               => api.get(`/datasets/${id}/columns`),
  stats:   (id: string)               => api.get(`/datasets/${id}/stats`),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard:   ()                              => api.get('/analytics/dashboard'),
  insights:    (datasetId: string)             => api.get(`/analytics/insights/${datasetId}`),
  kpis:        (datasetId: string)             => api.get(`/analytics/kpis/${datasetId}`),
  chartData:   (datasetId: string, params: object) =>
    api.get(`/analytics/charts/${datasetId}`, { params }),
  correlation: (datasetId: string)             => api.get(`/analytics/correlation/${datasetId}`),
}

// ── Predictions ───────────────────────────────────────────────────────────────
export const predictionsApi = {
  list: () => api.get("/predictions"),

  get: (id: string) =>
    api.get(`/predictions/${id}`),

  create: (data: object) =>
    api.post("/predictions", data),

  update: (id: string, data: object) =>
    api.patch(`/predictions/${id}`, data),

  delete: (id: string) =>
    api.delete(`/predictions/${id}`),
};

// ── Chat ──────────────────────────────────────────────────────────────────────
export const chatApi = {
  send:          (data: object) => api.post('/chat', data),
  sessions:      ()             => api.get('/chat/sessions'),
  session:       (id: string)   => api.get(`/chat/sessions/${id}`),
  deleteSession: (id: string)   => api.delete(`/chat/sessions/${id}`),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reportsApi = {
  list:     ()             => api.get('/reports'),
  get:      (id: string)   => api.get(`/reports/${id}`),
  create:   (data: object) => api.post('/reports', data),
  download: (id: string)   => api.get(`/reports/${id}/download`, { responseType: 'blob' }),
}

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifApi = {
  list:        ()           => api.get('/notifications'),
  count:       ()           => api.get('/notifications/count'),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: ()           => api.patch('/notifications/mark-all-read'),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminApi = {
  stats:        ()                              => api.get('/admin/stats'),
  users:        ()                              => api.get('/admin/users'),
  updateRole:   (userId: string, role: string)  =>
    api.patch(`/admin/users/${userId}/role`, null, { params: { role } }),
  toggleActive: (userId: string)                => api.patch(`/admin/users/${userId}/toggle-active`),
  auditLogs:    ()                              => api.get('/admin/audit-logs'),
}