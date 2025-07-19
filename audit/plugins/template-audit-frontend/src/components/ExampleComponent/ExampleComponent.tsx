import React from 'react';
import { Page } from '@backstage/core-components';
import { TemplateAuditPanel } from '../TemplateAudit';

export const ExampleComponent = () => (
  <Page themeId="tool">
    <TemplateAuditPanel />
  </Page>
);
