import React, { Suspense, lazy } from 'react';
import { AppPlugin, type AppRootProps } from '@grafana/data';
import { LoadingPlaceholder } from '@grafana/ui';
import type { AppConfigProps } from './components/AppConfig/AppConfig';
import { GraphPage } from './pages/GraphPage';

const LazyApp = lazy(() => import('./components/App/App'));
const LazyAppConfig = lazy(() => import('./components/AppConfig/AppConfig'));

// Root app component - redirect to graph page
const App = (props: AppRootProps) => {
  const { path } = props;
  
  // Route to graph page by default
  if (path === '/a/ammarlakis-astrolabe-app' || path === '/a/ammarlakis-astrolabe-app/') {
    return <GraphPage />;
  }
  
  // Handle /graph route
  if (path.includes('/graph')) {
    return <GraphPage />;
  }
  
  // Fallback to default app
  return (
    <Suspense fallback={<LoadingPlaceholder text="" />}>
      <LazyApp {...props} />
    </Suspense>
  );
};

const AppConfig = (props: AppConfigProps) => (
  <Suspense fallback={<LoadingPlaceholder text="" />}>
    <LazyAppConfig {...props} />
  </Suspense>
);

export const plugin = new AppPlugin<{}>().setRootPage(App).addConfigPage({
  title: 'Configuration',
  icon: 'cog',
  body: AppConfig,
  id: 'configuration',
});
