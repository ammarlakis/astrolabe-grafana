import { AppConfigPage, AppPage, test as base } from '@grafana/plugin-e2e';
import { PLUGIN_ID } from '../src/constants';

type AppTestFixture = {
  appConfigPage: AppConfigPage;
  gotoPage: (path?: string) => Promise<AppPage>;
};

export const test = base.extend<AppTestFixture>({
  appConfigPage: async ({ gotoAppConfigPage }, use) => {
    const configPage = await gotoAppConfigPage({
      pluginId: PLUGIN_ID,
    });
    await use(configPage);
  },
  gotoPage: async ({ gotoAppPage }, use) => {
    await use((path) =>
      gotoAppPage({
        path,
        pluginId: PLUGIN_ID,
      })
    );
  },
});

export { expect } from '@grafana/plugin-e2e';
