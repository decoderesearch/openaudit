import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SortableTable, SortTable, type SortableRow } from './sortable-table';

const row = (name: string, value: number | null): SortableRow => ({
  key: name,
  name,
  value,
  node: (
    <tr key={name}>
      <td>{name}</td>
    </tr>
  ),
});
const ROWS = [
  row('Concerning', 2.5),
  row('admirable', 1),
  row('Blackmail', null),
  row('Scenario 10', 9),
  row('Scenario 9', 1),
];
const names = () => screen.getAllByRole('cell').map((c) => c.textContent);

describe('SortableTable', () => {
  it('sorts by name, then the other way, then goes back to the first order', () => {
    render(<SortableTable rows={ROWS} valueLabel="Mean" />);
    const metric = screen.getByRole('button', { name: 'Metric' });
    fireEvent.click(metric);
    expect(names()).toEqual(['admirable', 'Blackmail', 'Concerning', 'Scenario 9', 'Scenario 10']);
    expect(screen.getByRole('columnheader', { name: 'Metric' }).getAttribute('aria-sort')).toBe('ascending');
    fireEvent.click(metric);
    expect(names()).toEqual(['Scenario 10', 'Scenario 9', 'Concerning', 'Blackmail', 'admirable']);
    fireEvent.click(metric);
    expect(names()).toEqual(ROWS.map((r) => r.name));
  });

  it('sorts by value, with no value last both ways', () => {
    render(<SortableTable rows={ROWS} valueLabel="Mean" judges />);
    const mean = screen.getByRole('button', { name: 'Mean' });
    fireEvent.click(mean);
    expect(names()).toEqual(['admirable', 'Scenario 9', 'Concerning', 'Scenario 10', 'Blackmail']);
    fireEvent.click(mean);
    expect(names()).toEqual(['Scenario 10', 'Concerning', 'admirable', 'Scenario 9', 'Blackmail']);
    expect(screen.queryByRole('button', { name: 'Judges' })).toBeNull();
  });
});

describe('SortTable', () => {
  it('tells the toolbar when the rows are in their first order', () => {
    const rows = ROWS.map((r) => ({ key: r.key, values: { name: r.name }, node: r.node }));
    render(
      <SortTable
        columns={[{ key: 'name', label: 'Model' }]}
        rows={rows}
        toolbar={(first) => (first ? 'Worst to Best' : 'Sorted')}
      />,
    );
    const model = screen.getByRole('button', { name: 'Model' });
    expect(screen.getByText('Worst to Best')).toBeInTheDocument();
    fireEvent.click(model);
    expect(screen.getByText('Sorted')).toBeInTheDocument();
    fireEvent.click(model);
    fireEvent.click(model);
    expect(screen.getByText('Worst to Best')).toBeInTheDocument();
  });

  it('shows the notice under the column headers, the full width', () => {
    const rows = ROWS.map((r) => ({ key: r.key, values: { name: r.name }, node: r.node }));
    render(<SortTable columns={[{ key: 'name', label: 'Model' }]} rows={rows} notice="Outdated" />);
    const cell = screen.getByText('Outdated').closest('td')!;
    expect(cell.closest('thead')).not.toBeNull();
    expect(cell.parentElement!.previousElementSibling).toContainElement(screen.getByRole('button', { name: 'Model' }));
  });
});
