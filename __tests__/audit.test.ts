import { csvCell } from '@/lib/audit';

describe('csvCell', () => {
  it('leaves plain values unquoted', () => {
    expect(csvCell('people')).toBe('people');
    expect(csvCell(42)).toBe('42');
  });

  it('renders null/undefined as an empty cell', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes and escapes values containing commas, quotes, or newlines', () => {
    expect(csvCell('Smith, John')).toBe('"Smith, John"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('stringifies JSON detail objects and escapes their embedded quotes', () => {
    const detail = JSON.stringify({ first_name: 'Ann', notes: 'Uses "Annie"' });
    expect(csvCell(detail)).toBe('"{""first_name"":""Ann"",""notes"":""Uses \\""Annie\\""""}"');
  });
});
