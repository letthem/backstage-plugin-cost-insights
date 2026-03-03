import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export const costInsightsPlugin = createBackendPlugin({
  pluginId: 'cost-insights',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        httpRouter: coreServices.httpRouter,
      },
      async init({ logger, config, httpRouter }) {
        const router = await createRouter({ logger, config });
        httpRouter.use(router);

        const costInsightsConfig = config.getOptionalConfig('costInsights');
        const allowUnauthenticated =
          costInsightsConfig?.getOptionalBoolean('auth.allowUnauthenticated') ??
          false;

        httpRouter.addAuthPolicy({
          path: '/',
          allow: allowUnauthenticated ? 'unauthenticated' : 'user-cookie',
        });
      },
    });
  },
});
