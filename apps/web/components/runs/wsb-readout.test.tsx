import { WsbReadoutView } from '@/components/runs/wsb-readout';
import type { WsbReadout } from '@/lib/runs/wsb-readout';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

const positions = [
  { pos: 3, token: ' detective' },
  { pos: 4, token: ' is' },
];
const readout: WsbReadout = {
  family: 'multihop',
  options: ['Sherlock Holmes', 'Hamlet'],
  gold: 'Sherlock Holmes',
  lenses: {
    jacobian_lens: {
      kind: 'tokens',
      layers: [20, 24],
      positions,
      cells: [
        [[' London', ' city'], null],
        [[' Sherlock', ' Holmes'], [' London']],
      ],
      verdict: {
        pass: true,
        pick: 'Sherlock Holmes',
        quote: 'Sherlock',
        why: 'The judge picked Sherlock Holmes. Its quote is in the readout.',
      },
    },
    oracle_lens: {
      kind: 'text',
      layers: [20, 24],
      positions,
      cells: [
        [['- A detective story.'], null],
        [['- A city in England.'], ['- London.']],
      ],
      verdict: { pass: false, pick: 'Hamlet' },
    },
  },
};
const names = { jacobian_lens: 'J-Lens', oracle_lens: 'Oracle Lens' };

