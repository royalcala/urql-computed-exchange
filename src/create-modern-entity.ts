import { ModernEntity, EntityDefinition, GraphQLObject } from './types';

/**
 * Create a modern entity with enhanced type safety
 */
export function createModernEntity<T extends GraphQLObject = GraphQLObject>(
  typeName: string,
  computedProperties: EntityDefinition<T>,
): ModernEntity<T> {
  return { 
    __typename: typeName, 
    computedProperties 
  };
}