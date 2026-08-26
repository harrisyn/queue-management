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
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async login(email: string, password: string, options?: { slug?: string; adminLogin?: boolean }) {
    const { data } = await this.client.post('/auth/login', { email, password, ...options });
    return data;
  }

  async register(userData: { email: string; password: string; firstName: string; lastName: string }) {
    const { data } = await this.client.post('/auth/register', userData);
    return data;
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

  async getOrgBySlug(slug: string): Promise<{ id: string; name: string; slug: string; logoUrl: string | null; primaryColor: string | null; hidePoweredBy: boolean } | null> {
    try {
      const { data } = await this.client.get(`/public/orgs/by-slug/${encodeURIComponent(slug)}`);
      return data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async getLocation(id: string) {
    const { data } = await this.client.get(`/locations/${id}`);
    return data;
  }

  async createLocation(organizationId: string, location: { name: string; address?: string; timezone?: string }) {
    const { data } = await this.client.post(`/locations/orgs/${organizationId}/locations`, location);
    return data;
  }

  async updateLocation(id: string, payload: { name?: string; address?: string; timezone?: string; publicCode?: string | null; externalReference?: string | null }) {
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

  async createService(payload: Partial<Service> & {
    locationIds: string[];
    servicePoints?: { servicePointId: string; capacity: number }[];
  }) {
    const { data } = await this.client.post('/services', payload);
    return data as { services: Service[] };
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

  // Subscription
  async getMySubscription() {
    const { data } = await this.client.get('/subscription');
    return data;
  }

  async getPlans() {
    const { data } = await this.client.get('/plans', { params: { includeInactive: false } });
    return data;
  }

  async createSubscriptionCheckout(payload: { planId: string; provider: 'stripe' | 'paystack'; billingCycle: 'monthly' | 'quarterly' | 'yearly' }) {
    const { data } = await this.client.post('/tenant/subscription/checkout', payload);
    return data;
  }

  async switchToFreePlan(planId: string) {
    const { data } = await this.client.post(`/tenant/subscription/switch/${planId}`);
    return data as { success: boolean; planId: string; planName: string };
  }

  // Add-ons
  async getMyAddOns() {
    const { data } = await this.client.get('/tenant/addons');
    return data;
  }

  async createAddOnCheckout(payload: { resourceType: 'LOCATIONS' | 'USERS'; quantity: number; billingMode: 'recurring' | 'one_off'; provider: 'stripe' | 'paystack' }) {
    const { data } = await this.client.post('/tenant/addons/checkout', payload);
    return data;
  }

  async cancelAddOn(id: string) {
    const { data } = await this.client.delete(`/tenant/addons/${id}`);
    return data;
  }

  async getMyAddOnPricing() {
    const { data } = await this.client.get('/tenant/addon-pricing');
    return data;
  }

  async getAddOnPricing() {
    const { data } = await this.client.get('/superadmin/addon-pricing');
    return data;
  }

  async updateAddOnPricing(resourceType: 'LOCATIONS' | 'USERS', payload: { pricePerUnitMonthly: number; pricePerUnitOneOff: number; currency?: string }) {
    const { data } = await this.client.put(`/superadmin/addon-pricing/${resourceType}`, payload);
    return data;
  }

  async getUsers(params?: { organizationId?: string; role?: string }) {
    const { data } = await this.client.get('/users', { params });
    return data;
  }

  async getUser(id: string) {
    const { data } = await this.client.get(`/users/${id}`);
    return data;
  }

  async updateUserIdentity(userId: string, identityData: Record<string, unknown>) {
    const { data } = await this.client.put(`/users/${userId}/identity`, { identityData });
    return data;
  }

  async fetchFromDataSource(sourceId: string, params: { identifier: string; identifierType?: string }) {
    const { data } = await this.client.post(`/data-sources/${sourceId}/fetch`, params);
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

  // Enhanced analytics
  async getDetailedAnalytics(locationId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    const { data } = await this.client.get(`/analytics/location/${locationId}/detailed${queryString ? `?${queryString}` : ''}`);
    return data;
  }

  async getJourneyAnalytics(locationId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const queryString = params.toString();
    const { data } = await this.client.get(`/analytics/location/${locationId}/journeys${queryString ? `?${queryString}` : ''}`);
    return data;
  }

  async getPeakHoursAnalysis(serviceId: string, days?: number) {
    const params = days ? `?days=${days}` : '';
    const { data } = await this.client.get(`/analytics/service/${serviceId}/peak-hours${params}`);
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

  // Public endpoints (no auth required)
  async getLocationByCode(code: string) {
    const { data } = await this.client.get(`/public/locations/${code}`);
    return data;
  }

  async publicJoinQueue(payload: { serviceId: string; name: string; phone?: string; notes?: string }) {
    const { data } = await this.client.post('/public/join', payload);
    return data;
  }

  async getPublicStatus(queueId: string, entryId: string) {
    const { data } = await this.client.get(`/public/status/${queueId}/${entryId}`);
    return data;
  }

  // Session-based public join (for returning users)
  async publicJoinQueueWithSession(payload: { 
    serviceId: string; 
    name: string; 
    phone?: string; 
    notes?: string;
    sessionId?: string;
  }) {
    const { data } = await this.client.post('/public/join', payload);
    return data;
  }

  // Get all tickets for a session
  async getSessionTickets(sessionId: string) {
    const { data } = await this.client.get(`/public/session/${sessionId}/tickets`);
    return data;
  }

  // Get display data for TV screens
  async getDisplayData(locationId: string) {
    const { data } = await this.client.get(`/public/display/${locationId}`);
    return data;
  }

  // Get queue swimlanes for a location (for display boards)
  async getLocationQueues(locationId: string) {
    const { data } = await this.client.get(`/public/queues/${locationId}`);
    return data;
  }

  // Service Points
  async getServicePoints(organizationId: string) {
    const { data } = await this.client.get(`/service-points/organization/${organizationId}`);
    return data;
  }

  async getActiveServicePoints(locationId: string) {
    const { data } = await this.client.get(`/service-points/location/${locationId}/active`);
    return data;
  }

  async getServicePointsForService(serviceId: string) {
    const { data } = await this.client.get(`/service-points/service/${serviceId}`);
    return data;
  }

  async createServicePoint(payload: {
    organizationId: string;
    name: string;
    displayName?: string;
    type?: string;
    capacity?: number;
  }) {
    const { data } = await this.client.post('/service-points', payload);
    return data;
  }

  async updateServicePoint(id: string, payload: {
    name?: string;
    displayName?: string;
    type?: string;
    capacity?: number;
    isActive?: boolean;
  }) {
    const { data } = await this.client.patch(`/service-points/${id}`, payload);
    return data;
  }

  async deleteServicePoint(id: string) {
    await this.client.delete(`/service-points/${id}`);
  }

  // Service point linking to services (admin)
  async linkServicePointToService(servicePointId: string, serviceId: string, capacity: number) {
    const { data } = await this.client.post('/service-points/link', { servicePointId, serviceId, capacity });
    return data;
  }

  async unlinkServicePointFromService(servicePointId: string, serviceId: string) {
    const { data } = await this.client.post('/service-points/unlink', { servicePointId, serviceId });
    return data;
  }

  async updateServicePointLink(linkId: string, updates: { capacity?: number | null }) {
    const { data } = await this.client.patch(`/service-points/link/${linkId}`, updates);
    return data;
  }

  // Service point activation (operator desk management) - legacy
  async activateServicePoint(servicePointId: string, serviceId: string) {
    const { data } = await this.client.post('/service-points/activate', { servicePointId, serviceId });
    return data;
  }

  async vacateServicePoint(servicePointId: string, serviceId: string) {
    const { data } = await this.client.post('/service-points/vacate', { servicePointId, serviceId });
    return data;
  }

  // Service Point Instances
  async getServicePointInstances(servicePointId: string) {
    const { data } = await this.client.get(`/service-points/${servicePointId}/instances`);
    return data;
  }

  async getServiceInstances(serviceId: string) {
    const { data } = await this.client.get(`/service-points/service/${serviceId}/instances`);
    return data;
  }

  async getLocationInstances(locationId: string) {
    const { data } = await this.client.get(`/service-points/location/${locationId}/instances`);
    return data;
  }

  async activateServicePointInstance(instanceId: string, serviceId?: string) {
    const { data } = await this.client.post(`/service-points/instances/${instanceId}/activate`, { serviceId });
    return data;
  }

  async vacateServicePointInstance(instanceId: string) {
    const { data } = await this.client.post(`/service-points/instances/${instanceId}/vacate`);
    return data;
  }

  async toggleInstanceActive(instanceId: string, isActive: boolean) {
    const { data } = await this.client.patch(`/service-points/instances/${instanceId}/toggle`, { isActive });
    return data;
  }

  // Service Flows (for flow designer)
  async getLocationFlows(locationId: string) {
    const { data } = await this.client.get(`/service-flows/location/${locationId}`);
    return data;
  }

  async getServiceFlows(serviceId: string) {
    const { data } = await this.client.get(`/service-flows/service/${serviceId}`);
    return data;
  }

  async getNextServices(serviceId: string) {
    const { data } = await this.client.get(`/service-flows/service/${serviceId}/next`);
    return data;
  }

  async createServiceFlow(payload: {
    fromServiceId: string;
    toServiceId: string;
    priority?: number;
    displayName?: string;
    condition?: string;
    autoTransfer?: boolean;
    isRequired?: boolean;
  }) {
    const { data } = await this.client.post('/service-flows', payload);
    return data;
  }

  async updateServiceFlow(id: string, payload: {
    priority?: number;
    displayName?: string;
    condition?: string;
    autoTransfer?: boolean;
    isRequired?: boolean;
  }) {
    const { data } = await this.client.patch(`/service-flows/${id}`, payload);
    return data;
  }

  async deleteServiceFlow(id: string) {
    await this.client.delete(`/service-flows/${id}`);
  }

  async updateFlowOrder(flows: { id: string; priority: number }[]) {
    const { data } = await this.client.patch('/service-flows/order', { flows });
    return data;
  }

  // Enhanced Queue Operations (for operators)
  async getQueueForOperator(queueId: string) {
    const { data } = await this.client.get(`/queues/${queueId}/operator`);
    return data;
  }

  async reorderQueueEntries(queueId: string, entries: { id: string; sortOrder: number }[]) {
    const { data } = await this.client.patch(`/queues/${queueId}/reorder`, { entries });
    return data;
  }

  async callNextWithServicePoint(queueId: string, servicePointInstanceId?: string) {
    const { data } = await this.client.post(`/queues/${queueId}/call-next-sp`, {
      servicePointInstanceId
    });
    return data;
  }

  async completeEntryWithSuggestions(queueId: string, entryId: string) {
    const { data } = await this.client.patch(`/queues/${queueId}/entry/${entryId}/complete`);
    return data;
  }

  // Public organization registration (SaaS flow)
  async registerOrganization(payload: {
    organizationName: string;
    email: string;
    phone?: string;
    adminFirstName: string;
    adminLastName: string;
    adminPassword: string;
    emailVerified?: boolean;
    slug?: string;
  }) {
    const { data } = await this.client.post('/public/register-org', payload);
    return data;
  }

  async getPublicOrganization(orgId: string) {
    const { data } = await this.client.get(`/public/orgs/${orgId}`);
    return data;
  }

  async getPublicLocationServices(orgId: string, locationId: string) {
    const { data } = await this.client.get(`/public/orgs/${orgId}/locations/${locationId}/services`);
    return data;
  }

  // Get location info by internal ID (for display boards)
  async getPublicLocationInfo(locationId: string) {
    const { data } = await this.client.get(`/public/location-info/${locationId}`);
    return data;
  }

  // OTP verification
  async sendOTP(email: string) {
    const { data } = await this.client.post('/public/send-otp', { email });
    return data;
  }

  async verifyOTP(email: string, code: string) {
    const { data } = await this.client.post('/public/verify-otp', { email, code });
    return data;
  }

  // Organization management
  async updateOrganization(id: string, payload: { 
    name?: string; 
    email?: string; 
    phone?: string; 
    slug?: string;
    identityFieldsConfig?: Record<string, { required: boolean; label: string; type?: string }>;
    defaultDisplayMode?: string;
  }) {
    const { data } = await this.client.put(`/orgs/${id}`, payload);
    return data;
  }

  // Data Sources
  async getDataSources(organizationId: string) {
    const { data } = await this.client.get(`/orgs/${organizationId}/data-sources`);
    return data;
  }

  async getDataSource(id: string) {
    const { data } = await this.client.get(`/data-sources/${id}`);
    return data;
  }

  async createDataSource(organizationId: string, source: {
    name: string;
    description?: string;
    type: 'API' | 'DATABASE' | 'FILE' | 'WEBHOOK';
    config: Record<string, unknown>;
    isActive?: boolean;
  }) {
    const { data } = await this.client.post(`/orgs/${organizationId}/data-sources`, source);
    return data;
  }

  async updateDataSource(id: string, payload: {
    name?: string;
    description?: string;
    type?: 'API' | 'DATABASE' | 'FILE' | 'WEBHOOK';
    config?: Record<string, unknown>;
    isActive?: boolean;
  }) {
    const { data } = await this.client.put(`/data-sources/${id}`, payload);
    return data;
  }

  async deleteDataSource(id: string) {
    await this.client.delete(`/data-sources/${id}`);
  }

  async testDataSource(id: string, testParams?: Record<string, unknown>) {
    const { data } = await this.client.post(`/data-sources/${id}/test`, testParams || {});
    return data;
  }

  // Field Mappings
  async getFieldMappings(dataSourceId: string) {
    const { data } = await this.client.get(`/data-sources/${dataSourceId}/mappings`);
    return data;
  }

  async createFieldMapping(dataSourceId: string, mapping: {
    sourcePath: string;
    targetField: string;
    transform?: string;
  }) {
    const { data } = await this.client.post(`/data-sources/${dataSourceId}/mappings`, mapping);
    return data;
  }

  async updateFieldMapping(id: string, payload: {
    sourcePath?: string;
    targetField?: string;
    transform?: string;
  }) {
    const { data } = await this.client.put(`/field-mappings/${id}`, payload);
    return data;
  }

  async deleteFieldMapping(id: string) {
    await this.client.delete(`/field-mappings/${id}`);
  }

  // Location management
  async deleteLocation(id: string) {
    await this.client.delete(`/locations/${id}`);
  }

  // Service management
  async updateService(id: string, payload: Partial<Service> & {
    servicePoints?: { servicePointId: string; capacity: number }[];
  }) {
    const { data } = await this.client.put(`/services/${id}`, payload);
    return data;
  }

  async deleteService(id: string) {
    await this.client.delete(`/services/${id}`);
  }

  // Dashboard stats
  async getDashboardStats(organizationId: string) {
    // Aggregate stats from locations, services, queues
    const locations = await this.getLocations(organizationId);
    let totalServices = 0;
    let activeQueues = 0;
    let todayServed = 0;

    for (const loc of locations) {
      const services = await this.getServices(loc.id);
      totalServices += services.length;

      for (const svc of services) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const queues = await this.getServiceQueues(svc.id, today);
          if (queues && queues.length > 0) {
            for (const q of queues) {
              if (q.status === 'ACTIVE') activeQueues++;
              if (q.entries) {
                todayServed += q.entries.filter((e: any) => e.status === 'SERVED').length;
              }
            }
          }
        } catch { /* ignore */ }
      }
    }

    return {
      locations: locations.length,
      services: totalServices,
      activeQueues,
      todayServed
    };
  }

  // =====================================================
  // SUPERADMIN API
  // =====================================================

  // Dashboard
  async getSuperadminDashboard() {
    const { data } = await this.client.get('/superadmin/dashboard');
    return data;
  }

  // Organizations
  async getSuperadminOrganizations(params?: { search?: string; status?: string; planId?: string; page?: number; limit?: number }) {
    const { data } = await this.client.get('/superadmin/organizations', { params });
    return data;
  }

  async getSuperadminOrganization(id: string) {
    const { data } = await this.client.get(`/superadmin/organizations/${id}`);
    return data;
  }

  async getSuperadminOrganizationUsage(id: string) {
    const { data } = await this.client.get(`/superadmin/organizations/${id}/usage`);
    return data;
  }

  async updateOrganizationSubscription(id: string, payload: {
    planId?: string;
    status?: string;
    billingCycle?: string;
    trialEndsAt?: string;
    externalProviderSubscriptionId?: string;
  }) {
    const { data } = await this.client.patch(`/superadmin/organizations/${id}/subscription`, payload);
    return data;
  }

  async cancelOrganizationSubscription(id: string, reason?: string) {
    const { data } = await this.client.post(`/superadmin/organizations/${id}/cancel`, { reason });
    return data;
  }

  async deleteSuperadminOrganization(id: string) {
    const { data } = await this.client.delete(`/superadmin/organizations/${id}`, { data: { confirm: 'DELETE' } });
    return data;
  }

  // Subscription Plans
  async getSubscriptionPlans(includeInactive?: boolean) {
    const { data } = await this.client.get('/superadmin/plans', { params: { includeInactive } });
    return data;
  }

  async createSubscriptionPlan(payload: {
    name: string;
    code: string;
    description?: string;
    priceMonthly?: number;
    priceQuarterly?: number;
    priceYearly?: number;
    currency?: string;
    maxLocations?: number | null;
    maxServicesPerLoc?: number | null;
    maxUsersPerOrg?: number | null;
    maxQueueEntriesPerDay?: number | null;
    features?: Record<string, boolean>;
    displayOrder?: number;
    tierRank?: number;
    isDefault?: boolean;
    isRecommended?: boolean;
    trialDurationDays?: number | null;
    expiredFallbackPlanId?: string | null;
    upgradePlanId?: string | null;
    creditAllowances?: Partial<Record<'AI' | 'EMAIL' | 'SMS', number | null>>;
    addOnPricingOverrides?: Partial<Record<'LOCATIONS' | 'USERS', { pricePerUnitMonthly: number; pricePerUnitOneOff: number } | null>>;
  }) {
    const { data } = await this.client.post('/superadmin/plans', payload);
    return data;
  }

  async updateSubscriptionPlan(id: string, payload: {
    name?: string;
    description?: string;
    priceMonthly?: number;
    priceQuarterly?: number;
    priceYearly?: number;
    currency?: string;
    maxLocations?: number | null;
    maxServicesPerLoc?: number | null;
    maxUsersPerOrg?: number | null;
    maxQueueEntriesPerDay?: number | null;
    features?: Record<string, boolean>;
    displayOrder?: number;
    tierRank?: number;
    isActive?: boolean;
    isDefault?: boolean;
    isRecommended?: boolean;
    trialDurationDays?: number | null;
    expiredFallbackPlanId?: string | null;
    upgradePlanId?: string | null;
    creditAllowances?: Partial<Record<'AI' | 'EMAIL' | 'SMS', number | null>>;
    addOnPricingOverrides?: Partial<Record<'LOCATIONS' | 'USERS', { pricePerUnitMonthly: number; pricePerUnitOneOff: number } | null>>;
  }) {
    const { data } = await this.client.patch(`/superadmin/plans/${id}`, payload);
    return data;
  }

  async grantCredits(organizationId: string, payload: { creditType: 'AI' | 'EMAIL' | 'SMS'; amount: number; reason: string }) {
    const { data } = await this.client.post(`/superadmin/organizations/${organizationId}/credits/grant`, payload);
    return data;
  }

  async deleteSubscriptionPlan(id: string) {
    const { data } = await this.client.delete(`/superadmin/plans/${id}`);
    return data;
  }

  async getPaymentProviders() {
    const { data } = await this.client.get('/superadmin/payment-providers');
    return data;
  }

  async savePaymentProvider(provider: 'stripe' | 'paystack', payload: { publicKey?: string; secretKey: string; webhookSecret: string; isActive: boolean }) {
    const { data } = await this.client.put(`/superadmin/payment-providers/${provider}`, payload);
    return data;
  }

  async testPaymentProvider(provider: 'stripe' | 'paystack') {
    const { data } = await this.client.post(`/superadmin/payment-providers/${provider}/test`);
    return data;
  }
}

export const api = new ApiClient();
export default api;
