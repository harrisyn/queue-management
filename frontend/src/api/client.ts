import axios, { AxiosInstance, AxiosError } from 'axios';
import type { Service } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8004/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as typeof error.config & { _retry?: boolean };

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (typeof window !== 'undefined') {
            const storedRefresh = localStorage.getItem('refreshToken');
            if (storedRefresh) {
              try {
                // Attempt silent token refresh
                const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
                  refreshToken: storedRefresh,
                });
                localStorage.setItem('token', data.token);
                localStorage.setItem('refreshToken', data.refreshToken);
                if (originalRequest.headers) {
                  originalRequest.headers.Authorization = 'Bearer ' + data.token;
                }
                return this.client(originalRequest);
              } catch {
                // Refresh failed — clear session and redirect
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
              }
            } else {
              localStorage.removeItem('token');
              window.location.href = '/login';
            }
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }

  async register(userData: { email: string; password: string; firstName: string; lastName: string }) {
    const { data } = await this.client.post('/auth/register', userData);
    return data;
  }

  async refreshToken(refreshToken: string) {
    const { data } = await this.client.post('/auth/refresh', { refreshToken });
    return data;
  }

  async logout(refreshToken?: string) {
    await this.client.post('/auth/logout', { refreshToken });
  }

  // Organizations
  async getOrganizations() {
    const { data } = await this.client.get('/orgs');
    return data;
  }

  async getOrganization(id: string) {
    const { data } = await this.client.get(`/orgs/${id}`);
    return data;
  }

  async createOrganization(org: { name: string; email?: string; phone?: string }) {
    const { data } = await this.client.post('/orgs', org);
    return data;
  }

  // Locations
  async getLocations(organizationId: string) {
    const { data } = await this.client.get(`/locations/orgs/${organizationId}/locations`);
    return data;
  }

  async getPublicLocations() {
    const { data } = await this.client.get('/public/locations');
    return data;
  }

  async getLocation(id: string) {
    const { data } = await this.client.get(`/locations/${id}`);
    return data;
  }

  async createLocation(organizationId: string, location: { name: string; address?: string; timezone?: string }) {
    const { data } = await this.client.post(`/locations/orgs/${organizationId}/locations`, location);
    return data;
  }

  async updateLocation(id: string, payload: { name?: string; address?: string; timezone?: string; publicCode?: string | null }) {
    const { data } = await this.client.put(`/locations/${id}`, payload);
    return data;
  }

  // Services
  async getServices(locationId: string) {
    const { data } = await this.client.get(`/services/locations/${locationId}/services`);
    return data;
  }

  async getService(id: string) {
    const { data } = await this.client.get(`/services/${id}`);
    return data;
  }

  async createService(locationId: string, service: Partial<Service>) {
    const { data } = await this.client.post(`/services/locations/${locationId}/services`, service);
    return data;
  }

  // Queues
  async createQueue(serviceId: string, date?: string) {
    const { data } = await this.client.post('/queues', { serviceId, date });
    return data;
  }

  async getQueue(id: string) {
    const { data } = await this.client.get(`/queues/${id}`);
    return data;
  }

  async getServiceQueues(serviceId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const { data } = await this.client.get(`/queues/service/${serviceId}${params}`);
    return data;
  }

  async joinQueue(queueId: string, userId: string, priority?: number) {
    const { data } = await this.client.post(`/queues/${queueId}/join`, { userId, priority });
    return data;
  }

  async callNext(queueId: string) {
    const { data } = await this.client.post(`/queues/${queueId}/call-next`);
    return data;
  }

  async markServed(queueId: string, entryId: string) {
    const { data } = await this.client.patch(`/queues/${queueId}/entry/${entryId}/serve`);
    return data;
  }

  async cancelEntry(queueId: string, entryId: string) {
    const { data } = await this.client.patch(`/queues/${queueId}/entry/${entryId}/cancel`);
    return data;
  }

  async getWaitTime(queueId: string) {
    const { data } = await this.client.get(`/queues/${queueId}/waittime`);
    return data;
  }

  async getTicket(queueId: string, entryId: string) {
    const { data } = await this.client.get(`/queues/${queueId}/ticket/${entryId}`);
    return data;
  }

  // Appointments
  async createAppointment(appointment: { userId: string; serviceId: string; slotId: string; notes?: string }) {
    const { data } = await this.client.post('/appointments', appointment);
    return data;
  }

  async getAppointments(params?: { userId?: string; serviceId?: string; date?: string }) {
    const { data } = await this.client.get('/appointments', { params });
    return data;
  }

  async getUserAppointments(userId: string, upcoming?: boolean) {
    const params = upcoming ? '?upcoming=true' : '';
    const { data } = await this.client.get(`/appointments/user/${userId}${params}`);
    return data;
  }

  async getAvailableSlots(serviceId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const { data } = await this.client.get(`/appointments/service/${serviceId}/slots${params}`);
    return data;
  }

  async checkInAppointment(id: string) {
    const { data } = await this.client.post(`/appointments/${id}/check-in`);
    return data;
  }

  // Users
  async getMe() {
    const { data } = await this.client.get('/users/me');
    return data;
  }

  async getUsers(params?: { organizationId?: string; role?: string }) {
    const { data } = await this.client.get('/users', { params });
    return data;
  }

  // Notifications
  async getNotifications(userId: string, unreadOnly?: boolean) {
    const params = unreadOnly ? '?unreadOnly=true' : '';
    const { data } = await this.client.get(`/notifications/user/${userId}${params}`);
    return data;
  }

  async markNotificationRead(id: string) {
    const { data } = await this.client.patch(`/notifications/${id}/read`);
    return data;
  }

  // Analytics
  async getDashboardSummary() {
    const { data } = await this.client.get('/analytics/summary');
    return data;
  }

  async getQueueMetrics(queueId: string) {
    const { data } = await this.client.get(`/analytics/queue/${queueId}`);
    return data;
  }

  async getServiceMetrics(serviceId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const { data } = await this.client.get(`/analytics/service/${serviceId}?${params}`);
    return data;
  }

  async getLocationMetrics(locationId: string, date?: string) {
    const params = date ? `?date=${date}` : '';
    const { data } = await this.client.get(`/analytics/location/${locationId}${params}`);
    return data;
  }

  // Invites (admin)
  async createInvite(payload: { role?: string; organizationId?: string; expiresAt?: string }) {
    const { data } = await this.client.post('/invites', payload);
    return data;
  }

  async getInvites() {
    const { data } = await this.client.get('/invites');
    return data;
  }
}

export const api = new ApiClient();
export default api;
