import gql from 'fraql';
import { Client, cacheExchange, createClient, fetchExchange } from 'urql';

import { computedExchange, createEntity } from '../../src';
import { createMockFetch, runQuery } from '../utils';

describe('Post Comments with Computed Replies', () => {
    let client: Client;
    let entities: any;

    beforeAll(() => {
        entities = {
            Post: createEntity('Post', {
                commentsWithReplies: {
                    dependencies: gql`
                        fragment _ on Post {
                            __typename
                            id
                            title
                            comments {
                                __typename
                                id
                                content
                                author
                                commentId
                            }
                        }
                    `,
                    resolver: (post: any) => {
                        const comments = post.comments.map((comment: any) => ({
                            ...comment,
                            replies: post.comments.filter((c: any) => c.commentId === comment.id && c.id !== comment.id)
                        }));
                        return {
                            ...post,
                            comments
                        };
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
                                content: 'This is a sample post content',
                                __typename: 'Post',
                                comments: [
                                    {
                                        id: '1',
                                        commentId: null,
                                        content: 'First comment',
                                        author: 'User1',
                                        __typename: 'Comment',
                                    },
                                    {
                                        id: '2',
                                        commentId: '1',
                                        content: 'Reply to first comment',
                                        author: 'User2',
                                        __typename: 'Comment',
                                    },
                                    {
                                        id: '3',
                                        commentId: null,
                                        content: 'Second comment',
                                        author: 'User3',
                                        __typename: 'Comment',
                                    },
                                    {
                                        id: '4',
                                        commentId: '2',
                                        content: 'Reply to reply',
                                        author: 'User4',
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

    it('fetches post with comments and computed replies', async () => {
        const query = gql`
      query PostWithComments {
        post(id: "1") {
          id
          title
          content
          commentsWithReplies @computed(type: Post)
          comments {
            id
            commentId
            content
            author
            replies {
              id
              commentId
              content
              author
            }
          }
        }
      }
    `;

        const { data } = await runQuery(client, query);

        expect(data).toMatchObject({
            post: {
                id: '1',
                title: 'Sample Post',
                content: 'This is a sample post content',
                commentsWithReplies: {
                    comments: [
                        {
                            id: '1',
                            commentId: null,
                            content: 'First comment',
                            author: 'User1',
                            replies: [
                                {
                                    id: '2',
                                    commentId: '1',
                                    content: 'Reply to first comment',
                                    author: 'User2',
                                }
                            ],
                        },
                        {
                            id: '2',
                            commentId: '1',
                            content: 'Reply to first comment',
                            author: 'User2',
                            replies: [
                                {
                                    id: '4',
                                    commentId: '2',
                                    content: 'Reply to reply',
                                    author: 'User4',
                                }
                            ],
                        },
                        {
                            id: '3',
                            commentId: null,
                            content: 'Second comment',
                            author: 'User3',
                            replies: [],
                        },
                        {
                            id: '4',
                            commentId: '2',
                            content: 'Reply to reply',
                            author: 'User4',
                            replies: [],
                        },
                    ]
                },
                comments: [
                    {
                        id: '1',
                        commentId: null,
                        content: 'First comment',
                        author: 'User1',
                    },
                    {
                        id: '2',
                        commentId: '1',
                        content: 'Reply to first comment',
                        author: 'User2',
                    },
                    {
                        id: '3',
                        commentId: null,
                        content: 'Second comment',
                        author: 'User3',
                    },
                    {
                        id: '4',
                        commentId: '2',
                        content: 'Reply to reply',
                        author: 'User4',
                    },
                ],
            },
        });
    });
});