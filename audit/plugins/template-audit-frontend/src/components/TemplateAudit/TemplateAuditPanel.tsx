import { useState } from 'react';
import {
  Content,
  ContentHeader,
  InfoCard,
  Progress,
  Table,
  TableColumn,
  ResponseErrorPanel,
} from '@backstage/core-components';
import { useApi, alertApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { Button, Grid, TextField, TextareaAutosize, Tooltip, Snackbar } from '@material-ui/core';

// Table columns for results
const columns: TableColumn[] = [
  { title: 'Template Name', field: 'templateName' },
  { title: 'Status', field: 'status' },
  { title: 'Owner', field: 'owner' },
  { title: 'Date', field: 'date' },
];

export const TemplateAuditPanel = () => {
  const alertApi = useApi(alertApiRef);
  const fetchApi = useApi(fetchApiRef);
  const [templateYaml, setTemplateYaml] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ templateName: '', status: '', owner: '', date: '' });
  //

  // Mutually exclusive input logic
  const handleYamlChange = (e: any) => {
    setTemplateYaml(e.target.value);
    if (e.target.value) setTemplateName('');
  };
  const handleNameChange = (e: any) => {
    setTemplateName(e.target.value);
    if (e.target.value) setTemplateYaml('');
  };
  const handleClear = () => {
    setTemplateYaml('');
    setTemplateName('');
    setError(null);
    setFilter({ templateName: '', status: '', owner: '', date: '' });
  };

  // Validate action
  const handleValidate = async () => {
    setLoading(true);
    setError(null);
    try {
      let resp, data;
      if (templateName) {
        resp = await fetchApi.fetch('/api/template-audit/validate/templateName', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateName }),
        });
      } else if (templateYaml) {
        resp = await fetchApi.fetch('/api/template-audit/validate/yaml', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yamlText: templateYaml }),
        });
      } else {
        setError('Please provide either a template name or YAML.');
        setLoading(false);
        return;
      }
      data = await resp.json();
      if (!resp.ok) {
        alertApi.post({
          message: data.error || 'Validation failed',
          severity: 'error',
        });
        setError(data.error || 'Validation failed');
      } else {
        alertApi.post({
          message: 'Validation successful',
          severity: 'success',
        });
        setResults(prev => [data, ...prev]);
      }
    } catch (e: any) {
      setError(e.message);
      alertApi.post({ message: e.message, severity: 'error' });
    }
    setLoading(false);
  };

  // Fetch results for table
  const fetchResults = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(filter).forEach(([k, v]) => { if (v) params.append(k, v); });
      const resp = await fetchApi.fetch(`/api/template-audit/results?${params.toString()}`);
      const data = await resp.json();
      setResults(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  // Table row tooltip
  const renderTooltip = (row: any) => (
    <Tooltip title={<pre style={{ maxWidth: 400, whiteSpace: 'pre-wrap' }}>{JSON.stringify(row.payload, null, 2)}</pre>}>
      <span>{row.status}</span>
    </Tooltip>
  );

  return (
    <Content>
      <ContentHeader title="Template Audit">
        <Button onClick={fetchResults} color="primary">Refresh Results</Button>
      </ContentHeader>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <InfoCard title="Dual Input Panel">
            <TextareaAutosize
              minRows={6}
              placeholder="Paste template.yaml here"
              value={templateYaml}
              onChange={handleYamlChange}
              disabled={!!templateName}
              style={{ width: '100%', marginBottom: 8 }}
            />
            <TextField
              label="Template Name"
              value={templateName}
              onChange={handleNameChange}
              disabled={!!templateYaml}
              fullWidth
            />
            <Grid container spacing={1} style={{ marginTop: 8 }}>
              <Grid item>
                <Button variant="contained" color="primary" onClick={handleValidate} disabled={loading}>
                  Validate
                </Button>
              </Grid>
              <Grid item>
                <Button variant="outlined" onClick={handleClear} disabled={loading}>
                  Clear
                </Button>
              </Grid>
            </Grid>
          </InfoCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <InfoCard title="Results Table">
            <Grid container spacing={1}>
              <Grid item xs={6}>
                <TextField label="Filter by Template Name" value={filter.templateName} onChange={e => setFilter(f => ({ ...f, templateName: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Filter by Owner" value={filter.owner} onChange={e => setFilter(f => ({ ...f, owner: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Filter by Status" value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))} fullWidth />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Filter by Date" value={filter.date} onChange={e => setFilter(f => ({ ...f, date: e.target.value }))} fullWidth />
              </Grid>
            </Grid>
            {loading ? <Progress /> : error ? <ResponseErrorPanel error={new Error(error)} /> : (
              <Table
                columns={columns}
                data={results.map(row => ({ ...row, status: renderTooltip(row) }))}
                options={{ paging: true, pageSize: 5, sorting: true }}
                // onRowClick removed: tooltip shown inline in status column
              />
            )}
          </InfoCard>
        </Grid>
      </Grid>
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        message={error}
      />
    </Content>
  );
};
