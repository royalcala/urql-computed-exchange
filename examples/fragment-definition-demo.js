const { parse, print } = require('graphql');
const { createEntity, mergeEntities } = require('../lib');
const { addFragmentsFromDirectives } = require('../lib/directive-utils');

// This demonstrates the fix for fragment definition support
console.log('=== Fragment Definition Support Demo ===\n');

// Create a fragment definition as dependency (this was causing the issue)
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

console.log('1. Original Fragment Definition:');
console.log(print(CommentFragmentDependency));
console.log('\n');

// Create entity with fragment definition as dependency
const Post = createEntity('Post', {
  commentsWithReplies: {
    dependencies: CommentFragmentDependency,
    resolver: (post) => {
      const comments = (post?.comments || []);
      return comments.map((comment) => ({
        ...comment,
        replies: comments.filter((c) => c.replyToCommentId === comment.id && c.id !== comment.id),
      }));
    },
  },
});

const entities = mergeEntities(Post);

// Test query with computed directive
const query = parse(`
  query PostWithComputedComments {
    post(id: "1") {
      id
      title
      commentsWithReplies @computed(type: Post)
    }
  }
`);

console.log('2. Original Query:');
console.log(print(query));
console.log('\n');

// Transform the query using addFragmentsFromDirectives
const transformedQuery = addFragmentsFromDirectives(query, entities);

console.log('3. Transformed Query (with fragment spread and definition):');
console.log(print(transformedQuery));
console.log('\n');

// Verify the transformation
const transformedString = print(transformedQuery);
const hasFragmentSpread = transformedString.includes('...CommentFragment');
const hasFragmentDefinition = transformedString.includes('fragment CommentFragment on Post');
const hasInvalidSyntax = /{\s*fragment\s+CommentFragment\s+on\s+Post/.test(transformedString);

console.log('4. Validation Results:');
console.log(`✓ Contains fragment spread: ${hasFragmentSpread}`);
console.log(`✓ Contains fragment definition: ${hasFragmentDefinition}`);
console.log(`✓ No invalid syntax: ${!hasInvalidSyntax}`);

if (hasFragmentSpread && hasFragmentDefinition && !hasInvalidSyntax) {
  console.log('\n🎉 SUCCESS: Fragment definitions are now properly supported!');
  console.log('   - Fragment definitions are converted to fragment spreads in selection sets');
  console.log('   - Fragment definitions are added to the document level');
  console.log('   - No more "Cannot query field \'fragment\'" errors');
} else {
  console.log('\n❌ FAILED: Fragment definition support is not working correctly');
}