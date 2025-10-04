/**
 * Hook to access plugin configuration
 */

import { useContext } from 'react';
import { PluginContext } from '@grafana/data';
import type { AppPluginSettings } from '../components/AppConfig/AppConfig';

export function usePluginContext() {
  const context = useContext(PluginContext);
  const jsonData = (context?.meta?.jsonData || {}) as AppPluginSettings;
  
  return {
    indexerUrl: jsonData.indexerUrl || 'http://localhost:8080',
    meta: context?.meta,
  };
}
