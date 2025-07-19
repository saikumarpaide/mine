import { templateAuditFrontendPlugin } from './plugin';

describe('template-audit-frontend', () => {
  it('should export plugin', () => {
    expect(templateAuditFrontendPlugin).toBeDefined();
  });
});
