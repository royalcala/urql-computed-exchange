import gql from 'fraql';
import { createClient, cacheExchange, fetchExchange } from 'urql';

import { computedExchange, createEntity } from '../../src';
import { createMockFetch, runQuery } from '../utils';

describe('Performance Tests', () => {
  it('handles large datasets efficiently', async () => {
    const entities = {
      User: createEntity('User', {
        fullName: {
          dependencies: gql`
            fragment _ on User {
              firstName
              lastName
            }
          `,
          resolver: (user: any) => `${user.firstName} ${user.lastName}`,
        },
      }),
    };

    // Generate large dataset
    const users = Array.from({ length: 1000 }, (_, i) => ({
      id: i + 1,
      firstName: `User${i}`,
      lastName: `LastName${i}`,
      __typename: 'User',
    }));

    const client = createClient({
      url: '/graphql',
      fetch: createMockFetch()
        .post('/graphql', {
          status: 200,
          json: async () => ({
            data: { users },
          }),
        })
        .build(),
      exchanges: [cacheExchange, computedExchange({ entities }), fetchExchange],
      preferGetMethod: false,
    });

    const query = gql`
      query Users {
        users {
          id
          fullName @computed(type: User)
        }
      }
    `;

    const startTime = Date.now();
    const { data } = await runQuery(client, query);
    const endTime = Date.now();

    // Should complete within reasonable time
    expect(endTime - startTime).toBeLessThan(5000);
    
    // Verify data integrity
    expect(data.users).toHaveLength(1000);
    expect(data.users[0].fullName).toBe('User0 LastName0');
    expect(data.users[999].fullName).toBe('User999 LastName999');
  }, 10000);
});