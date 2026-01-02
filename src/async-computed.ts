import { DocumentNode } from 'graphql';
import { GraphQLObject } from './types';

/**
 * Async resolver function type
 */
export type AsyncComputedResolver<T extends GraphQLObject = GraphQLObject, R = any> = (
  data: T
) => Promise<R>;

/**
 * Async computed property definition
 */
export interface AsyncComputedProperty<T extends GraphQLObject = GraphQLObject, R = any> {
  dependencies: DocumentNode;
  resolver: AsyncComputedResolver<T, R>;
  cacheKey?: (data: T) => string;
  ttl?: number; // Time to live in milliseconds
}

/**
 * Cache for async computed results
 */
class AsyncComputedCache {
  private cache = new Map<string, { value: any; timestamp: number; ttl: number }>();

  set(key: string, value: any, ttl: number = 5 * 60 * 1000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl,
    });
  }

  get(key: string): any | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}

const asyncCache = new AsyncComputedCache();

/**
 * Resolve async computed properties with caching
 */
export async function resolveAsyncComputedProperties<T extends GraphQLObject>(
  data: T,
  properties: Record<string, AsyncComputedProperty<T>>
): Promise<Partial<T>> {
  const results: Partial<T> = {};
  
  const promises = Object.entries(properties).map(async ([key, property]) => {
    try {
      // Generate cache key
      const cacheKey = property.cacheKey 
        ? `${data.__typename}:${key}:${property.cacheKey(data)}`
        : `${data.__typename}:${key}:${JSON.stringify(data)}`;

      // Check cache first
      const cached = asyncCache.get(cacheKey);
      if (cached !== undefined) {
        return [key, cached];
      }

      // Resolve async
      const result = await property.resolver(data);
      
      // Cache result
      asyncCache.set(cacheKey, result, property.ttl);
      
      return [key, result];
    } catch (error) {
      console.warn(`Async computed property "${key}" failed:`, error);
      return [key, undefined];
    }
  });

  const resolvedEntries = await Promise.all(promises);
  
  for (const [key, value] of resolvedEntries) {
    (results as any)[key] = value;
  }

  return results;
}

/**
 * Create an async computed entity
 */
export function createAsyncEntity<T extends GraphQLObject = GraphQLObject>(
  typeName: string,
  properties: Record<string, AsyncComputedProperty<T>>
) {
  return {
    __typename: typeName,
    asyncComputedProperties: properties,
    resolve: (data: T) => resolveAsyncComputedProperties(data, properties),
  };
}

/**
 * Clear the async computed cache
 */
export function clearAsyncComputedCache(): void {
  asyncCache.clear();
}