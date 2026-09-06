import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { safeStorage } from './storage';

const isWeb = Platform.OS === 'web';

const getBackendUrl = () => {
  if (isWeb) {
    return 'http://localhost:8000/api';
  }

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:8000/api`;
    }
  }
  return 'https://mygrap.onrender.com/api';
};

export const API_BASE_URL = getBackendUrl();


export interface User {
  id: number;
  username: string;
  email: string;
  role: 'PASSENGER' | 'DRIVER' | 'ADMIN';
  first_name: string;
  last_name: string;
  is_verified: boolean;
}

class ApiService {
  private token: string | null = null;

  async initToken() {
    try {
      this.token = await safeStorage.getItem('grap_access_token');
    } catch (e) {
      this.token = null;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      safeStorage.setItem('grap_access_token', token);
    } else {
      safeStorage.removeItem('grap_access_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.token) {
      this.token = await safeStorage.getItem('grap_access_token');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
    } catch (err: any) {
      throw new Error(`Cannot connect to Backend server (${API_BASE_URL}). Please ensure Django server is running.`);
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.detail || data.error || (typeof data === 'object' ? JSON.stringify(data) : 'Request failed');
      throw new Error(errorMsg);
    }

    return data as T;
  }


  // Auth APIs
  async login(username: string, password: string) {
    const data = await this.request<{ access: string; refresh: string; user: User }>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.access);
    return data;
  }

  async register(userData: any) {
    return this.request<User>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async getMe() {
    return this.request<{ user: User; profile: any }>('/auth/me/');
  }

  async updateMe(data: { first_name: string; last_name: string; email: string; phone_number: string }) {
    return this.request<User>('/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async requestEmailVerification() {
    return this.request<{ message: string }>('/auth/verification/request/', { method: 'POST' });
  }

  async verifyEmail(code: string) {
    return this.request<{ message: string; user: User }>('/auth/verification/verify/', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async getPlaceRecommendation(query: string, places: Array<{ name: string; zone: string; description: string }>) {
    return this.request<{ answer: string }>('/ai/place-recommendation/', {
      method: 'POST',
      body: JSON.stringify({ query, places }),
    });
  }

  // Passenger APIs
  async getCategories() {
    return this.request<any[]>('/categories/');
  }

  async estimateFare(payload: { pickup_lat: number; pickup_lng: number; destination_lat: number; destination_lng: number; category_id: number }) {
    return this.request<any>('/rides/estimate/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async requestRide(payload: any) {
    return this.request<any>('/rides/request/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMyRides() {
    return this.request<any[]>('/rides/my-rides/').catch(() => []);
  }

  async cancelRide(rideId: number) {
    return this.request<any>(`/rides/cancel/${rideId}/`, {
      method: 'POST',
    }).catch(() => ({ status: 'CANCELLED' }));
  }

  // Voluntary Shared Ride APIs
  async searchSharedRides(payload: any) {
    return this.request<{ count: number; shareable_rides: any[] }>('/rides/shared/search/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async joinSharedRide(payload: any) {
    return this.request<any>('/rides/shared/join/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async makeRideShareable(rideId: number) {
    return this.request<any>('/rides/shared/make-shareable/', {
      method: 'POST',
      body: JSON.stringify({ ride_id: rideId }),
    });
  }

  async getSharedRideStatus(sharedRideId: number) {
    return this.request<any>(`/rides/shared/${sharedRideId}/`);
  }

  async getMySharedRides() {
    return this.request<{ joined: any[]; initiated: any[] }>('/rides/shared/mine/');
  }

  async confirmSharedPayment(participantId: number) {
    return this.request<any>(`/rides/shared/participant/${participantId}/confirm-payment/`, { method: 'POST' });
  }

  async confirmCashOTP(rideId: number, otpPin: string) {
    return this.request<any>('/rides/confirm-cash-otp/', {
      method: 'POST',
      body: JSON.stringify({ ride_id: rideId, otp_pin: otpPin }),
    });
  }

  // Driver APIs
  async toggleDriverStatus(isOnline: boolean, lat?: number, lng?: number) {
    return this.request<any>('/driver/status/', {
      method: 'POST',
      body: JSON.stringify({ is_online: isOnline, latitude: lat, longitude: lng }),
    });
  }

  async getRideRequests() {
    return this.request<any[]>('/driver/ride-requests/');
  }

  async acceptRide(rideId: number) {
    return this.request<any>(`/driver/accept-ride/${rideId}/`, { method: 'POST' });
  }

  async updateRideStatus(rideId: number, status: string) {
    return this.request<any>(`/driver/update-ride/${rideId}/`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async getDriverEarnings() {
    return this.request<any>('/driver/earnings/');
  }

  async withdrawEarnings(amount: number) {
    return this.request<any>('/driver/withdraw/', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  // Driver AI Recommendations
  async getDriverAIRecommendations() {
    return this.request<any>('/driver/ai-recommendations/');
  }

  // Admin APIs
  async getAdminDrivers() {
    return this.request<any[]>('/admin/drivers/');
  }

  async verifyDriver(driverId: number, status: 'VERIFIED' | 'REJECTED') {
    return this.request<any>('/admin/drivers/', {
      method: 'POST',
      body: JSON.stringify({ driver_id: driverId, status }),
    });
  }

  async getAdminMetrics() {
    return this.request<any>('/admin/metrics/');
  }
}

export const api = new ApiService();
