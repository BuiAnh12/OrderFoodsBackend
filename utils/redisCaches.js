// utils/redisCache.js
const redisClient = require("../config/redis");

const DEFAULT_TTL = 3600; // 1 hour

const redisCache = {
  /**
   * Get a cached value by key.
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async get(key) {
    try {
      const cached = await redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      console.error(`❌ Redis GET error for key "${key}":`, err);
      return null;
    }
  },

  /**
   * Set a value to cache with optional TTL.
   * @param {string} key
   * @param {any} value
   * @param {number} ttl
   */
  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttl,
      });
      console.log('Redis set successfull')
    } catch (err) {
      console.error(`❌ Redis SET error for key "${key}":`, err);
    }
  },

  /**
   * Delete a specific key from cache.
   * @param {string} key
   */
  async del(key) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.error(`❌ Redis DEL error for key "${key}":`, err);
    }
  },

  /**
   * Delete all keys matching a pattern.
   * Uses SCAN + DEL for performance and safety.
   * @param {string} pattern e.g. "dishes:store:*"
   */
  async delByPattern(pattern) {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redisClient.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        cursor = nextCursor;

        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      console.error(`❌ Redis pattern DEL error for pattern "${pattern}":`, err);
    }
  },
};

module.exports = redisCache;
