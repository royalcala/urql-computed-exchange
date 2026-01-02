import { DocumentNode, visit } from 'graphql';
import graphql, { Resolver } from 'graphql-anywhere';

import { getDirectiveType, nodeHasComputedDirectives } from './directive-utils';
import { difference, isEqual } from './set-utils';
import { AugmentedOperation, Entities, CircularDependencyError, MaxIterationsError } from './types';

function _listDocumentComputedDirectives(doc?: DocumentNode) {
  if (doc == null) {
    return [];
  }

  const computedDirectives = new Set();

  visit(doc, {
    Field(node) {
      if (nodeHasComputedDirectives(node)) {
        const computedDirective = node.directives?.find((d) => d.name.value === 'computed');
        const directiveType = getDirectiveType(computedDirective);
        computedDirectives.add(`${directiveType}:${node.name.value}`);
      }
    },
  });

  return [...computedDirectives];
}

function _documentHasComputedDirectives(doc?: DocumentNode) {
  return _listDocumentComputedDirectives(doc).length > 0;
}

function _buildDependencyGraph(entities: Entities): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  
  for (const [typeName, entity] of Object.entries(entities)) {
    if (!entity) continue;
    for (const [fieldName, field] of Object.entries(entity.fields)) {
      const resolverId = `${typeName}:${fieldName}`;
      const dependencies = _listDocumentComputedDirectives(field.dependencies);
      graph.set(resolverId, new Set(dependencies as string[]));
    }
  }
  
  return graph;
}

function _detectCircularDependencies(graph: Map<string, Set<string>>): string[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[] = [];

  function dfs(node: string, path: string[]): void {
    if (recursionStack.has(node)) {
      const cycleStart = path.indexOf(node);
      const cycle = path.slice(cycleStart).concat(node);
      cycles.push(cycle.join(' -> '));
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visited.add(node);
    recursionStack.add(node);
    path.push(node);

    const dependencies = graph.get(node) || new Set();
    for (const dep of dependencies) {
      dfs(dep, [...path]);
    }

    recursionStack.delete(node);
    path.pop();
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }

  return cycles;
}

export function resolveData(data: any, operation: AugmentedOperation, entities: Entities) {
  const { mixedQuery, originalQuery } = operation;

  // Check for circular dependencies upfront
  const dependencyGraph = _buildDependencyGraph(entities);
  const cycles = _detectCircularDependencies(dependencyGraph);
  
  if (cycles.length > 0) {
    throw new CircularDependencyError(
      `Circular dependencies detected in computed properties:\n${cycles.map(cycle => `  - ${cycle}`).join('\n')}\n\nPlease review your entity definitions to remove circular references.`
    );
  }

  let pendingResolvers = new Set();
  let resolvedResolvers = new Set();

  /*
   * Combine our custom resolvers with the default
   * resolver: (field, root) => root[field]
   */
  const resolver: Resolver = (fieldName, _root, _, __, info) => {
    const root = _root == null ? {} : _root;
    const { resultKey } = info; // this is the new field name if we use an alias => resultKey: fieldName
    const { __typename: typeName } = root;

    const aliasValue = root[resultKey];
    const nonAliasValue = root[fieldName];
    const isAliasedField = aliasValue !== nonAliasValue;

    if (aliasValue !== undefined || nonAliasValue !== undefined) {
      return aliasValue || nonAliasValue; // we already computed the value of this field
    }

    const shouldUseEntity = entities[typeName]?.fields[fieldName] != null;
    if (!shouldUseEntity) {
      return isAliasedField ? aliasValue : nonAliasValue;
    }

    const { resolver, dependencies } = entities[typeName]!.fields[fieldName];
    const resolverId = `${typeName}:${fieldName}`;

    if (!_documentHasComputedDirectives(dependencies)) {
      // no dependencies, resolve and add it to resolved resolvers
      resolvedResolvers.add(resolverId);
      try {
        return resolver(root);
      } catch (error) {
        console.warn(`Resolver for ${resolverId} failed:`, error);
        return undefined;
      }
    }

    const dependentResolvers = _listDocumentComputedDirectives(dependencies);

    if (dependentResolvers.some((d) => !resolvedResolvers.has(d))) {
      // not every dependency has been resolved, add it to pending resolvers and return undefined
      pendingResolvers.add(resolverId);
      return undefined;
    } else {
      // every dependency has been resolved, resolve and add it to resolved resolvers
      resolvedResolvers.add(resolverId);
      try {
        return resolver(root);
      } catch (error) {
        console.warn(`Resolver for ${resolverId} failed:`, error);
        return undefined;
      }
    }
  };

  let resolvedData = graphql(resolver, mixedQuery, data);
  let prevPendingResolvers = new Set();
  let prevResolvedResolvers = new Set();
  let iterationCount = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (pendingResolvers.size > 0 && iterationCount < maxIterations) {
    iterationCount++;
    prevResolvedResolvers = resolvedResolvers;
    resolvedData = graphql(resolver, mixedQuery, resolvedData);
    prevPendingResolvers = pendingResolvers;
    pendingResolvers = difference(pendingResolvers, resolvedResolvers);

    if (
      isEqual(prevResolvedResolvers, resolvedResolvers) &&
      isEqual(prevPendingResolvers, pendingResolvers)
    ) {
      // Build detailed error message
      const pendingList = Array.from(pendingResolvers).join(', ');
      const resolvedList = Array.from(resolvedResolvers).join(', ');
      
      throw new CircularDependencyError(
        `Irresoluble dependency chain detected.\n` +
        `Pending resolvers: ${pendingList}\n` +
        `Resolved resolvers: ${resolvedList}\n` +
        `This usually indicates a circular dependency or missing computed property definition.`
      );
    }
  }

  if (iterationCount >= maxIterations) {
    throw new MaxIterationsError(maxIterations);
  }

  return graphql(resolver, originalQuery, resolvedData);
}
