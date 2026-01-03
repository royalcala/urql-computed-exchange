import { parse } from 'graphql';
import { Client, cacheExchange, createClient, fetchExchange } from 'urql';

import { computedExchange, createEntity } from '../../src';
import { createMockFetch, runQuery } from '../utils';

describe('gql-tada Fragment Support', () => {
  let client: Client;
  let entities: any;

  beforeAll(() => {
    // Simulate the CommentFragment from gql-tada (this is what you get from your fragment)
    const CommentFragment = parse(`
      fragment CommentFragment on Comment {
        __typename
        id
        postId
        replyToCommentId
        authorId
        content
        contentJson
        createdAt
        updatedAt
        author {
          __typename
          id
          name
          email
          slug
          image
        }
        reactions {
          __typename
          id
          authorId
          postId
          commentId
          type
          createdAt
          updatedAt
          author {
            __typename
            id
            name
            email
            slug
            image
          }
        }
      }
    `);

    // Now you can use the fragment directly as a dependency!
    entities = {
      Post: createEntity('Post', {
        commentsWithReplies: {
          dependencies: CommentFragment, // ✅ Direct usage now works!
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
                    postId: '1',
                    replyToCommentId: null,
                    authorId: 'user1',
                    content: 'First comment',
                    contentJson: null,
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                    __typename: 'Comment',
                    author: {
                      id: 'user1',
                      name: 'User One',
                      email: 'user1@example.com',
                      slug: 'user-one',
                      image: null,
                      __typename: 'User',
                    },
                    reactions: [],
                  },
                  {
                    id: '2',
                    postId: '1',
                    replyToCommentId: '1',
                    authorId: 'user2',
                    content: 'Reply to first comment',
                    contentJson: null,
                    createdAt: '2024-01-01T01:00:00Z',
                    updatedAt: '2024-01-01T01:00:00Z',
                    __typename: 'Comment',
                    author: {
                      id: 'user2',
                      name: 'User Two',
                      email: 'user2@example.com',
                      slug: 'user-two',
                      image: null,
                      __typename: 'User',
                    },
                    reactions: [],
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

  it('should work with gql-tada generated fragments as dependencies', async () => {
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

    // Should not have GraphQL validation errors
    expect(error).toBeUndefined();
    expect(data).toBeDefined();
    expect(data.post).toBeDefined();
    expect(data.post.commentsWithReplies).toBeDefined();
    expect(Array.isArray(data.post.commentsWithReplies)).toBe(true);
    
    // Verify the computed field worked correctly
    expect(data.post.commentsWithReplies).toHaveLength(2);
    expect(data.post.commentsWithReplies[0].replies).toHaveLength(1);
    expect(data.post.commentsWithReplies[0].replies[0].id).toBe('2');
    expect(data.post.commentsWithReplies[1].replies).toHaveLength(0);
  });

  it('should handle complex nested fragments without errors', async () => {
    // This simulates your PostFragment with nested fragments
    const query = parse(`
      query PostWithAllData {
        post(id: "1") {
          id
          title
          commentsWithReplies @computed(type: Post)
          comments {
            id
            content
            author {
              name
            }
            reactions {
              type
            }
          }
        }
      }
    `);

    const { data, error } = await runQuery(client, query);

    expect(error).toBeUndefined();
    expect(data.post.commentsWithReplies).toBeDefined();
    expect(data.post.comments).toBeDefined();
    
    // The computed field should have the nested structure
    expect(data.post.commentsWithReplies[0]).toHaveProperty('replies');
    expect(data.post.commentsWithReplies[0]).toHaveProperty('author');
    expect(data.post.commentsWithReplies[0]).toHaveProperty('reactions');
  });
});