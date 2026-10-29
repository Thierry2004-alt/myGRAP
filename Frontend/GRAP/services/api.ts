import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { safeStorage } from './storage';

const isWeb = Platform.OS === 'web';

const getBackendUrl = () => {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, '');
  }

  if (isWeb) {
    return 'http://localhost:8000/api';
  }

  const hostUri = Constants.expoConfig?.hostUri || (Constants as any).manifest?.debuggerHost;
  if (hostUri) {
    const hostname = hostUri.replace(/^https?:\/\//, '').split(':')[0];
    const octets: number[] = hostname.split('.').map((part: string) => Number(part));
    const isPrivateIpv4 =
      octets.length === 4 &&
      octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) &&
      (octets[0] === 10 ||
        (octets[0] === 192 && octets[1] === 168) ||
        (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31));

    if (isPrivateIpv4) {
      return `http://${hostname}:8000/api`;
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
  phone_number: string;
  profile_picture_url: string;
  is_verified: boolean;
  is_suspended: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
}

export interface PlaceDetail {
  id: number;
  slug: string;
  name: string;
  category: string;
  categoryCode: 'DINING' | 'PARKS' | 'CULTURE' | 'SHOPPING' | 'SPORTS';
  zone: string;
  icon: string;
  latitude: number;
  longitude: number;
  description: string;
  highlights: string[];
  searchKeywords: string[];
  photoUrl: string;
  photoCredit: string;
  photoLicense: string;
  photoSourceUrl: string;
  mapSourceUrl: string;
}

class ApiService {
  private token: string | null = null;

  async warmUp() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      await fetch(`${API_BASE_URL}/auth/me/`, { signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (err: any) {
      if (controller.signal.aborted) {
        throw new Error('The server is taking too long to respond. It may be waking up; please try again.');
      }
      throw new Error(`Cannot connect to Backend server (${API_BASE_URL}). Please ensure Django server is running.`);
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      let errorMsg = `Request failed with status ${response.status}`;
      try {
        const data = await response.json();
        errorMsg = data.detail || data.error || (typeof data === 'object' ? JSON.stringify(data) : errorMsg);
      } catch {
        const text = await response.text();
        errorMsg = text ? `${errorMsg}: ${text.slice(0, 200)}` : errorMsg;
      }
      throw new Error(errorMsg);
    }

    try {
      const data = await response.json();
      return data as T;
    } catch {
      return {} as T;
    }
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

  async updateMe(data: { first_name: string; last_name: string; email: string; phone_number: string; profile_picture_url?: string }) {
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

  async getPlaces() {
    const records = await this.request<Array<{
      id: number;
      slug: string;
      name: string;
      category: string;
      category_code: PlaceDetail['categoryCode'];
      zone: string;
      icon: string;
      latitude: number;
      longitude: number;
      description: string;
      highlights: string[];
      search_keywords: string[];
      photo_url: string;
      photo_credit: string;
      photo_license: string;
      photo_source_url: string;
      map_source_url: string;
    }>>('/places/');
    return records.map((place): PlaceDetail => ({
      id: place.id,
      slug: place.slug,
      name: place.name,
      category: place.category,
      categoryCode: place.category_code,
      zone: place.zone,
      icon: place.icon,
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      description: place.description,
      highlights: place.highlights || [],
      searchKeywords: place.search_keywords || [],
      photoUrl: place.photo_url,
      photoCredit: place.photo_credit,
      photoLicense: place.photo_license,
      photoSourceUrl: place.photo_source_url,
      mapSourceUrl: place.map_source_url,
    }));
  }

  async getPlaceRecommendation(query: string) {
    return this.request<{ answer: string; source: string; recommended_place_ids: number[] }>('/ai/place-recommendation/', {
      method: 'POST',
      body: JSON.stringify({ query }),
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

  async getDriverProposals(categoryId?: number) {
    const url = categoryId ? `/driver/proposals/?category_id=${categoryId}` : '/driver/proposals/';
    return this.request<any[]>(url);
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

  async confirmDigitalPayment(rideId: number) {
    return this.request<any>('/rides/confirm-digital-payment/', {
      method: 'POST',
      body: JSON.stringify({ ride_id: rideId }),
    });
  }

  async initiateCampayPayment(payload: {
    ride_id: number;
    phone_number?: string;
    operator?: string;
    participant_id?: number;
    modal_fare?: number;
  }) {
    return this.request<{
      message: string;
      reference: string;
      ussd_code: string;
      operator: string;
      status: string;
      charged_amount: number;
      modal_amount: number;
      phone_number: string;
      ride_id: number;
      participant_id?: number;
    }>('/rides/campay/initiate/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async checkCampayStatus(reference: string, rideId?: number) {
    const url = rideId ? `/rides/campay/status/${reference}/?ride_id=${rideId}` : `/rides/campay/status/${reference}/`;
    return this.request<{
      reference: string;
      status: string;
      operator?: string;
      charged_amount?: number;
      modal_amount?: number;
      is_completed?: boolean;
      message: string;
    }>(url);
  }

  async rateDriver(rideId: number, score: number, comment?: string) {
    return this.request<any>('/rides/rate-driver/', {
      method: 'POST',
      body: JSON.stringify({ ride_id: rideId, score, comment: comment || '' }),
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

  async getDriverActiveRide() {
    return this.request<any>('/driver/active-ride/');
  }

  async updateDriverLocation(lat: number, lng: number) {
    return this.request<any>('/driver/status/', {
      method: 'POST',
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
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

  async withdrawEarnings(payload: { amount: number; phone_number?: string; operator?: 'MTN' | 'ORANGE' }) {
    return this.request<any>('/driver/withdraw/', {
      method: 'POST',
      body: JSON.stringify(payload),
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