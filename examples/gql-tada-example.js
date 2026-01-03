// Before the fix - you had to use this complex workaround:
const PostCommentsDependency = {
  kind: Kind.DOCUMENT,
  definitions: [{
    kind: Kind.INLINE_FRAGMENT,
    typeCondition: {
      kind: Kind.NAMED_TYPE,
      name: { kind: Kind.NAME, value: "Post" },
    },
    selectionSet: {
      kind: Kind.SELECTION_SET,
      selections: [{
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: "comments" },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [{
            kind: Kind.FRAGMENT_SPREAD,
            name: { kind: Kind.NAME, value: "CommentFragment" },
          }],
        },
      }],
    },
  }],
};

// After the fix - you can now use the fragment directly:
import { CommentFragment } from "@/graphql/fragments/post";
import { createEntity, mergeEntities } from "urql-computed-exchange-plus";

const Post = createEntity("Post", {
  commentsWithReplies: {
    dependencies: CommentFragment, // ✅ This now works directly!
    resolver: (post) => {
      const comments = (post?.comments || []) as Array<{
        id: string;
        replyToCommentId?: string | null;
        [key: string]: any;
      }>;

      const commentsWithReplies = comments.map((comment) => ({
        ...comment,
        replies: comments.filter((c) => c.replyToCommentId === comment.id && c.id !== comment.id),
      }));

      console.log("Computed commentsWithReplies for Post", post.id, {
        commentsWithReplies,
      });
      return commentsWithReplies;
    },
  },
});

export const entities = mergeEntities(Post);