import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './router';
import { catalogServiceRef } from '@backstage/plugin-catalog-node';

/**
 * templateAuditPlugin backend plugin
 *
 * @public
 */
export const templateAuditPlugin = createBackendPlugin({
  pluginId: 'template-audit',
  register(env) {
    env.registerInit({
      deps: {
        logger: coreServices.logger,
        httpAuth: coreServices.httpAuth,
        httpRouter: coreServices.httpRouter,
        catalog: catalogServiceRef,
      },
      async init({ logger, httpAuth, httpRouter, catalog }) {
        httpRouter.use(
          await createRouter({
            httpAuth,
          }),
        );
      },
    });
  },
});
