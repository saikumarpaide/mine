import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const templateAuditFrontendPlugin = createPlugin({
  id: 'template-audit-frontend',
  routes: {
    root: rootRouteRef,
  },
});

export const TemplateAuditFrontendPage = templateAuditFrontendPlugin.provide(
  createRoutableExtension({
    name: 'TemplateAuditFrontendPage',
    component: () =>
      import('./components/ExampleComponent').then(m => m.ExampleComponent),
    mountPoint: rootRouteRef,
  }),
);
