import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppRootProps } from '@grafana/data';

const ExplorerPage = React.lazy(() => import('../../pages/Explorer'));

function App(props: AppRootProps) {
  const ROUTES = [
    { path: "/graph", element: <ExplorerPage /> }
  ]

  return (
    <Routes>
      {ROUTES.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
    </Routes>
  );
}

export default App;
