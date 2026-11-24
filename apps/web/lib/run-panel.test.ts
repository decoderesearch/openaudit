import { describe, expect, it } from 'vitest';
import { panelFromParams, panelFromPath, panelPath, runPanelFromParams, withPanel } from './run-panel';

describe('run panel', () => {
  it('reads an attempt or a run from the query string', () => {
    expect(panelFromParams(new URLSearchParams('v=11&run=1Cfg&attempt=53'))).toEqual({ run: '1Cfg', attempt: 53 });
    expect(panelFromParams(new URLSearchParams('run=1Cfg&runShow=failed&runPage=2'))).toEqual({
      run: '1Cfg',
      show: 'failed',
      page: 2,
    });
    expect(panelFromParams(new URLSearchParams('v=11'))).toBeNull();
    expect(panelFromParams(new URLSearchParams('run=../x'))).toBeNull();
    expect(panelFromParams(new URLSearchParams('run=1Cfg&attempt=0'))).toEqual({ run: '1Cfg' });
    expect(panelFromParams(new URLSearchParams('run=1Cfg&attempt=5&snippet=ab-12'))).toEqual({
      run: '1Cfg',
      attempt: 5,
      snippet: 'ab-12',
    });
    expect(panelFromParams(new URLSearchParams('run=1Cfg&snippet=ab-12'))).toEqual({ run: '1Cfg' });
  });

  it('sets the panel and keeps the other keys', () => {
    const q = new URLSearchParams('v=11&run=old&attempt=2');
    expect(withPanel(q, { run: '1Cfg', show: 'all', page: 1 }).toString()).toBe('v=11&run=1Cfg');
    expect(withPanel(q, { run: '1Cfg', attempt: 3 }).toString()).toBe('v=11&run=1Cfg&attempt=3');
    expect(withPanel(q, null).toString()).toBe('v=11');
  });

  it('reads a sample from the query string, before a run', () => {
    expect(panelFromParams(new URLSearchParams('v=11&sample=1CgG&run=1Cfg'))).toEqual({ sample: '1CgG' });
    expect(panelFromParams(new URLSearchParams('sample=1CgG&sampleRun=1Cfg'))).toEqual({
      sample: '1CgG',
      sampleRun: '1Cfg',
    });
    expect(panelFromParams(new URLSearchParams('sample=../x'))).toBeNull();
    expect(runPanelFromParams(new URLSearchParams('sample=1CgG'))).toBeNull();
    const q = new URLSearchParams('v=11&run=old&attempt=2');
    expect(withPanel(q, { sample: '1CgG', sampleRun: '1Cfg' }).toString()).toBe('v=11&sample=1CgG&sampleRun=1Cfg');
    expect(withPanel(new URLSearchParams('sample=1CgG'), { run: '1Cfg' }).toString()).toBe('run=1Cfg');
  });

  it('reads run, attempt and sample page paths, and builds them', () => {
    expect(panelFromPath('/runs/1Cfg/attempts/53')).toEqual({ run: '1Cfg', attempt: 53 });
    expect(panelFromPath('/samples/1CfgsittfVKuPoUK45ca82')).toEqual({ sample: '1CfgsittfVKuPoUK45ca82' });
    expect(panelFromPath('/runs/1Cfg/samples/1CgG')).toEqual({ sample: '1CgG', sampleRun: '1Cfg' });
    expect(panelPath({ sample: '1CgG' })).toBe('/samples/1CgG');
    expect(panelPath({ sample: '1CgG', sampleRun: '1Cfg' })).toBe('/runs/1Cfg/samples/1CgG');
    expect(panelFromPath('/evaluations/mask/samples')).toBeNull();
    expect(panelFromPath('/runs/1Cfg#samples')).toEqual({ run: '1Cfg' });
    expect(panelFromPath('/runs/mine')).toBeNull();
    expect(panelFromPath('/runs/1Cfg/log')).toBeNull();
    expect(panelFromPath('/openai/gpt-6-luna')).toBeNull();
    expect(panelPath({ run: '1Cfg', attempt: 53 })).toBe('/runs/1Cfg/attempts/53');
    expect(panelPath({ run: '1Cfg', attempt: 53, snippet: 'ab' })).toBe('/runs/1Cfg/attempts/53?snippet=ab');
    expect(panelPath({ run: '1Cfg', show: 'failed', page: 2 })).toBe('/runs/1Cfg?show=failed&page=2');
  });

  it('keeps the metric that picks the samples', () => {
    expect(panelFromParams(new URLSearchParams('run=1Cfg&runMetric=harm_score_copyright'))).toEqual({
      run: '1Cfg',
      metric: 'harm_score_copyright',
    });
    expect(withPanel(new URLSearchParams(), { run: '1Cfg', metric: 'harm_score' }).toString()).toBe(
      'run=1Cfg&runMetric=harm_score',
    );
    expect(panelPath({ run: '1Cfg', show: 'failed', metric: 'harm_score' })).toBe(
      '/runs/1Cfg?show=failed&metric=harm_score',
    );
  });
});
