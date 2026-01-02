import gql from 'fraql';
import { createAsyncEntity, resolveAsyncComputedProperties, clearAsyncComputedCache } from '../async-computed';

describe('Async Computed Properties', () => {
  beforeEach(() => {
    clearAsyncComputedCache();
  });

  it('should resolve async computed properties', async () => {
    const asyncEntity = createAsyncEntity('User', {
      asyncFullName: {
        dependencies: gql`fragment _ on User { firstName lastName }`,
        resolver: async (user: any) => {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return `${user.firstName} ${user.lastName}`;
        },
      },
    });

    const userData = {
      __typename: 'User',
      firstName: 'John',
      lastName: 'Doe',
    };

    const result = await asyncEntity.resolve(userData);
    expect((result as any).asyncFullName).toBe('John Doe');
  });

  it('should cache async computed results', async () => {
    let callCount = 0;
    
    const properties = {
      expensiveComputation: {
        dependencies: gql`fragment _ on User { id }`,
        resolver: async (user: any) => {
          callCount++;
          await new Promise(resolve => setTimeout(resolve, 10));
          return `computed-${user.id}`;
        },
        cacheKey: (user: any) => user.id,
        ttl: 1000,
      },
    };

    const userData = {
      __typename: 'User',
      id: '123',
    };

    // First call
    const result1 = await resolveAsyncComputedProperties(userData, properties);
    expect((result1 as any).expensiveComputation).toBe('computed-123');
    expect(callCount).toBe(1);

    // Second call should use cache
    const result2 = await resolveAsyncComputedProperties(userData, properties);
    expect((result2 as any).expensiveComputation).toBe('computed-123');
    expect(callCount).toBe(1); // Should not increment
  });

  it('should handle async resolver errors gracefully', async () => {
    const properties = {
      failingProperty: {
        dependencies: gql`fragment _ on User { id }`,
        resolver: async (_user: any) => {
          throw new Error('Async resolver failed');
        },
      },
    };

    const userData = {
      __typename: 'User',
      id: '123',
    };

    const result = await resolveAsyncComputedProperties(userData, properties);
    expect((result as any).failingProperty).toBeUndefined();
  });

  it('should respect TTL for cached values', async () => {
    let callCount = 0;
    
    const properties = {
      shortLivedProperty: {
        dependencies: gql`fragment _ on User { id }`,
        resolver: async (_user: any) => {
          callCount++;
          return `value-${callCount}`;
        },
        cacheKey: (user: any) => user.id,
        ttl: 50, // Very short TTL
      },
    };

    const userData = {
      __typename: 'User',
      id: '123',
    };

    // First call
    const result1 = await resolveAsyncComputedProperties(userData, properties);
    expect((result1 as any).shortLivedProperty).toBe('value-1');

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 60));

    // Second call should not use cache
    const result2 = await resolveAsyncComputedProperties(userData, properties);
    expect((result2 as any).shortLivedProperty).toBe('value-2');
    expect(callCount).toBe(2);
  });
});