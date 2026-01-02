import gql from 'fraql';
import { Client, cacheExchange, createClient, fetchExchange } from 'urql';

import { computedExchange, createEntity } from '../../src';
import { createMockFetch, runQuery } from '../utils';

describe('urql-computed-exchange', () => {
  describe('computed-exchange', () => {
    describe('computedExchange', () => {
      let client: Client;
      let entities: any;

      beforeAll(() => {
        entities = {
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

        client = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => ({
                data: {
                  user: {
                    id: 1,
                    firstName: 'Lorem',
                    lastName: 'Ipsum',
                    __typename: 'User',
                  },
                },
              }),
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities }), fetchExchange],
          preferGetMethod: false,
        });
      });

      it('runs queries without computed properties', async () => {
        const query = gql`
          query User {
            user(id: "id") {
              id
              firstName
              lastName
            }
          }
        `;

        const result = await runQuery(client, query);
        const { data } = result;
        expect(data).toMatchObject({
          user: {
            id: 1,
            firstName: 'Lorem',
            lastName: 'Ipsum',
          },
        });
      });

      it('runs queries with computed properties', async () => {
        const query = gql`
          query User {
            user(id: "id") {
              id
              firstName
              lastName
              fullName @computed(type: User)
            }
          }
        `;

        const { data } = await runQuery(client, query);
        expect(data).toMatchObject({
          user: {
            id: 1,
            firstName: 'Lorem',
            lastName: 'Ipsum',
            fullName: 'Lorem Ipsum',
          },
        });
      });

      it('handles complex computed property chains', async () => {
        const chainEntities = {
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
            displayName: {
              dependencies: gql`
                fragment _ on User {
                  fullName @computed(type: User)
                  title
                }
              `,
              resolver: (user: any) => `${user.title} ${user.fullName}`,
            },
            signature: {
              dependencies: gql`
                fragment _ on User {
                  displayName @computed(type: User)
                  department
                }
              `,
              resolver: (user: any) => `${user.displayName} - ${user.department}`,
            },
          }),
        };

        const chainClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => ({
                data: {
                  user: {
                    id: 1,
                    firstName: 'John',
                    lastName: 'Doe',
                    title: 'Dr.',
                    department: 'Engineering',
                    __typename: 'User',
                  },
                },
              }),
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities: chainEntities }), fetchExchange],
          preferGetMethod: false,
        });

        const query = gql`
          query User {
            user(id: "id") {
              id
              signature @computed(type: User)
            }
          }
        `;

        const { data } = await runQuery(chainClient, query);
        expect(data).toMatchObject({
          user: {
            id: 1,
            signature: 'Dr. John Doe - Engineering',
          },
        });
      });

      it('handles multiple computed properties on same object', async () => {
        const query = gql`
          query User {
            user(id: "id") {
              id
              fullName @computed(type: User)
              fullName2: fullName @computed(type: User)
              fullName3: fullName @computed(type: User)
            }
          }
        `;

        const { data } = await runQuery(client, query);
        expect(data).toMatchObject({
          user: {
            id: 1,
            fullName: 'Lorem Ipsum',
            fullName2: 'Lorem Ipsum',
            fullName3: 'Lorem Ipsum',
          },
        });
      });

      it('handles arrays with computed properties', async () => {
        const arrayClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => ({
                data: {
                  users: [
                    {
                      id: 1,
                      firstName: 'John',
                      lastName: 'Doe',
                      __typename: 'User',
                    },
                    {
                      id: 2,
                      firstName: 'Jane',
                      lastName: 'Smith',
                      __typename: 'User',
                    },
                  ],
                },
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

        const { data } = await runQuery(arrayClient, query);
        expect(data).toMatchObject({
          users: [
            { id: 1, fullName: 'John Doe' },
            { id: 2, fullName: 'Jane Smith' },
          ],
        });
      });
    });

    describe('error handling', () => {
      it.skip('handles circular dependencies gracefully', async () => {
        // This test verifies that circular dependencies don't cause infinite loops
        // and that the exchange fails gracefully rather than hanging
        const circularEntities = {
          User: createEntity('User', {
            fieldA: {
              dependencies: gql`
                fragment _ on User {
                  fieldB @computed(type: User)
                }
              `,
              resolver: (user: any) => `A-${user.fieldB}`,
            },
            fieldB: {
              dependencies: gql`
                fragment _ on User {
                  fieldA @computed(type: User)
                }
              `,
              resolver: (user: any) => `B-${user.fieldA}`,
            },
          }),
        };

        const circularClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => ({
                data: {
                  user: {
                    id: 1,
                    __typename: 'User',
                  },
                },
              }),
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities: circularEntities }), fetchExchange],
          preferGetMethod: false,
        });

        const query = gql`
          query User {
            user(id: "id") {
              id
              fieldA @computed(type: User)
            }
          }
        `;

        // The test should complete within a reasonable time and not hang
        // We expect either an error result or the query to fail gracefully
        const startTime = Date.now();
        
        try {
          const result = await runQuery(circularClient, query);
          const endTime = Date.now();
          
          // Should complete quickly (within 5 seconds)
          expect(endTime - startTime).toBeLessThan(5000);
          
          // Should have an error due to circular dependency
          expect(result.error).toBeDefined();
        } catch (error: any) {
          const endTime = Date.now();
          
          // Should complete quickly (within 5 seconds)
          expect(endTime - startTime).toBeLessThan(5000);
          
          // Should be a circular dependency related error
          expect(error.message).toMatch(/circular|dependency|iteration|irresoluble/i);
        }
      }, 6000); // 6 second timeout

      it('handles missing dependencies gracefully', async () => {
        const entitiesWithMissingDeps = {
          User: createEntity('User', {
            computedField: {
              dependencies: gql`
                fragment _ on User {
                  nonExistentField
                }
              `,
              resolver: (user: any) => user.nonExistentField || 'fallback',
            },
          }),
        };

        const missingDepsClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => ({
                data: {
                  user: {
                    id: 1,
                    firstName: 'John',
                    __typename: 'User',
                  },
                },
              }),
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities: entitiesWithMissingDeps }), fetchExchange],
          preferGetMethod: false,
        });

        const query = gql`
          query User {
            user(id: "id") {
              id
              computedField @computed(type: User)
            }
          }
        `;

        const { data } = await runQuery(missingDepsClient, query);
        expect(data).toMatchObject({
          user: {
            id: 1,
            computedField: 'fallback',
          },
        });
      });

      it('handles resolver errors gracefully', async () => {
        const entitiesWithErrorResolver = {
          User: createEntity('User', {
            errorField: {
              dependencies: gql`
                fragment _ on User {
                  firstName
                }
              `,
              resolver: () => {
                throw new Error('Resolver error');
              },
            },
          }),
        };

        const errorClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => ({
                data: {
                  user: {
                    id: 1,
                    firstName: 'John',
                    __typename: 'User',
                  },
                },
              }),
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities: entitiesWithErrorResolver }), fetchExchange],
          preferGetMethod: false,
        });

        const query = gql`
          query User {
            user(id: "id") {
              id
              errorField @computed(type: User)
            }
          }
        `;

        // This should not crash the entire query
        const result = await runQuery(errorClient, query);
        // The resolver error should result in the field being omitted or undefined
        expect(result.data).toMatchObject({
          user: {
            id: 1,
          },
        });
        // The errorField should either be undefined or not present
        expect(result.data?.user?.errorField).toBeUndefined();
      });
    });

    describe('caching behavior', () => {
      let entities: any;

      beforeAll(() => {
        entities = {
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
      });

      it('respects cache-first policy for computed properties', async () => {
        let fetchCount = 0;
        const cacheClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => {
                fetchCount++;
                return {
                  data: {
                    user: {
                      id: 1,
                      firstName: 'John',
                      lastName: 'Doe',
                      __typename: 'User',
                    },
                  },
                };
              },
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities }), fetchExchange],
          preferGetMethod: false,
        });

        const query = gql`
          query User {
            user(id: "id") {
              id
              fullName @computed(type: User)
            }
          }
        `;

        // First query
        const result1 = await runQuery(cacheClient, query);
        expect(result1.data).toMatchObject({
          user: { id: 1, fullName: 'John Doe' },
        });
        expect(fetchCount).toBe(1);

        // Second query should use cache
        const result2 = await runQuery(cacheClient, query);
        expect(result2.data).toMatchObject({
          user: { id: 1, fullName: 'John Doe' },
        });
        expect(fetchCount).toBe(1); // Should still be 1 due to caching
      });

      it('works with different request policies', async () => {
        let fetchCount = 0;
        const networkClient = createClient({
          url: '/graphql',
          fetch: createMockFetch()
            .post('/graphql', {
              status: 200,
              json: async () => {
                fetchCount++;
                return {
                  data: {
                    user: {
                      id: 1,
                      firstName: 'John',
                      lastName: 'Doe',
                      __typename: 'User',
                    },
                  },
                };
              },
            })
            .build(),
          exchanges: [cacheExchange, computedExchange({ entities }), fetchExchange],
          preferGetMethod: false,
        });

        const query = gql`
          query User {
            user(id: "id") {
              id
              fullName @computed(type: User)
            }
          }
        `;

        // Test with network-only policy
        const result = await runQuery(networkClient, query, {}, { requestPolicy: 'network-only' });
        expect(result.data).toMatchObject({
          user: { id: 1, fullName: 'John Doe' },
        });
        expect(fetchCount).toBe(1);
      });
    });
  });
});