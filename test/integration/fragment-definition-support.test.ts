import { parse, print } from 'graphql';
import { Client, cacheExchange, createClient, fetchExchange } from 'urql';

import { computedExchange, createEntity } from '../../src';
import { createMockFetch, runQuery } from '../utils';

describe('Fragment Definition Support', () => {
  let client: Client;
  let entities: any;

  beforeAll(() => {
    // Create a fragment definition as a dependency (this was causing the issue)
    const CommentFragmentDependency = parse(`
      fragment CommentFragment on Post {
        __typename
        id
        comments {
          __typename
          id
          content
          author
          replyToCommentId
        }
      }
    `);

    entities = {
      Post: createEntity('Post', {
        commentsWithReplies: {
          dependencies: CommentFragmentDependency,
          resolver: (post: any) => {
            const comments = (post?.comments || []) as Array<{
              id: string;
              replyToCommentId?: string | null;
              [key: string]: any;
            }>;

            const commentsWithReplies = comments.map((comment) => ({
              ...comment,
              replies: comments.filter(
                (c) => c.replyToCommentId === comment.id && c.id !== comment.id
              ),
            }));

            return commentsWithReplies;
          },
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
              post: {
                id: '1',
                title: 'Sample Post',
                __typename: 'Post',
                comments: [
                  {
                    id: '1',
                    replyToCommentId: null,
                    content: 'First comment',
                    author: 'User1',
                    __typename: 'Comment',
                  },
                  {
                    id: '2',
                    replyToCommentId: '1',
                    content: 'Reply to first comment',
                    author: 'User2',
                    __typename: 'Comment',
                  },
                  {
                    id: '3',
                    replyToCommentId: null,
                    content: 'Second comment',
                    author: 'User3',
                    __typename: 'Comment',
                  },
                ],
              },
            },
          }),
        })
        .build(),
      exchanges: [cacheExchange, computedExchange({ entities }), fetchExchange],
      preferGetMethod: false,
    });
  });

  it('should handle fragment definitions as dependencies without GraphQL validation errors', async () => {
    const query = parse(`
      query PostWithComputedComments {
        post(id: "1") {
          id
          title
          commentsWithReplies @computed(type: Post)
        }
      }
    `);

    const { data, error } = await runQuery(client, query);

    // Should not have GraphQL validation errors like "Cannot query field 'fragment'"
    expect(error).toBeUndefined();
    expect(data).toBeDefined();
    expect(data.post).toBeDefined();
    expect(data.post.commentsWithReplies).toBeDefined();
    expect(Array.isArray(data.post.commentsWithReplies)).toBe(true);

    // Verify the computed field worked correctly
    expect(data.post.commentsWithReplies).toHaveLength(3);
    expect(data.post.commentsWithReplies[0].replies).toHaveLength(1);
    expect(data.post.commentsWithReplies[0].replies[0].id).toBe('2');
  });

  it('should properly convert fragment definitions to fragment spreads in the query', () => {
    // This test verifies the transformation at the AST level
    const { addFragmentsFromDirectives } = require('../../src/directive-utils');

    const query = parse(`
      query PostWithComputedComments {
        post(id: "1") {
          id
          title
          commentsWithReplies @computed(type: Post)
        }
      }
    `);

    const result = addFragmentsFromDirectives(query, entities);
    const resultString = print(result);

    // Should contain the fragment spread, not the fragment definition inline
    expect(resultString).toContain('...CommentFragment');
    // Should contain the fragment definition at the document level
    expect(resultString).toContain('fragment CommentFragment on Post');
    // Should NOT contain invalid syntax like "fragment ... on Post" in selection sets
    expect(resultString).not.toMatch(/{\s*fragment\s+CommentFragment\s+on\s+Post/);
  });
});