import { render, screen, fireEvent, within } from '@testing-library/react';
import { PeopleBrowser, type BrowsablePerson } from '@/components/people-browser';

interface TestPerson extends BrowsablePerson {
  id: string;
}

function person(overrides: Partial<TestPerson> & Pick<TestPerson, 'id' | 'first_name'>): TestPerson {
  return {
    surname: null,
    person_type: 'member',
    family_id: null,
    ...overrides,
  };
}

const people: TestPerson[] = [
  person({ id: '1', first_name: 'Ann', surname: 'Cresswell', family_id: 'fam-1' }),
  person({ id: '2', first_name: 'Peter', surname: 'Cresswell', family_id: 'fam-1' }),
  person({ id: '3', first_name: 'Bob', surname: 'Ashby' }),
  person({ id: '4', first_name: 'Zoe', surname: 'Young', person_type: 'visitor' }),
  person({ id: '5', first_name: 'Nora', surname: null }),
];

const families = [{ id: 'fam-1', name: 'The Cresswell Family' }];

function renderBrowser(list = people) {
  render(<PeopleBrowser people={list} families={families} variant="directory" />);
}

describe('PeopleBrowser', () => {
  it('splits into Members and Visitors, sorted by surname by default (admin variant)', () => {
    render(<PeopleBrowser people={people} families={families} variant="admin" />);
    const membersSection = screen.getByRole('heading', { name: /Members/ }).closest('section')!;
    const names = within(membersSection)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.font-medium')?.textContent);
    // No surname sorts first (empty string), then Ashby, then Cresswell x2 (stable: Ann before Peter).
    expect(names).toEqual(['Nora', 'Bob Ashby', 'Ann Cresswell', 'Peter Cresswell']);

    const visitorsSection = screen.getByRole('heading', { name: /Visitors/ }).closest('section')!;
    expect(
      within(visitorsSection).getByText('Zoe Young', { selector: '.font-medium' }),
    ).toBeInTheDocument();
  });

  it('never shows visitors in the directory variant, even if passed in, and hides the Visitors section entirely', () => {
    renderBrowser();
    expect(screen.queryByRole('heading', { name: /Visitors/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Zoe Young')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('View'), { target: { value: 'family' } });
    expect(screen.queryByText('Zoe Young')).not.toBeInTheDocument();
  });

  it('filters by search query across all groups', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'cresswell' } });
    expect(screen.getByText('Ann Cresswell')).toBeInTheDocument();
    expect(screen.getByText('Peter Cresswell')).toBeInTheDocument();
    expect(screen.queryByText('Bob Ashby')).not.toBeInTheDocument();
    expect(screen.queryByText('Zoe Young')).not.toBeInTheDocument();
  });

  it('filters by surname initial via the A-Z bar, disabling letters with no matches', () => {
    renderBrowser();
    const cButton = screen.getByRole('button', { name: 'C' });
    expect(cButton).toBeEnabled();
    const qButton = screen.getByRole('button', { name: 'Q' });
    expect(qButton).toBeDisabled();

    fireEvent.click(cButton);
    expect(screen.getByText('Ann Cresswell')).toBeInTheDocument();
    expect(screen.getByText('Peter Cresswell')).toBeInTheDocument();
    expect(screen.queryByText('Bob Ashby')).not.toBeInTheDocument();
    expect(screen.queryByText('Nora')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Bob Ashby')).toBeInTheDocument();
  });

  it('sorts by first name when selected', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'first_name' } });
    const membersSection = screen.getByRole('heading', { name: /Members/ }).closest('section')!;
    const names = within(membersSection).getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toEqual(['Ann Cresswell', 'Bob Ashby', 'Nora', 'Peter Cresswell']);
  });

  it('groups by family when the view is switched, with an unassigned bucket last', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('View'), { target: { value: 'family' } });

    const familySection = screen.getByRole('heading', { name: /The Cresswell Family/ }).closest('section')!;
    const familyNames = within(familySection).getAllByRole('listitem').map((li) => li.textContent);
    expect(familyNames).toEqual(['Ann Cresswell', 'Peter Cresswell']);

    const noFamilySection = screen.getByRole('heading', { name: /No family/ }).closest('section')!;
    const noFamilyNames = within(noFamilySection).getAllByRole('listitem').map((li) => li.textContent);
    // Zoe (a visitor) is excluded even here, since the directory variant filters visitors out entirely.
    expect(noFamilyNames.sort()).toEqual(['Bob Ashby', 'Nora']);
  });
});