describe('WsbReadoutView', () => {
  it('shows each lens verdict, where its quote is, and opens on the quoted cell', () => {
    render(<WsbReadoutView readout={readout} facts={{}} names={names} />);
    expect(screen.getAllByText('J-Lens').length).toBeGreaterThan(0);
    expect(screen.getByText('Pass')).toBeTruthy();
    expect(screen.getByText('Fail')).toBeTruthy();
    // The verdict row and the open cell both name the quote's cell.
    expect(screen.getAllByText(/Layer 24, position 3/)).toHaveLength(2);
    expect(screen.getByTitle('Sherlock | Holmes').className).toContain('ring-sky-500');
    expect(screen.queryByText(/Click a cell/)).toBeNull();
    expect(screen.getByText("Judge's Reasoning or Evidence")).toBeTruthy();
    expect(screen.getByText('Target Answer')).toBeTruthy();
    expect(screen.getByText('Selected Cell')).toBeTruthy();
    expect(screen.getByText('Target Readout')).toBeTruthy();
    expect(screen.getByText('Decoy / Other Readouts')).toBeTruthy();
    expect(screen.getByText('The judge picked Sherlock Holmes. Its quote is in the readout.')).toBeTruthy();
  });

  it('picks a lens by its row, and shows all tokens of a clicked cell', () => {
    render(<WsbReadoutView readout={readout} facts={{}} names={names} />);
    fireEvent.click(screen.getByTitle('London | city'));
    expect(screen.getByText(/Layer 20, position 3/)).toBeTruthy();
    // A second click keeps the cell open.
    fireEvent.click(screen.getByTitle('London | city'));
    expect(screen.getByText(/Layer 20, position 3/)).toBeTruthy();
    const row = screen.getByRole('radio', { name: /Oracle Lens/ });
    expect(row.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: /J-Lens/ }).getAttribute('aria-checked')).toBe('false');
    fireEvent.click(screen.getByTitle('- London.'));
    expect(screen.getByText('- London.', { selector: 'p' })).toBeTruthy();
  });

  it('shows only the layers and positions with a cell that has the search, and fades the others', () => {
    render(<WsbReadoutView readout={readout} facts={{}} names={names} />);
    const search = screen.getByRole('searchbox', { name: 'Search Cells' });
    fireEvent.change(search, { target: { value: 'LONDON' } });
    expect(screen.getByTitle('London | city').closest('td')!.className).not.toContain('opacity-30');
    expect(screen.getByTitle('Sherlock | Holmes').closest('td')!.className).toContain('opacity-30');
    expect(screen.getByText('Search Match')).toBeTruthy();
    // The matched cells and the open cell's matched tokens get a sky outline.
    expect(screen.getByTitle('London | city').className).toContain('outline-sky-400');
    expect(screen.getByTitle('Sherlock | Holmes').className).not.toContain('outline-sky-400');
    fireEvent.click(screen.getByTitle('London | city'));
    expect(screen.getByTitle('" London"').className).toContain('outline-sky-400');
    expect(screen.getByTitle('" city"').className).not.toContain('outline-sky-400');
    fireEvent.change(search, { target: { value: 'city' } });
    expect(screen.queryByTitle('Sherlock | Holmes')).toBeNull();
    expect(screen.queryByTitle('London')).toBeNull();
    fireEvent.change(search, { target: { value: 'nothing' } });
    expect(screen.getByText('No cells match the search.')).toBeTruthy();
  });

  it('opens on the last cell when no cell holds the quote or names the gold', () => {
    const none: WsbReadout = {
      ...readout,
      lenses: { oracle_lens: readout.lenses.oracle_lens! },
    };
    render(<WsbReadoutView readout={none} facts={{}} names={names} />);
    expect(screen.getByText(/Layer 24, position 4/)).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('colors a cell that names an alias of the gold, and rings the quoted token', () => {
    const three: WsbReadout = {
      family: 'multihop',
      options: ['3', '4'],
      gold: '3',
      aliases: ['three', '三'],
      lenses: {
        jacobian_lens: {
          kind: 'tokens',
          layers: [56],
          positions,
          cells: [[[' is', ' equals', '是三'], [' four']]],
          verdict: { pass: true, pick: '3', quote: '是三' },
        },
      },
    };
    render(<WsbReadoutView readout={three} facts={{}} names={names} />);
    expect(screen.getByTitle('is | equals | 是三').className).toContain('bg-emerald-100');
    expect(screen.getAllByTitle('"是三"').some((e) => e.className.includes('ring-sky-500'))).toBe(true);
  });

  it('shows the forms of a regex family and the hit of each part', () => {
    const regex: WsbReadout = {
      family: 'multilingual_mt',
      regex: true,
      units: { concept: ['hourglass'], language: ['Arabic'] },
      lenses: {
        jacobian_lens: {
          ...readout.lenses.jacobian_lens!,
          verdict: { pass: false, units: { concept: true, language: false } },
        },
      },
    };
    render(<WsbReadoutView readout={regex} facts={{ notScored: 'Not scored.' }} names={names} />);
    expect(screen.getByText('Forms of concept')).toBeTruthy();
    expect(screen.getByText('concept ✓')).toBeTruthy();
    expect(screen.getByText('language ✗')).toBeTruthy();
    expect(screen.getByText('Not scored.')).toBeTruthy();
  });

  it("shows the summarizer's notes of the picked lens, and a note when their text is not kept", () => {
    const digested: WsbReadout = {
      ...readout,
      lenses: {
        jacobian_lens: {
          ...readout.lenses.jacobian_lens!,
          verdict: {
            pass: true,
            pick: 'Sherlock Holmes',
            statements: [
              { text: 'Sherlock is the top token', support: '2 samples, 2 layers', evidence: 'Sherlock | Holmes' },
            ],
          },
        },
        oracle_lens: { ...readout.lenses.oracle_lens!, verdict: { pass: false, redacted: 'nyt' } },
      },
    };
    render(<WsbReadoutView readout={digested} facts={{}} names={names} />);
    expect(screen.getByText("Summarizer's Notes")).toBeTruthy();
    // The first note is on one line; "Show All" opens all of them and does not pick the row.
    expect(screen.getByText('Sherlock is the top token').className).toContain('truncate');
    expect(screen.queryByText('(2 samples, 2 layers)')).toBeNull();
    expect(screen.getByText('Not kept')).toBeTruthy();
    const oracle = screen.getByRole('radio', { name: /Oracle Lens/ });
    fireEvent.click(oracle);
    expect(oracle.getAttribute('aria-checked')).toBe('true');
    expect(screen.getByText(/does not keep the text of the summarizer's notes/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
    expect(screen.getByText('(2 samples, 2 layers)')).toBeTruthy();
    expect(oracle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Show Less' }));
    expect(screen.queryByText('(2 samples, 2 layers)')).toBeNull();
    // A click on the open list closes it too, and does not pick the row.
    const j = screen.getByRole('radio', { name: /J-Lens/ });
    fireEvent.click(screen.getByRole('button', { name: 'Show All' }));
    fireEvent.click(screen.getByText('(2 samples, 2 layers)'));
    expect(screen.queryByText('(2 samples, 2 layers)')).toBeNull();
    expect(oracle.getAttribute('aria-checked')).toBe('true');
    expect(j.getAttribute('aria-checked')).toBe('false');
  });

  it('leaves out the evidence column when the judge gives only its pick', () => {
    const picks: WsbReadout = {
      ...readout,
      lenses: {
        oracle_lens: {
          ...readout.lenses.oracle_lens!,
          verdict: { pass: false, pick: 'Hamlet', statements: [{ text: 'Hamlet is in the readout' }] },
        },
      },
    };
    render(<WsbReadoutView readout={picks} facts={{}} names={names} />);
    expect(screen.queryByText("Judge's Reasoning or Evidence")).toBeNull();
    expect(screen.getByText("Judge's Pick")).toBeTruthy();
  });

  it('shows only the result of each lens for a redacted question', () => {
    const empty = { kind: 'tokens' as const, layers: [], positions: [], cells: [] };
    const hidden: WsbReadout = {
      family: 'knowledge_cutoff',
      redacted: 'nocot',
      lenses: {
        jacobian_lens: { ...empty, verdict: { pass: true, redacted: 'nocot' } },
        oracle_lens: { ...empty, verdict: { pass: false, redacted: 'nocot' } },
      },
    };
    render(<WsbReadoutView readout={hidden} facts={{}} names={names} />);
    expect(screen.getByText('Pass')).toBeTruthy();
    expect(screen.getByText('Fail')).toBeTruthy();
    expect(screen.getByText(/nocot-bench question/)).toBeTruthy();
    expect(screen.queryByText("Judge's Pick")).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('shows a word spelled across adjacent positions, rings its cells and opens on the first', () => {
    const typo: WsbReadout = {
      family: 'typo_mt',
      regex: true,
      units: { correction: ['narcissism'] },
      lenses: {
        jacobian_lens: {
          kind: 'tokens',
          layers: [36, 40],
          positions: [
            { pos: 21, token: 'isc' },
            { pos: 22, token: 'ism' },
          ],
          cells: [
            [[' ic'], [' ego']],
            [
              [' narciss', 'us'],
              [' ego', 'ism'],
            ],
          ],
          verdict: { pass: true, units: { correction: true } },
        },
      },
    };
    render(<WsbReadoutView readout={typo} facts={{}} names={names} />);
    expect(screen.getByText('narciss + ism')).toBeTruthy();
    expect(screen.getByText('Spells narcissism at layer 40, positions 21–22')).toBeTruthy();
    expect(screen.getByText('Joined Tokens')).toBeTruthy();
    expect(screen.getByTitle('narciss | us').className).toContain('ring-violet-500');
    expect(screen.getByTitle('ego | ism').className).toContain('ring-violet-500');
    expect(screen.getByTitle('ic').className).not.toContain('ring-violet-500');
    expect(screen.getByText(/Layer 40, position 21/)).toBeTruthy();
    expect(screen.getByTitle('" narciss"').className).toContain('ring-violet-500');
    expect(screen.getByTitle('"us"').className).not.toContain('ring-violet-500');
  });
});
