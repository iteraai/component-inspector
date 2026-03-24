declare module 'react-devtools-inline/backend.js' {
  export const initialize: (windowOrGlobal: Window) => void;

  const reactDevtoolsInlineBackend: {
    initialize: (windowOrGlobal: Window) => void;
  };

  export default reactDevtoolsInlineBackend;
}
