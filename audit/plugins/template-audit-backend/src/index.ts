import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { createRouter } from './router';

export default createBackendModule({
  pluginId: 'template-audit-backend',
  moduleId: 'main',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        httpRouter.use(await createRouter({ logger, config }));
      },
    });
  },
});
