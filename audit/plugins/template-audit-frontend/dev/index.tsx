import { createDevApp } from '@backstage/dev-utils';
import { templateAuditFrontendPlugin, TemplateAuditFrontendPage } from '../src/plugin';

createDevApp()
  .registerPlugin(templateAuditFrontendPlugin)
  .addPage({
    element: <TemplateAuditFrontendPage />,
    title: 'Root Page',
    path: '/template-audit-frontend',
  })
  .render();
