// General-purpose in-memory cache with TTL and auto-refresh support
// Usage: const cache = new Cache(fetchFunction, ttlMs)

export class Cache<K, V> {
  private data = new Map<K, { value: V; expires: number }>();
  private fetchFn: (key: K) => Promise<V>;
  private ttl: number;

  constructor(fetchFn: (key: K) => Promise<V>, ttl: number = 60000) {
    this.fetchFn = fetchFn;
    this.ttl = ttl;
  }

  async get(key: K): Promise<V> {
    const now = Date.now();
    const cached = this.data.get(key);
    if (cached && cached.expires > now) {
      return cached.value;
    }
    const value = await this.fetchFn(key);
    this.data.set(key, { value, expires: now + this.ttl });
    return value;
  }

  set(key: K, value: V) {
    this.data.set(key, { value, expires: Date.now() + this.ttl });
  }

  clear(key?: K) {
    if (key !== undefined) {
      this.data.delete(key);
    } else {
      this.data.clear();
    }
  }
}

// Example: Staff cache (by userId)
// import { StaffService } from "../services/staffService.js";
// const staffCache = new Cache(async (userId) => staffService.getStaffByUserId(userId), 60000);
// await staffCache.get("1234567890");
