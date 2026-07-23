import { parseChMeetingsRows, type RawImportRow } from '@/lib/import/chmeetings';

function row(overrides: Partial<RawImportRow>): RawImportRow {
  return {
    'Person Id': 1,
    'First Name': 'Jane',
    'Last Name': 'Doe',
    'Middle Name': '',
    Nickname: '',
    Birthdate: '',
    Age: '',
    'Mobile Phone': '',
    'Home Phone': '',
    Email: '',
    Church: '',
    'Talents And Hobbies': '',
    'Address Line': '',
    'Address Line 2': '',
    City: '',
    'Constituent Country': '',
    'Postal Code': '',
    Notes: '',
    'Join Date': '',
    'Group Name': '',
    'Family Id': '',
    'Family Role': '',
    'Baptism Date': '',
    'Baptism Location': '',
    'Update Date': '',
    ...overrides,
  };
}

describe('parseChMeetingsRows', () => {
  it('maps the common fields for a simple member row', () => {
    const { people, skipped } = parseChMeetingsRows([
      row({
        'Person Id': 42,
        'First Name': 'Ann',
        'Last Name': 'Cresswell',
        'Mobile Phone': '07814117385',
        Email: 'Ann@Example.com',
        'Address Line': '145 Blenheim Drive',
        City: 'Derby',
        'Postal Code': 'DE22 2LH',
        'Group Name': 'Members, Hosting Team B',
      }),
    ]);

    expect(skipped).toEqual([]);
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      externalRef: 'chmeetings:42',
      firstName: 'Ann',
      surname: 'Cresswell',
      email: 'ann@example.com',
      phone: '07814117385',
      addressLine1: '145 Blenheim Drive',
      city: 'Derby',
      postcode: 'DE22 2LH',
      personType: 'member',
      tags: ['Members', 'Hosting Team B'],
      familyExternalRef: null,
    });
  });

  it('classifies visitors from the Group Name', () => {
    const { people } = parseChMeetingsRows([
      row({ 'Group Name': 'Visitors, Regular Visitors' }),
    ]);
    expect(people[0].personType).toBe('visitor');
  });

  it('falls back to home phone when mobile is blank, and notes it if both are present', () => {
    const onlyHome = parseChMeetingsRows([row({ 'Home Phone': '01234' })]).people[0];
    expect(onlyHome.phone).toBe('01234');
    expect(onlyHome.notes).toBeNull();

    const both = parseChMeetingsRows([
      row({ 'Mobile Phone': '07999', 'Home Phone': '01234' }),
    ]).people[0];
    expect(both.phone).toBe('07999');
    expect(both.notes).toContain('Home phone: 01234');
  });

  it('folds nickname, middle name and country into notes without touching structured fields', () => {
    const { people } = parseChMeetingsRows([
      row({ Notes: 'Allergic to nuts', Nickname: 'Jaz', 'Middle Name': 'Marie', 'Constituent Country': 'France' }),
    ]);
    expect(people[0].notes).toBe(
      'Allergic to nuts\nKnown as: Jaz\nMiddle name: Marie\nCountry: France',
    );
  });

  it('skips rows with no Person Id or no First Name', () => {
    const { people, skipped } = parseChMeetingsRows([
      row({ 'Person Id': '' }),
      row({ 'First Name': '' }),
      row({ 'Person Id': 5, 'First Name': 'OK' }),
    ]);
    expect(people).toHaveLength(1);
    expect(skipped).toHaveLength(2);
    expect(skipped[0]).toEqual({ sourceRow: 2, reason: 'Missing Person Id.' });
    expect(skipped[1]).toEqual({ sourceRow: 3, reason: 'Missing First Name.' });
  });

  it('ignores Family Id when Family Role is blank (CHMeetings "no family" bucket)', () => {
    const { people, families } = parseChMeetingsRows([
      row({ 'Person Id': 1, 'Family Id': 44, 'Family Role': '' }),
      row({ 'Person Id': 2, 'Family Id': 44, 'Family Role': '' }),
    ]);
    expect(people.every((p) => p.familyExternalRef === null)).toBe(true);
    expect(families).toEqual([]);
  });

  it('groups rows sharing a Family Id and role into a family, naming it by common surname', () => {
    const { families } = parseChMeetingsRows([
      row({ 'Person Id': 10, 'First Name': 'Tim', 'Last Name': 'Davies', 'Family Id': 900, 'Family Role': 'Spouse' }),
      row({ 'Person Id': 11, 'First Name': 'Jude', 'Last Name': 'Davies', 'Family Id': 900, 'Family Role': 'Spouse' }),
      row({ 'Person Id': 12, 'First Name': 'Abi', 'Last Name': 'Davies', 'Family Id': 900, 'Family Role': 'Child' }),
    ]);
    expect(families).toHaveLength(1);
    expect(families[0]).toMatchObject({
      externalRef: 'chmeetings:family:900',
      name: 'The Davies Family',
      memberExternalRefs: ['chmeetings:10', 'chmeetings:11', 'chmeetings:12'],
    });
  });

  it('uses the explicit Primary role as the family primary contact', () => {
    const { families } = parseChMeetingsRows([
      row({ 'Person Id': 20, 'First Name': 'Dean', 'Last Name': 'Theron', 'Family Id': 901, 'Family Role': 'Primary' }),
      row({ 'Person Id': 21, 'First Name': 'Jo', 'Last Name': 'Theron', 'Family Id': 901, 'Family Role': 'Spouse' }),
    ]);
    expect(families[0].primaryExternalRef).toBe('chmeetings:20');
  });

  it('falls back to alphabetical-by-surname-then-first-name when no member is marked Primary', () => {
    const { families } = parseChMeetingsRows([
      row({ 'Person Id': 30, 'First Name': 'Zack', 'Last Name': 'Ashby', 'Family Id': 902, 'Family Role': 'Spouse' }),
      row({ 'Person Id': 31, 'First Name': 'Amy', 'Last Name': 'Ashby', 'Family Id': 902, 'Family Role': 'Spouse' }),
    ]);
    // Same surname, so first name breaks the tie: Amy before Zack.
    expect(families[0].primaryExternalRef).toBe('chmeetings:31');
  });

  it('parses birthdate/baptism/join dates from Date objects into ISO strings', () => {
    const { people } = parseChMeetingsRows([
      row({
        Birthdate: new Date(Date.UTC(1954, 3, 12)),
        'Baptism Date': new Date(Date.UTC(1968, 3, 16)),
        'Join Date': new Date(Date.UTC(2022, 4, 22)),
      }),
    ]);
    expect(people[0].birthdate).toBe('1954-04-12');
    expect(people[0].baptismDate).toBe('1968-04-16');
    expect(people[0].joinDate).toBe('2022-05-22');
  });
});
