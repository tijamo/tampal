import { invitePerson, setUserRole } from '@/app/(app)/people/actions';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('next/navigation', () => ({ redirect: jest.fn() }));
jest.mock('@/lib/auth');
jest.mock('@/lib/supabase/server');
jest.mock('@/lib/supabase/admin');

const mockedRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockedCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

function asAdmin(userId = 'admin-1') {
  mockedRequireAdmin.mockResolvedValue({
    userId,
    email: 'admin@example.org',
    profile: null,
    isAdmin: true,
    isRealAdmin: true,
    viewMode: 'admin',
  });
}

describe('invitePerson', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asAdmin();
  });

  it('refuses to invite a person with no email on file', async () => {
    const result = await invitePerson('person-1', '');
    expect(result.error).toMatch(/no email address/i);
    expect(mockedCreateAdminClient).not.toHaveBeenCalled();
  });

  it('sends an invite carrying the person_id in the user metadata', async () => {
    const inviteUserByEmail = jest.fn().mockResolvedValue({ error: null });
    mockedCreateAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail } },
    } as never);

    const result = await invitePerson('person-1', 'new@example.org');

    expect(inviteUserByEmail).toHaveBeenCalledWith(
      'new@example.org',
      expect.objectContaining({ data: { person_id: 'person-1' } }),
    );
    expect(result.success).toBeTruthy();
    expect(result.error).toBeUndefined();
  });

  it('surfaces a friendly error when the email already has an account', async () => {
    const inviteUserByEmail = jest
      .fn()
      .mockResolvedValue({ error: { message: 'A user with this email address has already been registered' } });
    mockedCreateAdminClient.mockReturnValue({
      auth: { admin: { inviteUserByEmail } },
    } as never);

    const result = await invitePerson('person-1', 'existing@example.org');
    expect(result.error).toMatch(/already has a user account/i);
  });
});

describe('setUserRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    asAdmin('admin-1');
  });

  it('updates the target user role', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn(() => ({ eq }));
    mockedCreateClient.mockReturnValue({ from: () => ({ update }) } as never);

    await setUserRole('other-user', 'person-2', true);

    expect(update).toHaveBeenCalledWith({ role: 'admin' });
    expect(eq).toHaveBeenCalledWith('user_id', 'other-user');
  });

  it("refuses to let an admin change their own role, so they can't lock themselves out", async () => {
    await setUserRole('admin-1', 'person-1', false);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
