import gql from 'fraql';
import { createEntity } from '../create-entity';
import { CircularDependencyError, MaxIterationsError } from '../types';

describe('Enhanced TypeScript Types', () => {
  it('should create entities with proper structure', () => {
    const userEntity = createEntity('User', {
      fullName: {
        dependencies: gql`fragment _ on User { firstName lastName }`,
        resolver: (user: any) => `${user.firstName} ${user.lastName}`,
      },
    });

    expect(userEntity.typeName).toBe('User');
    expect(userEntity.fields.fullName).toBeDefined();
    expect(typeof userEntity.fields.fullName.resolver).toBe('function');
  });

  it('should provide proper error types', () => {
    const circularError = new CircularDependencyError('Test circular dependency');
    expect(circularError).toBeInstanceOf(Error);
    expect(circularError.name).toBe('CircularDependencyError');
    expect(circularError.message).toBe('Test circular dependency');

    const maxIterError = new MaxIterationsError(100);
    expect(maxIterError).toBeInstanceOf(Error);
    expect(maxIterError.name).toBe('MaxIterationsError');
    expect(maxIterError.message).toBe('Maximum iterations reached: 100');
  });

  it('should handle complex resolver logic', () => {
    const postEntity = createEntity('Post', {
      summary: {
        dependencies: gql`fragment _ on Post { title content }`,
        resolver: (post: any) => {
          const maxLength = 100;
          const summary = post.content.length > maxLength 
            ? `${post.content.substring(0, maxLength)}...`
            : post.content;
          return `${post.title}: ${summary}`;
        },
      },
    });

    expect(postEntity.typeName).toBe('Post');
    expect(typeof postEntity.fields.summary.resolver).toBe('function');
    
    // Test the resolver
    const mockPost = {
      title: 'Test Post',
      content: 'This is a test post content that is longer than 100 characters to test the summary functionality and ensure it truncates properly.',
    };
    
    const result = postEntity.fields.summary.resolver(mockPost);
    expect(result).toBe('Test Post: This is a test post content that is longer than 100 characters to test the summary functionality and...');
  });
});