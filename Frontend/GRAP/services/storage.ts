import AsyncStorage from '@react-native-async-storage/async-storage';

const memoryStore: Record<string, string> = {};
let nativeStorageUnavailable = false;

const hasWebStorage = () => typeof window !== 'undefined' && !!window.localStorage;

export const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (hasWebStorage()) {
        return window.localStorage.getItem(key);
      }
      if (nativeStorageUnavailable) return memoryStore[key] || null;
      const val = await AsyncStorage.getItem(key);
      return val;
    } catch (e) {
      nativeStorageUnavailable = true;
      return memoryStore[key] || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (hasWebStorage()) {
        window.localStorage.setItem(key, value);
        return;
      }
      if (nativeStorageUnavailable) {
        memoryStore[key] = value;
        return;
      }
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      nativeStorageUnavailable = true;
      memoryStore[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (hasWebStorage()) {
        window.localStorage.removeItem(key);
        return;
      }
      if (nativeStorageUnavailable) {
        delete memoryStore[key];
        return;
      }
      await AsyncStorage.removeItem(key);
    } catch (e) {
      nativeStorageUnavailable = true;
      delete memoryStore[key];
    }
  },
};

const RIDE_KEY = '@active_passenger_ride';
const POINTS_KEY = '@user_loyalty_points';
const PAYMENT_KEY = '@user_payment_methods';

const getPointsKey = (userId?: number | string) => `${POINTS_KEY}:${userId || 'anonymous'}`;
const getPaymentKey = (userId?: number | string) => `${PAYMENT_KEY}:${userId || 'anonymous'}`;

export interface PaymentMethods {
  mtn: string;
  orange: string;
}

export const paymentStorage = {
  async get(userId?: number | string): Promise<PaymentMethods> {
    const raw = await safeStorage.getItem(getPaymentKey(userId));
    if (!raw) return { mtn: '', orange: '' };
    try { return JSON.parse(raw); } catch { return { mtn: '', orange: '' }; }
  },
  async save(userId: number | string | undefined, methods: PaymentMethods): Promise<void> {
    await safeStorage.setItem(getPaymentKey(userId), JSON.stringify(methods));
  },
};

export const activeRideStorage = {
  async save(ride: any): Promise<void> {
    if (!ride) {
      await safeStorage.removeItem(RIDE_KEY);
      return;
    }
    await safeStorage.setItem(RIDE_KEY, JSON.stringify(ride));
  },

  async get(): Promise<any | null> {
    const raw = await safeStorage.getItem(RIDE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    await safeStorage.removeItem(RIDE_KEY);
  },
};

export const loyaltyStorage = {
  async getPoints(userId?: number | string): Promise<number> {
    const val = await safeStorage.getItem(getPointsKey(userId));
    return val ? parseInt(val, 10) || 0 : 0;
  },

  async addPoints(pts: number, userId?: number | string): Promise<number> {
    const current = await this.getPoints(userId);
    const updated = current + pts;
    await safeStorage.setItem(getPointsKey(userId), updated.toString());
    return updated;
  },
};
