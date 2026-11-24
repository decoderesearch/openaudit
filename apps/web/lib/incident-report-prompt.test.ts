import { describe, expect, it } from 'vitest';
import { INCIDENT_AGENT_PROMPT } from './incident-report-prompt';
import { CATEGORY_LABELS, PRIMARY_CATEGORY_LABELS, SEVERITY_ORDER, STATUS_LABELS } from './org-research';
import { REPORT_LIMITS } from './report';

describe('INCIDENT_AGENT_PROMPT', () => {
  it('names every value that the incident format allows', () => {
    const values = [
      ...SEVERITY_ORDER,
      ...Object.keys(STATUS_LABELS),
      ...Object.keys(PRIMARY_CATEGORY_LABELS),
      ...Object.keys(CATEGORY_LABELS),
    ];
    for (const v of values) expect(INCIDENT_AGENT_PROMPT).toContain(v);
  });

  it('names the optional fields', () => {
    expect(INCIDENT_AGENT_PROMPT).toContain('Optional: endDate, models, timeline, logs');
  });

  it('fits in a report with room for the details', () => {
    expect(INCIDENT_AGENT_PROMPT.length).toBeLessThan(REPORT_LIMITS.body / 4);
    expect(INCIDENT_AGENT_PROMPT).toContain(REPORT_LIMITS.body.toLocaleString('en-US'));
  });
});
