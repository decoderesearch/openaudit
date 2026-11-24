import { describe, expect, it, vi } from 'vitest';
import { ESTIMATE, durationText, parallelFor, runSeconds, secondsLeft, waveSeconds } from './estimates';

vi.mock('@/lib/db', () => ({ prisma: {} }));

const { startupSeconds: START } = ESTIMATE;

describe('waveSeconds', () => {
  it('is null with no usable history', () => {
    expect(waveSeconds([])).toBeNull();
    expect(waveSeconds([{ seconds: 0, samples: 10, parallel: 16 }])).toBeNull();
    expect(waveSeconds([{ seconds: 100, samples: 0, parallel: 16 }])).toBeNull();
  });

  it('takes the time after startup over the waves', () => {
    // 160 samples on 16 calls: 10 waves.
    expect(waveSeconds([{ seconds: START + 50, samples: 160, parallel: 16 }])).toBe(5);
    // Fewer samples than calls: one wave.
    expect(waveSeconds([{ seconds: START + 30, samples: 5, parallel: 16 }])).toBe(30);
  });

  it('takes the median, so one slow run does not move it much', () => {
    const run = (wave: number) => ({ seconds: START + wave * 2, samples: 32, parallel: 16 });
    expect(waveSeconds([run(4), run(100), run(6)])).toBe(6);
    expect(waveSeconds([run(4), run(6)])).toBe(5);
  });
});

describe('parallelFor', () => {
  it('uses 16 calls per shard and 4 shards by default', () => {
    expect(parallelFor({})).toBe(64);
    expect(parallelFor({ maxConnections: 8 })).toBe(32);
    expect(parallelFor({ maxConnections: 8 }, 0)).toBe(8);
  });
});

describe('runSeconds', () => {
  it('is startup plus whole waves', () => {
    expect(runSeconds(64, 5, 64)).toBe(START + 5);
    expect(runSeconds(65, 5, 64)).toBe(START + 10);
    expect(runSeconds(1, 5, 64)).toBe(START + 5);
  });
});

describe('secondsLeft', () => {
  it('uses the rate so far after a few samples', () => {
    expect(secondsLeft({ elapsed: 100, done: 10, planned: 50, estimate: 9999 })).toBe(400);
    expect(secondsLeft({ elapsed: 100, done: 50, planned: 50, estimate: null })).toBe(0);
  });

  it('uses the estimate before that, less the time used', () => {
    expect(secondsLeft({ elapsed: 30, done: 2, planned: 50, estimate: 300 })).toBe(270);
    expect(secondsLeft({ elapsed: 0, done: 0, planned: null, estimate: 300 })).toBe(300);
    expect(secondsLeft({ elapsed: 500, done: 0, planned: 50, estimate: 300 })).toBe(0);
  });

  it('uses the rate when a small run has done all its samples', () => {
    expect(secondsLeft({ elapsed: 30, done: 3, planned: 3, estimate: 300 })).toBe(0);
  });

  it('is null with neither a rate nor an estimate', () => {
    expect(secondsLeft({ elapsed: 30, done: 1, planned: 50, estimate: null })).toBeNull();
  });
});

describe('durationText', () => {
  it('rounds to minutes and hours', () => {
    expect(durationText(10)).toBe('Less than a minute');
    expect(durationText(60)).toBe('About 1 minute');
    expect(durationText(6 * 60 + 10)).toBe('About 6 minutes');
    expect(durationText(3600)).toBe('About 1 hour');
    expect(durationText(80 * 60)).toBe('About 1 hour 20 minutes');
    expect(durationText(3 * 3600 + 60)).toBe('About 3 hours 1 minute');
  });
});
