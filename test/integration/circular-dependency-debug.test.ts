import { parse, print } from 'graphql';
import { Client, cacheExchange, createClient, fetchExchange } from 'urql';

import { computedExchange, createEntity } from '../../src';
import { createMockFetch, runQuery } from '../utils';

describe('Circular Dependency Debug', () => {
  let client: Client;
  let entities: any;

  beforeAll(() => {
    // Create a separate fragment for the dependency (avoiding circular reference)
    const PostCommentsFragment = parse(`
      fragment PostCommentsFragment on Post {
        __typename
        id
        comments {
          __typename
          id
          postId
          replyToCommentId
          authorId
          content
          contentJson
          createdAt
          updatedAt
        }
      }
    `);

    console.log('PostCommentsFragment:', print(PostCommentsFragment));

    entities = {
      Post: createEntity('Post', {
        commentsWithReplies: {
          dependencies: PostCommentsFragment, // Use the separate fragment
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
                authorId: 'user1',
                content: 'Sample post',
                contentJson: null,
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
                sportId: 'sport1',
                cityId: 'city1',
                imageUrl: null,
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

  it('should handle separate dependency fragment without circular reference', async () => {
    const query = parse(`
      query PostWithComputedComments {
        post(id: "1") {
          ...PostFragment
        }
      }
      
      fragment PostFragment on Post {
        __typename
        id
        authorId
        content
        contentJson
        createdAt
        updatedAt
        sportId
        cityId
        imageUrl
        comments {
          __typename
          id
          postId
          replyToCommentId
          authorId
          content
          contentJson
          createdAt
          updatedAt
        }
        commentsWithReplies @computed(type: Post)
      }
      
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
      }
    `);

    console.log('Original query:', print(query));

    const { data, error } = await runQuery(client, query);

    console.log('Error:', error);
    console.log('Data:', JSON.stringify(data, null, 2));

    expect(error).toBeUndefined();
    expect(data).toBeDefined();
    expect(data.post).toBeDefined();
    expect(data.post.commentsWithReplies).toBeDefined();
    expect(Array.isArray(data.post.commentsWithReplies)).toBe(true);
    expect(data.post.commentsWithReplies).toHaveLength(2);
    expect(data.post.commentsWithReplies[0].replies).toHaveLength(1);
  });

  it('should debug the query transformation', () => {
    const { addFragmentsFromDirectives, replaceDirectivesByFragments } = require('../../src/directive-utils');
    
    const query = parse(`
      query PostWithComputedComments {
        post(id: "1") {
          id
          commentsWithReplies @computed(type: Post)
        }
      }
    `);

    console.log('=== DEBUGGING QUERY TRANSFORMATION ===');
    console.log('1. Original query:', print(query));

    const mixedQuery = addFragmentsFromDirectives(query, entities);
    console.log('2. Mixed query (addFragmentsFromDirectives):', print(mixedQuery));

    const finalQuery = replaceDirectivesByFragments(query, entities);
    console.log('3. Final query (replaceDirectivesByFragments):', print(finalQuery));

    // Check if the fragment is included
    const finalQueryString = print(finalQuery);
    expect(finalQueryString).toContain('PostCommentsFragment');
    expect(finalQueryString).toContain('fragment PostCommentsFragment on Post');
  });
});