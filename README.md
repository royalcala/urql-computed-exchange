# URQL Computed Exchange Plus

An [URQL](https://github.com/FormidableLabs/urql) exchange to compute data using resolvers and entities.

**This is a maintained fork of the original `urql-computed-exchange` with updated dependencies and modern tooling.**

## Installation

```bash
$ npm i urql-computed-exchange-plus
```

## Usage

First, create your entities and their resolvers:

```javascript
// entities.js
import { createEntity, mergeEntities } from 'urql-computed-exchange-plus';

const Pokemon = createEntity('Pokemon', {
  numberOfEvolutions: {
    dependencies: gql`
      fragment _ on Pokemon {
        evolutions {
          id
        }
      }
    `,
    resolver: (pokemon) => {
      return (pokemon.evolutions && pokemon.evolutions.length) ?? 0;
    },
  },
});

export default mergeEntities(Pokemon);
```

Then, add it to the list of exchanges in URQL when setting up the client:

```javascript
// client.js

import { computedExchange } from 'urql-computed-exchange-plus';
import {
  createClient,
  cacheExchange,
  fetchExchange,
} from 'urql';

import entities from './entities';


const client = createClient({
  url: 'https://graphql-pokemon.now.sh/',
  exchanges: [
    cacheExchange,
    computedExchange({ entities }),
    fetchExchange,
  ],
});

export default client;
```

Finally, use the `@computed` directive when declaring your GraphQL queries. Don't forget to indicate the corresponding `type`:

```javascript
// App.js

import React from 'react';
import { useQuery } from 'urql';
import gql from 'graphql-tag';

const PokemonQuery = gql`
  query PokemonQuery {
    pokemon(name: "charmander") {
      id
      name
      numberOfEvolutions @computed(type: Pokemon)
    }
  }
`;

const App = () => {
  const [ res ] = useQuery({
    query: PokemonQuery,
  });

  if (res.fetching) {
    return 'Loading...';
  }

  return (
    <pre>
      {JSON.stringify(res.data, null, 2)}
    </pre>
  );
};

export default App;
```
## Error Handling

The exchange handles various error scenarios gracefully:

### Circular Dependencies
```typescript
// This will throw an error instead of hanging
const entities = {
  User: createEntity('User', {
    fieldA: {
      dependencies: gql`fragment _ on User { fieldB @computed(type: User) }`,
      resolver: (user) => `A-${user.fieldB}`,
    },
    fieldB: {
      dependencies: gql`fragment _ on User { fieldA @computed(type: User) }`,
      resolver: (user) => `B-${user.fieldA}`,
    },
  }),
};
```

### Resolver Errors
```typescript
const entities = {
  User: createEntity('User', {
    riskyField: {
      dependencies: gql`fragment _ on User { someField }`,
      resolver: (user) => {
        if (!user.someField) {
          throw new Error('Missing required field');
        }
        return user.someField.toUpperCase();
      },
    },
  }),
};
// If resolver throws, the field will be undefined instead of crashing the query
```

### Missing Dependencies
```typescript
const entities = {
  User: createEntity('User', {
    safeField: {
      dependencies: gql`fragment _ on User { nonExistentField }`,
      resolver: (user) => user.nonExistentField || 'fallback value',
    },
  }),
};
```

## Integration with urql Exchanges

The computed exchange works seamlessly with urql's built-in exchanges:

### Basic Setup
```typescript
import { createClient, cacheExchange, fetchExchange } from 'urql';
import { computedExchange } from 'urql-computed-exchange-plus';

const client = createClient({
  url: 'https://api.example.com/graphql',
  exchanges: [
    cacheExchange,           // Works with caching
    computedExchange({ entities }),
    fetchExchange,
  ],
});
```

### With Authentication Exchange
```typescript
import { authExchange } from '@urql/exchange-auth';

const client = createClient({
  url: 'https://api.example.com/graphql',
  exchanges: [
    cacheExchange,
    authExchange({
      // auth config
    }),
    computedExchange({ entities }),
    fetchExchange,
  ],
});
```

### With Retry Exchange
```typescript
import { retryExchange } from '@urql/exchange-retry';

const client = createClient({
  url: 'https://api.example.com/graphql',
  exchanges: [
    cacheExchange,
    retryExchange({
      initialDelayMs: 1000,
      maxDelayMs: 15000,
      randomDelay: true,
      maxNumberAttempts: 2,
    }),
    computedExchange({ entities }),
    fetchExchange,
  ],
});
```

## Dependency Resolution Behavior

The computed exchange resolves dependencies in the following order:

1. **Parse Query**: Identifies all `@computed` directives and their types
2. **Collect Dependencies**: Gathers all required fields from entity definitions
3. **Resolve Chain**: Processes computed properties in dependency order
4. **Circular Detection**: Prevents infinite loops with maximum iteration limits
5. **Error Handling**: Gracefully handles resolver failures

### Dependency Chain Example
```typescript
const entities = {
  User: createEntity('User', {
    // Level 1: Direct field access
    fullName: {
      dependencies: gql`fragment _ on User { firstName lastName }`,
      resolver: (user) => `${user.firstName} ${user.lastName}`,
    },
    // Level 2: Depends on Level 1
    displayName: {
      dependencies: gql`fragment _ on User { fullName @computed(type: User) title }`,
      resolver: (user) => `${user.title} ${user.fullName}`,
    },
    // Level 3: Depends on Level 2
    greeting: {
      dependencies: gql`fragment _ on User { displayName @computed(type: User) }`,
      resolver: (user) => `Hello, ${user.displayName}!`,
    },
  }),
};
```

## Troubleshooting

### Common Issues

#### Issue: "Maximum iterations reached" Error
**Cause**: Circular dependencies in computed properties
**Solution**: Check your entity definitions for circular references
```typescript
// ❌ Bad: Circular dependency
const entities = {
  User: createEntity('User', {
    fieldA: {
      dependencies: gql`fragment _ on User { fieldB @computed(type: User) }`,
      resolver: (user) => user.fieldB,
    },
    fieldB: {
      dependencies: gql`fragment _ on User { fieldA @computed(type: User) }`,
      resolver: (user) => user.fieldA,
    },
  }),
};

// ✅ Good: Linear dependency chain
const entities = {
  User: createEntity('User', {
    fullName: {
      dependencies: gql`fragment _ on User { firstName lastName }`,
      resolver: (user) => `${user.firstName} ${user.lastName}`,
    },
    displayName: {
      dependencies: gql`fragment _ on User { fullName @computed(type: User) title }`,
      resolver: (user) => `${user.title} ${user.fullName}`,
    },
  }),
};
```

#### Issue: Computed Fields Return `undefined`
**Cause**: Missing dependencies or resolver errors
**Solution**: Check that all required fields are available and resolvers handle edge cases
```typescript
// ✅ Good: Handle missing data gracefully
const entities = {
  User: createEntity('User', {
    safeField: {
      dependencies: gql`fragment _ on User { optionalField }`,
      resolver: (user) => {
        if (!user.optionalField) {
          return 'Default Value';
        }
        return user.optionalField.toUpperCase();
      },
    },
  }),
};
```

#### Issue: Performance Issues with Large Datasets
**Cause**: Complex computed property chains on many items
**Solution**: Optimize resolvers and consider caching
```typescript
// ✅ Good: Efficient resolver
const entities = {
  User: createEntity('User', {
    expensiveComputation: {
      dependencies: gql`fragment _ on User { data }`,
      resolver: (user) => {
        // Cache expensive operations
        if (user._cachedResult) return user._cachedResult;
        const result = performExpensiveOperation(user.data);
        user._cachedResult = result;
        return result;
      },
    },
  }),
};
```

#### Issue: TypeScript Type Errors
**Cause**: Incorrect type annotations or missing type definitions
**Solution**: Ensure proper typing for entities and resolvers
```typescript
interface User {
  id: string;
  firstName: string;
  lastName: string;
}

const entities = {
  User: createEntity('User', {
    fullName: {
      dependencies: gql`fragment _ on User { firstName lastName }`,
      resolver: (user: User) => `${user.firstName} ${user.lastName}`,
    },
  }),
};
```

## Testing

The library includes comprehensive test coverage:
- Unit tests for core functionality
- Integration tests with urql's cache exchange  
- Error handling and edge case testing
- Performance and circular dependency protection

Run tests:
```bash
npm test                           # Unit tests
npm run test:integration          # Integration tests
npm run test:performance          # Performance tests
npm run test:all                  # All tests
```

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and breaking changes.

## Contributing

This is a maintained fork. Contributions are welcome! Please ensure tests pass and add tests for new features.

## License

MIT