declare module 'react-devtools-inline/backend.js' {
  const reactDevtoolsInlineBackend: {
    initialize: (windowOrGlobal: Window) => void;
  };

  export default reactDevtoolsInlineBackend;
}
