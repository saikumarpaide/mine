
import { HttpAuthService } from '@backstage/backend-plugin-api';
import express from 'express';
import Router from 'express-promise-router';
import yaml from 'js-yaml';
import fetch, { Response as FetchResponse } from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { ConfigReader } from '@backstage/config';
import { InputError } from '@backstage/errors';

export async function createRouter({ httpAuth }: { httpAuth: HttpAuthService }): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  // Load config from app-config.yaml
  const configPath = path.resolve(process.cwd(), 'app-config.yaml');
  const config = fs.existsSync(configPath)
    ? new ConfigReader(yaml.load(fs.readFileSync(configPath, 'utf8')) as any)
    : undefined;

  // In-memory result storage
  const results: any[] = [];

  // Helper: rotate GitHub tokens
  let githubTokens = config?.getOptionalStringArray('templateAudit.github.tokens') || [];
  let githubTokenIndex = 0;
  function getGithubToken() {
    if (!githubTokens.length) return undefined;
    const token = githubTokens[githubTokenIndex];
    githubTokenIndex = (githubTokenIndex + 1) % githubTokens.length;
    return token;
  }

  // Helper: call GitHub API with token rotation
  async function githubFetch(url: string, options: any = {}): Promise<FetchResponse> {
    let lastError: FetchResponse | undefined = undefined;
    for (let i = 0; i < githubTokens.length; i++) {
      const token = getGithubToken();
      const resp: FetchResponse = await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (resp && resp.status !== 403 && resp.status !== 429) return resp;
      lastError = resp;
    }
    // If all tokens fail, return the last error response
    if (lastError) return lastError;
    // Fallback: throw error if no tokens
    throw new Error('No GitHub tokens available');
  }

  // Helper: send to Power Automate webhook
  async function sendToWebhook(payload: any) {
    const url = config?.getOptionalString('templateAudit.webhook.powerAutomateUrl');
    if (!url) return;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      // Ignore webhook errors
    }
  }

  // POST /validate/templateName
  router.post('/validate/templateName', async (req, res) => {
    const { templateName } = req.body;
    if (!templateName) {
      throw new InputError('templateName is required');
    }
    // Fetch from Backstage Catalog API
    const catalogUrl = config?.getOptionalString('templateAudit.backstage.catalogUrl');
    const backstageToken = config?.getOptionalString('templateAudit.backstage.token');
    let catalogResp: FetchResponse;
    let catalogData: any = {};
    try {
      catalogResp = await fetch(`${catalogUrl}/entities/by-name/template/${templateName}`, {
        headers: { Authorization: `Bearer ${backstageToken}` },
      });
      catalogData = await catalogResp.json();
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch or parse catalog response', details: e && e.message ? e.message : String(e) });
    }
    if (!catalogResp || !catalogResp.ok) {
      return res.status(404).json({ error: 'Template not found in catalog' });
    }
    // Validate fields
    const spec = (catalogData && typeof catalogData === 'object' && 'spec' in catalogData) ? (catalogData as any).spec : {};
    const { description, tags, owner, annotations } = spec || {};
    let validation = {
      description: !!description,
      tags: Array.isArray(tags) && tags.length > 0,
      owner: !!owner,
    };
    // GitHub README.md check
    let readmeStatus = null;
    let githubOwnerStatus = null;
    if (annotations && typeof annotations === 'object' && annotations['backstage.io/source-location']) {
      const repoUrl = annotations['backstage.io/source-location'];
      // Parse repo URL (assume github.com/org/repo)
      const match = repoUrl.match(/github\.com[/:]([^/]+)\/([^/]+)/);
      if (match) {
        const [_, org, repo] = match;
        // Check README.md
        const readmeResp = await githubFetch(`https://api.github.com/repos/${org}/${repo}/contents/README.md`);
        readmeStatus = !!readmeResp && readmeResp.status === 200;
        // Check owner
        const ownerResp = await githubFetch(`https://api.github.com/users/${org}`);
        githubOwnerStatus = !!ownerResp && ownerResp.status === 200;
      }
    }
    const result = {
      templateName,
      validation,
      readmeStatus,
      githubOwnerStatus,
      date: new Date().toISOString(),
      status: validation.description && validation.tags && validation.owner && readmeStatus && githubOwnerStatus ? 'PASS' : 'FAIL',
      owner,
      payload: catalogData,
    };
    results.push(result);
    await sendToWebhook(result);
    return res.json(result);
  });

  // POST /validate/yaml
  router.post('/validate/yaml', async (req, res) => {
    const { yamlText } = req.body;
    if (!yamlText) {
      throw new InputError('yamlText is required');
    }
    let parsed: any = {};
    try {
      parsed = yaml.load(yamlText);
    } catch (e: any) {
      return res.status(400).json({ error: 'Invalid YAML', details: e && e.message ? e.message : String(e) });
    }
    // Type guard for parsed YAML
    const spec = (parsed && typeof parsed === 'object' && 'spec' in parsed) ? (parsed as any).spec : {};
    const meta = (parsed && typeof parsed === 'object' && 'metadata' in parsed) ? (parsed as any).metadata : {};
    const { description, tags, owner } = spec || {};
    let validation = {
      description: !!description,
      tags: Array.isArray(tags) && tags.length > 0,
      owner: !!owner,
    };
    const result = {
      templateName: meta?.name,
      validation,
      readmeStatus: null,
      githubOwnerStatus: null,
      date: new Date().toISOString(),
      status: validation.description && validation.tags && validation.owner ? 'PASS' : 'FAIL',
      owner,
      payload: parsed,
    };
    results.push(result);
    await sendToWebhook(result);
    return res.json(result);
  });

  // GET /results (for frontend table)
  router.get('/results', async (req, res) => {
    // Optionally filter by query params: templateName, status, owner, date
    let filtered = results;
    const { templateName, status, owner, date } = req.query;
    if (templateName) filtered = filtered.filter(r => r.templateName === templateName);
    if (status) filtered = filtered.filter(r => r.status === status);
    if (owner) filtered = filtered.filter(r => r.owner === owner);
    if (date) filtered = filtered.filter(r => r.date.startsWith(date));
    res.json(filtered);
  });

  return router;
}
