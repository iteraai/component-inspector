export default {
  rules: {
    'enforce-await-or-return-given': {
      meta: {
        type: 'problem',
        docs: {
          description:
            'Enforce that given() calls in test files are either awaited or returned',
          recommended: false,
        },
        schema: [],
        messages: {
          mustAwaitOrReturn:
            'given() calls must be either awaited or returned. Use "await given(...)" or "return given(...)"',
        },
      },
      create(context) {
        const isGivenCall = (node) => {
          if (node.type !== 'CallExpression') {
            return false;
          }

          return node.callee.type === 'Identifier' && node.callee.name === 'given';
        };

        const isAwaitedOrReturned = (node) => {
          let current = node;

          while (current !== undefined) {
            const parent = current.parent;

            if (parent === undefined) {
              break;
            }

            if (parent.type === 'AwaitExpression' || parent.type === 'ReturnStatement') {
              return true;
            }

            if (parent.type === 'ExpressionStatement') {
              return false;
            }

            if (
              parent.type === 'MemberExpression' ||
              parent.type === 'CallExpression' ||
              parent.type === 'ChainExpression'
            ) {
              current = parent;
              continue;
            }

            break;
          }

          return false;
        };

        return {
          CallExpression(node) {
            try {
              if (!isGivenCall(node) || isAwaitedOrReturned(node)) {
                return;
              }

              context.report({
                node,
                messageId: 'mustAwaitOrReturn',
              });
            } catch (_error) {
              // Fail safe: linting should not crash when traversing malformed trees.
            }
          },
        };
      },
    },
  },
};
