import { ASTNode, DefinitionNode, DocumentNode, FieldNode, FragmentDefinitionNode, Kind, visit } from 'graphql';

import { Entities, NodeWithDirectives } from './types';

// Native flatten function to replace lodash/flatten
function flatten<T>(arr: (T | T[])[]): T[] {
  return arr.reduce<T[]>((acc, val) => acc.concat(Array.isArray(val) ? flatten(val) : val), []);
}

function _isNodeWithDirectives(node?: any): node is NodeWithDirectives {
  return node != null && node.directives != null;
}

export function getDirectiveType(directiveNode: any): string {
  const typeName = directiveNode?.arguments?.[0]?.value?.value;

  if (typeName == null) {
    throw new Error('Invalid @computed directive found. No type specified');
  }

  return typeName;
}

export function nodeHasComputedDirectives(node?: ASTNode): boolean {
  if (!_isNodeWithDirectives(node)) {
    return false;
  }

  return node.directives != null && node.directives.some((d) => d.name.value === 'computed');
}

// Return type is "any" because that's the return type of the visit() function from graphql
export function replaceDirectivesByFragments(
  query: DefinitionNode | DocumentNode | undefined,
  entities: Entities,
  visitedNodes: Set<string> = new Set(),
): any {
  if (query == null) {
    return null;
  }

  const replaceDirectiveByFragment = (node: FieldNode) => {
    const computedDirective = node.directives?.find((d) => d.name.value === 'computed');
    const directiveType = getDirectiveType(computedDirective);
    const entityType = entities[directiveType];

    if (entityType == null) {
      throw new Error(`No entity found for type "${directiveType}"`);
    }

    const fieldName = node.name.value;
    const entityField = entityType.fields[fieldName];

    if (entityField == null) {
      throw new Error(
        `No resolver found for @computed directive "${fieldName}" in type "${directiveType}"`,
      );
    }

    // Create a unique key for this dependency to detect cycles
    const dependencyKey = `${directiveType}:${fieldName}`;
    
    // Check for circular dependencies
    if (visitedNodes.has(dependencyKey)) {
      // Return an empty inline fragment to break the cycle
      return {
        kind: 'InlineFragment',
        typeCondition: {
          kind: 'NamedType',
          name: { kind: 'Name', value: directiveType },
        },
        selectionSet: {
          kind: 'SelectionSet',
          selections: [],
        },
      };
    }

    // Add this node to visited set
    const newVisitedNodes = new Set(visitedNodes);
    newVisitedNodes.add(dependencyKey);

    const firstDefinition = entityField.dependencies?.definitions[0];
    
    // If the first definition is a FragmentDefinition, convert it to a FragmentSpread
    if (firstDefinition?.kind === Kind.FRAGMENT_DEFINITION) {
      return {
        kind: Kind.FRAGMENT_SPREAD,
        name: {
          kind: Kind.NAME,
          value: firstDefinition.name.value,
        },
      };
    }

    // Replace directive node by fragment
    return replaceDirectivesByFragments(firstDefinition, entities, newVisitedNodes);
  };

  return visit(query, {
    Field(node) {
      if (!nodeHasComputedDirectives(node)) {
        return undefined; // Don't do anything with this node
      }

      return replaceDirectiveByFragment(node);
    },
    Directive(node) {
      if (node.name.value === 'computed') {
        return null; // Remove @computed directives from the query
      }
    },
  });
}

// Return type is "any" because that's the return type of the visit() function from graphql
export function addFragmentsFromDirectives(
  query: DefinitionNode | DocumentNode | undefined,
  entities: Entities,
  visitedNodes: Set<string> = new Set(),
  collectedFragments: Map<string, FragmentDefinitionNode> = new Map(),
): any {
  if (query == null) {
    return null;
  }

  const addFragmentToNode = (node: FieldNode) => {
    const computedDirective = node.directives?.find((d) => d.name.value === 'computed');
    const directiveType = getDirectiveType(computedDirective);
    const entityType = entities[directiveType];

    if (entityType == null) {
      throw new Error(`No entity found for type "${directiveType}"`);
    }

    const fieldName = node.name.value;
    const entityField = entityType.fields[fieldName];

    if (entityField == null) {
      throw new Error(
        `No resolver found for @computed directive "${fieldName}" in type "${directiveType}"`,
      );
    }

    // Create a unique key for this dependency to detect cycles
    const dependencyKey = `${directiveType}:${fieldName}`;
    
    // Check for circular dependencies
    if (visitedNodes.has(dependencyKey)) {
      // Return an empty inline fragment to break the cycle
      return {
        kind: 'InlineFragment',
        typeCondition: {
          kind: 'NamedType',
          name: { kind: 'Name', value: directiveType },
        },
        selectionSet: {
          kind: 'SelectionSet',
          selections: [],
        },
      };
    }

    // Add this node to visited set
    const newVisitedNodes = new Set(visitedNodes);
    newVisitedNodes.add(dependencyKey);

    const firstDefinition = entityField.dependencies?.definitions[0];
    
    // If the first definition is a FragmentDefinition, collect it and return a FragmentSpread
    if (firstDefinition?.kind === Kind.FRAGMENT_DEFINITION) {
      const fragmentDef = firstDefinition as FragmentDefinitionNode;
      collectedFragments.set(fragmentDef.name.value, fragmentDef);
      
      return {
        kind: Kind.FRAGMENT_SPREAD,
        name: {
          kind: Kind.NAME,
          value: fragmentDef.name.value,
        },
      };
    }

    return addFragmentsFromDirectives(firstDefinition, entities, newVisitedNodes, collectedFragments);
  };

  const firstPass = visit(query, {
    Field(node) {
      if (!nodeHasComputedDirectives(node)) {
        return undefined; // Don't do anything with this node
      }
      return [node, addFragmentToNode(node)];
    },
  });

  // Flatten nodes that instead of being a single node, are an array
  // of Field and InlineFragment from the firstPass
  const result = visit(firstPass, {
    SelectionSet(node) {
      const selections = [...node.selections]; // Create mutable copy
      node.selections = flatten(selections as any);
      return node;
    },
  });

  // If we have collected fragments and this is a DocumentNode, add them to the definitions
  if (result && result.kind === Kind.DOCUMENT && collectedFragments.size > 0) {
    const existingFragmentNames = new Set(
      result.definitions
        .filter((def: any) => def.kind === Kind.FRAGMENT_DEFINITION)
        .map((def: any) => def.name.value)
    );

    const newFragments = Array.from(collectedFragments.values()).filter(
      (fragment) => !existingFragmentNames.has(fragment.name.value)
    );

    if (newFragments.length > 0) {
      return {
        ...result,
        definitions: [...result.definitions, ...newFragments],
      };
    }
  }

  return result;
}
