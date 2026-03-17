import ReactDOM from 'react-dom/client';
import {
  EmbeddedHarnessApp,
  type EmbeddedHarnessAppProps,
} from './embeddedHarnessApp';

export const renderEmbeddedHarnessApp = (
  container: Element,
  props: EmbeddedHarnessAppProps = {},
) => {
  const root = ReactDOM.createRoot(container);

  root.render(<EmbeddedHarnessApp {...props} />);

  return {
    unmount: () => {
      root.unmount();
    },
  };
};
