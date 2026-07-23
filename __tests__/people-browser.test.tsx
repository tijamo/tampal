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
  render(
    <PeopleBrowser people={list} families={families} renderItem={(p) => <span>{p.first_name}</span>} />,
  );
}

describe('PeopleBrowser', () => {
  it('splits into Members and Visitors, sorted by surname by default', () => {
    renderBrowser();
    const membersSection = screen.getByRole('heading', { name: /Members/ }).closest('section')!;
    const names = within(membersSection).getAllByRole('listitem').map((li) => li.textContent);
    // Ashby, Cresswell (Ann), Cresswell (Peter), Nora (no surname sorts first/last per localeCompare of '')
    expect(names).toEqual(['Nora', 'Bob', 'Ann', 'Peter']);

    const visitorsSection = screen.getByRole('heading', { name: /Visitors/ }).closest('section')!;
    expect(within(visitorsSection).getByText('Zoe')).toBeInTheDocument();
  });

  it('filters by search query across all groups', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'cresswell' } });
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('Peter')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    expect(screen.queryByText('Zoe')).not.toBeInTheDocument();
  });

  it('filters by surname initial via the A-Z bar, disabling letters with no matches', () => {
    renderBrowser();
    const cButton = screen.getByRole('button', { name: 'C' });
    expect(cButton).toBeEnabled();
    const qButton = screen.getByRole('button', { name: 'Q' });
    expect(qButton).toBeDisabled();

    fireEvent.click(cButton);
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('Peter')).toBeInTheDocument();
    expect(screen.queryByText('Bob')).not.toBeInTheDocument();
    expect(screen.queryByText('Nora')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('sorts by first name when selected', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'first_name' } });
    const membersSection = screen.getByRole('heading', { name: /Members/ }).closest('section')!;
    const names = within(membersSection).getAllByRole('listitem').map((li) => li.textContent);
    expect(names).toEqual(['Ann', 'Bob', 'Nora', 'Peter']);
  });

  it('groups by family when the view is switched, with an unassigned bucket last', () => {
    renderBrowser();
    fireEvent.change(screen.getByLabelText('View'), { target: { value: 'family' } });

    const familySection = screen.getByRole('heading', { name: /The Cresswell Family/ }).closest('section')!;
    const familyNames = within(familySection).getAllByRole('listitem').map((li) => li.textContent);
    expect(familyNames).toEqual(['Ann', 'Peter']);

    const noFamilySection = screen.getByRole('heading', { name: /No family/ }).closest('section')!;
    const noFamilyNames = within(noFamilySection).getAllByRole('listitem').map((li) => li.textContent);
    expect(noFamilyNames.sort()).toEqual(['Bob', 'Nora', 'Zoe']);
  });
});
