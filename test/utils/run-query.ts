import { DocumentNode } from 'graphql';
import { Client, OperationResult, createRequest } from 'urql';
import { pipe, subscribe } from 'wonka';

export function runQuery(client: Client, query: string | DocumentNode, variables: any = {}) {
  const request = createRequest(query, variables);
  return new Promise<OperationResult>((resolve) => {
    pipe(
      client.executeQuery(request),
      subscribe((res) => {
        resolve(res);
      }),
    );
  });
}
