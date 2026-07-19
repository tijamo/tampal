import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy notice' };

const controllerName = process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME ?? 'Tamworth Christadelphian Church';
const controllerEmail = process.env.NEXT_PUBLIC_DATA_CONTROLLER_EMAIL ?? 'privacy@example.org';

export default function PrivacyPage() {
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-10">
      <article className="prose-tamfam flex flex-col gap-4">
        <h1 className="text-3xl font-bold">Privacy notice</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          How {controllerName} (&ldquo;we&rdquo;) collects and uses your personal data in the
          Tampal app, under the UK GDPR, the Data Protection Act 2018, and the Data (Use and
          Access) Act 2025.
        </p>

        <Section title="Who is responsible for your data">
          <p>
            The data controller is {controllerName}. For any privacy question or to exercise your
            rights, contact us at{' '}
            <a href={`mailto:${controllerEmail}`} className="text-brand-700 underline">
              {controllerEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc pl-6">
            <li>Your name, and whether you are a member or a visitor.</li>
            <li>
              Optionally, contact and address details you or an administrator choose to store.
            </li>
            <li>
              Records of which meetings you attended. Because our meetings are religious, an
              attendance record reveals information about your religious beliefs.
            </li>
          </ul>
        </Section>

        <Section title="Why this is “special category” data">
          <p>
            Attendance at a Christadelphian meeting reveals your religious beliefs, which is
            &ldquo;special category&rdquo; personal data under Article 9 of the UK GDPR and
            receives extra protection.
          </p>
        </Section>

        <Section title="Our lawful basis">
          <ul className="list-disc pl-6">
            <li>
              <strong>Your explicit consent</strong> (Article 9(2)(a)) to record your attendance
              and to store your contact details. You can withdraw consent at any time.
            </li>
            <li>
              <strong>Not-for-profit religious body</strong> processing (Article 9(2)(d)): as a
              religious community we may process members&rsquo; data for our legitimate church
              activities, and we do not disclose it outside the church without your consent.
            </li>
          </ul>
        </Section>

        <Section title="How we protect it">
          <ul className="list-disc pl-6">
            <li>Data is stored in the United Kingdom / EU region and encrypted in transit.</li>
            <li>
              Access is restricted by role: attendance and contact details are visible only to
              administrators (and to you, for your own records).
            </li>
            <li>Every change to your data is recorded in an internal audit log.</li>
            <li>
              We use only strictly-necessary cookies and local storage to keep you signed in and
              remember your own choices in the app (for example, dismissing the install prompt).
              We use no analytics or advertising trackers, so no cookie consent banner is needed.
            </li>
            <li>
              To send you sign-in links and invitations, we use an email delivery provider
              (Brevo, an EU-based company) as a data processor. They see only your name and email
              address, solely to deliver that email, and never for marketing.
            </li>
          </ul>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep member records for as long as you are part of the church family. Visitor
            contact details are removed after a period of inactivity (by default 24 months) unless
            you ask us to keep them. Attendance records may be kept in anonymised form for our own
            record-keeping.
          </p>
        </Section>

        <Section title="Automated decisions and marketing">
          <p>
            We do not use your data for any automated decision-making or profiling, and we do not
            send bulk marketing or newsletter emails. If that ever changes, we will update this
            notice first and seek any separate consent the law requires before doing so.
          </p>
        </Section>

        <Section title="Your rights">
          <p>You have the right to:</p>
          <ul className="list-disc pl-6">
            <li>ask for a copy of the data we hold about you (access &amp; portability);</li>
            <li>have inaccurate data corrected;</li>
            <li>withdraw consent and have your data erased;</li>
            <li>restrict or object to processing.</li>
          </ul>
          <p>
            To exercise any of these, contact{' '}
            <a href={`mailto:${controllerEmail}`} className="text-brand-700 underline">
              {controllerEmail}
            </a>
            .
          </p>
        </Section>

        <Section title="How to complain">
          <p>
            If you&rsquo;re unhappy with how we&rsquo;ve handled your data, please tell us first
            at{' '}
            <a href={`mailto:${controllerEmail}`} className="text-brand-700 underline">
              {controllerEmail}
            </a>
            . We will acknowledge your complaint promptly and aim to respond in full within 30
            days, so we can try to put things right directly.
          </p>
          <p>
            If you&rsquo;re not satisfied with our response, or you&rsquo;d rather complain
            straight away, you have the right to complain to the UK&rsquo;s data protection
            regulator, the Information Commissioner&rsquo;s Office (ICO), at{' '}
            <a href="https://ico.org.uk" className="text-brand-700 underline">
              ico.org.uk
            </a>
            . Complaining to us first is optional, not a required step.
          </p>
        </Section>
      </article>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}
