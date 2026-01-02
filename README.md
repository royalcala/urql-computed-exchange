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
