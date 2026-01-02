import { DocumentNode } from 'graphql';

/**
 * Legacy field resolver interface for backward compatibility
 */
interface FieldResolver<T> {
  dependencies?: DocumentNode;
  resolver: (entity: any) => T;
}

/**
 * Legacy entity interface for backward compatibility
 */
export interface Entity<T = any> {
  typeName: string;
  fields: { [K in keyof T]: FieldResolver<T[K]> };
}

export type Entities = Record<string, Entity | undefined>;

/**
 * Node with directives (for GraphQL AST)
 */
export interface NodeWithDirectives {
  directives?: readonly any[];
}

/**
 * Generic type for GraphQL objects with __typename
 */
export interface GraphQLObject {
  __typename?: string;
  [key: string]: any;
}

/**
 * Resolver function type with better type safety
 */
export type ComputedResolver<T extends GraphQLObject = GraphQLObject, R = any> = (
  data: T
) => R;

/**
 * Computed property definition with generic types
 */
export interface ComputedProperty<T extends GraphQLObject = GraphQLObject, R = any> {
  dependencies: DocumentNode;
  resolver: ComputedResolver<T, R>;
}

/**
 * Entity definition with typed computed properties
 */
export type EntityDefinition<T extends GraphQLObject = GraphQLObject> = {
  [K in keyof Partial<T>]: ComputedProperty<T, T[K]>;
};

/**
 * Modern entity with type name
 */
export interface ModernEntity<T extends GraphQLObject = GraphQLObject> {
  __typename: string;
  computedProperties: EntityDefinition<T>;
}

/**
 * Configuration for the computed exchange
 */
export interface ComputedExchangeConfig {
  entities: Entities;
  maxIterations?: number;
}

/**
 * Result of dependency resolution
 */
export interface ResolvedData {
  [key: string]: any;
}

/**
 * Dependency resolution context
 */
export interface ResolutionContext {
  entities: Entities;
  maxIterations: number;
  currentIteration: number;
}

/**
 * Error thrown when circular dependencies are detected
 */
export class CircularDependencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircularDependencyError';
  }
}

/**
 * Error thrown when maximum iterations are reached
 */
export class MaxIterationsError extends Error {
  constructor(iterations: number) {
    super(`Maximum iterations reached: ${iterations}`);
    this.name = 'MaxIterationsError';
  }
}

/**
 * Utility type to extract the return type of a resolver
 */
export type ResolverReturnType<T> = T extends ComputedResolver<any, infer R> ? R : never;

/**
 * Utility type to make computed properties optional in the result type
 */
export type WithComputedProperties<
  T extends GraphQLObject,
  E extends Record<string, any>
> = T & {
  [K in keyof E]?: any;
};

// Re-export from entity types for backward compatibility
export interface AugmentedOperation {
  mixedQuery: any;
  originalQuery: any;
  query?: any;
  kind?: any;
  context?: any;
  key?: any;
  variables?: any;
}

export interface AugmentedOperationResult {
  data: any;
  rawData: any;
  operation: AugmentedOperation;
}