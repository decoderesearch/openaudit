import { ContactBlock, LegalPage, LegalSection, Mail } from '@/components/legal';
import Link from '@/components/link';
import { ASK_ENABLED, SITE_NAME } from '@/lib/env';
import { DONATE_URL, LEGAL_ENTITY, PRIVACY_UPDATED, SPONSOR } from '@/lib/legal';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy' };

// Keep this page true to the code: what we store (prisma/schema.prisma), the update lists in
// Resend (lib/server/updates.ts), cookies and browser storage, and every outside service we use.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={PRIVACY_UPDATED}>
      <LegalSection id="summary" title="Summary">
        <ul>
          <li>
            {SITE_NAME} is operated by {LEGAL_ENTITY}, a nonprofit organization in the United States.
          </li>
          <li>
            You can read the site without an account. We use no advertising and no tracking cookies. We count visits
            with Cloudflare Web Analytics, which sets no cookies.
          </li>
          <li>
            When you subscribe to email updates or send a submission, we keep the email address that you give us. When
            you donate, the donation page of {SPONSOR} takes the payment. We never see your card number.
          </li>
          <li>We do not sell your personal information.</li>
          <li>
            To see, correct or delete your data, email <Mail />.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="collect" title="1. What we collect">
        <ul>
          <li>
            <strong>Email updates.</strong> Your email address, the lists that you pick, and whether you unsubscribed.
            We email you a link to confirm; nothing changes until you click it. The confirm link holds the address and
            the lists in a signed token, so we keep no record of it until you confirm. If you unsubscribe, we keep the
            address marked as unsubscribed, so that we send it no more update emails.
          </li>
          <li>
            <strong>Submissions.</strong> What you send with the Submit form: the type, your text, the other fields,
            your email address if you give it, and the page that you sent it from. We do not keep your IP address with
            it. We email a copy to our inbox, and a receipt to you if you give an address. Our admins read submissions
            to review and reply.
          </li>
          <li>
            <strong>Pull requests.</strong> When you submit a method or results as a pull request to our GitHub
            repository, the pull request, your files and your GitHub username are public on GitHub.
          </li>
          <li>
            <strong>Donations.</strong> The <a href={DONATE_URL}>donation page</a> of {SPONSOR} collects your name,
            contact details, payment details, the amount and your comment, under the privacy policy of {SPONSOR}.{' '}
            {SPONSOR} shares your name, email address, the amount and your comment with us, so that we can match your
            gift to the audit that it sponsors and thank you.
          </li>
          <li>
            <strong>Emails we send.</strong> For each email: the address, the type (for example a confirm link or a
            submission receipt), the subject and the time. We use this record to limit how many emails go to one inbox.
          </li>
          <li>
            <strong>Messages to us.</strong> What you write when you email us, for example to sponsor an audit.
          </li>
          <li>
            <strong>Visits.</strong> Cloudflare Web Analytics counts page views, the site that sent you, your country,
            your browser and device type, and how fast pages load. It sets no cookies and does not identify you.
          </li>
          <li>
            <strong>Error reports.</strong> When a page or a run fails, we send a report to Sentry: the error, the page
            path, and where in our code it failed. We send no cookies, headers, form text, query values or user data
            with it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="cookies" title="2. Cookies and browser storage">
        <ul>
          <li>
            <strong>Eval content cookie</strong> (<code>openaudit.eval_clearance</code>). After you confirm the
            statement for eval content and pass the browser check, it lets you read eval content for 30 days. It holds
            only a signed expiry date.
          </li>
          <li>
            <strong>Home page cookie</strong> (<code>openaudit.hero-small</code>). It remembers that you made the banner
            on the home page small. It holds only the value 1.
          </li>
          <li>
            <strong>Local storage</strong> keeps a record that you closed the first-visit notice, and a copy of your
            eval content statement with its expiry date. Both stay on your device.
          </li>
          <li>
            <strong>Browser check.</strong> The email updates form, the Submit form and the eval content statement can
            use Cloudflare Turnstile to stop bots. Cloudflare processes data about your browser for this check.
          </li>
          <li>
            <strong>PDF viewer.</strong> When you open a document, your browser loads viewer files (fonts and code) from
            the jsDelivr network, which receives your IP address. The document itself comes from our servers.
          </li>
        </ul>
        <p>We do not use cookies for analytics or advertising, so we show no cookie banner.</p>
      </LegalSection>

      <LegalSection id="use" title="3. How we use it">
        <ul>
          <li>
            to send the email updates that you ask for, at most one email a day, with no tracking of opens or clicks;
          </li>
          <li>to review and answer your submissions and messages;</li>
          <li>to match a donation to the audit that it sponsors, and to thank you;</li>
          <li>to stop abuse: we use IP addresses to limit requests, and email records to limit emails;</li>
          <li>to fix problems and improve the Service;</li>
          <li>
            to obey the law and enforce our <Link href="/terms">Terms of Service</Link>.
          </li>
        </ul>
        <p>We do not sell your personal information, and we do not use it for targeted advertising.</p>
      </LegalSection>

      <LegalSection id="share" title="4. Who we share it with">
        <p>We use these service providers. Each gets only what it needs to do its work for us:</p>
        <ul>
          <li>
            <strong>Cloudflare</strong>: hosts the site, stores files and run logs, runs evals, checks browsers, limits
            requests per IP address, counts visits, and keeps request logs for operations and security.
          </li>
          <li>
            <strong>Sentry</strong>: gets the error reports, so that we can fix problems.
          </li>
          <li>
            <strong>Neon</strong>: hosts our database.
          </li>
          <li>
            <strong>Resend</strong>: sends our emails and keeps the email update lists. It gets your email address, your
            lists and the email content. The link in each update email opens a Resend page for your lists.
          </li>
          <li>
            <strong>OpenRouter and the model providers it routes to</strong>: get the eval prompts and return the model
            outputs. We send them no personal information.
          </li>
          <li>
            <strong>jsDelivr</strong>: serves the PDF viewer files to your browser.
          </li>
          {ASK_ENABLED && (
            <li>
              <strong>Anthropic</strong>: answers questions in Ask {SITE_NAME}. It gets your questions, the answers in
              the same chat and the public page data that you ask about. We do not save these chats.
            </li>
          )}
        </ul>
        <p>
          {SPONSOR} runs its own donation page with its own providers. GitHub hosts pull requests under its own privacy
          policy.
        </p>
        <p>
          We can also share information with {SPONSOR} staff for accounting and oversight; when the law requires it; to
          protect the rights, safety or property of users, the public or us; or with an organization that takes over the
          Service, under this policy.
        </p>
      </LegalSection>

      <LegalSection id="public" title="5. Public information">
        <p>
          Runs, results, model outputs, logs and the samples that dataset terms allow are public. Anyone with the link
          can see them, and public runs appear in lists. We ask search engines not to index run pages, and we block AI
          training crawlers, but we cannot control every copy that others make. Our{' '}
          <Link href="/terms#ai-training">Terms of Service</Link> forbid the use of eval content to train AI models.
        </p>
        <p>
          When we publish something from a submission, such as an incident, we do not show your name or email address,
          unless you ask us to credit you. This is not a guarantee of anonymity: our service providers process
          submissions, and the content of a submission can identify you. If you need anonymity, give no name or email
          address, and remove the details that identify you.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="6. How long we keep it">
        <ul>
          <li>Email update lists: until you unsubscribe. After that, we keep the address marked as unsubscribed.</li>
          <li>Donation records: as long as accounting and tax laws require.</li>
          <li>Email records and submissions: we do not yet delete them on a schedule.</li>
        </ul>
        <p>
          If you ask us to delete your data, we delete your personal information, except what the law requires us to
          keep, such as donation records.
        </p>
      </LegalSection>

      <LegalSection id="rights" title="7. Your choices and rights">
        <ul>
          <li>Each update email has a link where you can change your lists or unsubscribe.</li>
          <li>
            To get a copy of your data, correct it, delete it, or object to how we use it, email <Mail />. We answer
            within 30 days. We can ask you to confirm that the data is yours.
          </li>
          <li>
            Depending on where you live, for example in the European Economic Area, the United Kingdom or California,
            you can have more rights, such as the right to complain to a data protection authority. We will respect
            them.
          </li>
        </ul>
        <p>
          If those laws apply, our legal bases are: your consent (email updates); our legitimate interests (answering
          submissions and messages, matching donations, security, abuse prevention, improving the Service); and legal
          obligations (donation records).
        </p>
      </LegalSection>

      <LegalSection id="security" title="8. Security">
        <p>
          We use encrypted connections, sign the tokens in our links and cookies, and keep the eval content cookie out
          of reach of page scripts. No system is fully secure, so we cannot guarantee the security of your data.
        </p>
      </LegalSection>

      <LegalSection id="children" title="9. Children">
        <p>
          The Service is for adults. We do not knowingly collect personal information from children. If you think a
          child gave us personal information, email <Mail /> and we will delete it.
        </p>
      </LegalSection>

      <LegalSection id="transfers" title="10. Where we process data">
        <p>
          We are in the United States, and our providers process data in the United States and in other countries where
          they operate. When you use the Service, your data goes to those places.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="11. Changes">
        <p>
          When we change this policy, we change the date at the top. For large changes, we show a notice on the Service.
        </p>
      </LegalSection>

      <LegalSection id="contact" title="12. Contact">
        <ContactBlock />
      </LegalSection>
    </LegalPage>
  );
}
