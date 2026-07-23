import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Field, Button, Banner, Card, PageHeading } from '@/components/ui';
import { ToggleSwitch } from '@/components/toggle-switch';
import { BottomNav } from '@/components/bottom-nav';
import { InstallPrompt } from '@/components/install-prompt';

jest.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('accessibility (jest-axe)', () => {
  it('a labelled form with an error has no violations', async () => {
    const { container } = render(
      <main>
        <PageHeading>Add a person</PageHeading>
        <form aria-label="Add person">
          <Field label="First name" name="first_name" required />
          <Field
            label="Email"
            name="email"
            type="email"
            error="Enter a valid email address"
          />
          <Banner tone="error">Please fix the errors above.</Banner>
          <Button type="submit">Save</Button>
        </form>
      </main>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('a card with a status banner has no violations', async () => {
    const { container } = render(
      <main>
        <Card>
          <Banner tone="success">Saved.</Banner>
        </Card>
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('a consent toggle switch, granted and not, has no violations', async () => {
    const { container } = render(
      <main>
        <ToggleSwitch id="a" label="Granted example" granted={true} onToggle={() => {}} />
        <ToggleSwitch id="b" label="Not granted example" granted={false} onToggle={() => {}} />
      </main>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('the mobile bottom nav, admin and non-admin, has no violations', async () => {
    const { container, rerender } = render(<BottomNav isAdmin={false} />);
    expect(await axe(container)).toHaveNoViolations();
    rerender(<BottomNav isAdmin={true} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('the install prompt (iOS instructions variant) has no violations', async () => {
    localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({ matches: false }),
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'iPhone',
    });

    const { container, findByRole } = render(<InstallPrompt />);
    await findByRole('status');
    expect(await axe(container)).toHaveNoViolations();
  });
});
