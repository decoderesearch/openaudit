import { Conspicuous, ContactBlock, LegalPage, LegalSection, Mail, Notice } from '@/components/legal';
import Link from '@/components/link';
import { SITE_NAME } from '@/lib/env';
import { HARM_PROMISE, NO_TRAINING_PROMISE } from '@/lib/eval-attestation';
import { CANARY, DONATE_URL, LEGAL_ENTITY, SPONSOR, TERMS_UPDATED } from '@/lib/legal';
import { SPONSORSHIP_HASH, SPONSORSHIP_TERMS } from '@/lib/sponsorship';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Service' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={TERMS_UPDATED}>
      <Notice>
        <strong>No AI training on evals.</strong> You must not use the evals on this site, or their questions, answers,
        samples, rubrics, model outputs or logs, to train, fine-tune or distill AI models, or put them in a training
        dataset. This rule applies to people, companies, crawlers and AI agents. To do so is an explicit violation of
        these terms. You must also respect what each eval&apos;s owners ask. See{' '}
        <a href="#ai-training">Evals and AI training</a>.
      </Notice>

      <LegalSection id="agreement" title="1. Agreement">
        <p>
          {SITE_NAME} (the &quot;Service&quot;), at openaudit.com, and its related tools, is operated by {LEGAL_ENTITY}{' '}
          (&quot;we&quot;, &quot;us&quot;). {SPONSOR} is a nonprofit organization, and Decode Research is one of its
          fiscally sponsored projects.
        </p>
        <p>
          These terms are a contract between you and us. When you use the Service, send a submission, subscribe to email
          updates or donate, you agree to these terms and to our <Link href="/privacy">Privacy Policy</Link>. If you do
          not agree, do not use the Service. If you use the Service for an organization, you agree for that organization
          and confirm that you have the authority to do so.
        </p>
      </LegalSection>

      <LegalSection id="eligibility" title="2. Who can use the Service">
        <p>
          You must be at least 18 years old, or the age of majority where you live if that is higher. You must not be
          barred from the Service by law or by an earlier ban from us.
        </p>
      </LegalSection>

      <LegalSection id="results" title="3. What results are, and what they are not">
        <p>
          The Service shows evaluations (&quot;evals&quot;) of AI models and related tools, results that we or our users
          measure, and information we extract from documents that others publish, such as system cards.
        </p>
        <ul>
          <li>
            <strong>AI evaluation is an immature field.</strong> It cannot give the kind of safety assurance that other
            safety-critical industries, such as aviation, expect. No result on the Service sets a limit on the risks of
            an AI system, or verifies that it is safe.
          </li>
          <li>
            <strong>A result is a measurement, not a verdict.</strong> It applies only to the model, version, provider
            route, settings, samples, judge and date it records. A different setup can give a different result.
          </li>
          <li>
            <strong>Results can be wrong.</strong> Evals have known limits. Models give different answers on different
            tries. Automated judges make mistakes. Providers change models without notice. Software, including ours, has
            bugs. Extractions from documents can misread them.
          </li>
          <li>
            <strong>Results are not statements about any company&apos;s intent or conduct.</strong> They are not a
            certification, rating, endorsement or accusation. Summaries and labels on the Service, such as &quot;high
            risk&quot; or &quot;fails&quot;, are our opinions about the measured data.
          </li>
          <li>
            <strong>Results are not professional advice</strong> (legal, security, compliance, investment or other). Do
            not rely on them alone for decisions with legal, financial or safety effects. Check the source data, which
            we link where we can.
          </li>
        </ul>
        <p>
          If you think a result or an extraction is wrong, tell us (see{' '}
          <a href="#corrections">Corrections and removals</a>).
        </p>
      </LegalSection>

      <LegalSection id="paid-runs" title="4. Runs">
        <ul>
          <li>
            <strong>We choose the runs.</strong> We choose the evals, models, settings and judges, and we start all
            runs. You can suggest an eval, a method or a model to audit (see <Link href="/contribute">Contribute</Link>
            ), but we decide what to run.
          </li>
          <li>
            <strong>No guarantee.</strong> A run can fail, stop early, finish only in part, or give results that nobody
            expects. Causes include model providers, judges, datasets, outside services and our own software. We do not
            guarantee that a run completes or gives any particular result.
          </li>
          <li>
            <strong>Results are public.</strong> We publish runs with their results, samples (where the dataset terms
            allow), model outputs and logs. Anyone can see them, and they can appear in lists and search. We can hide or
            remove a run, a model or an eval at our discretion.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="donations" title="5. Donations">
        <p>
          You can donate on the <a href={DONATE_URL}>donation page</a> of {SPONSOR}, or email us to give in another way.
          A donation is a gift to {SPONSOR}, a 501(c)(3) public charity, for the work of Decode Research. You get no
          goods or services for it. {SPONSOR} has final control over how it uses donations, and it sends your receipt.
          Donations are tax-deductible as far as the law allows; ask your tax advisor. Donations are not refundable,
          except for a payment made in error. The donation page belongs to {SPONSOR}, and its terms and privacy policy
          apply there.
        </p>
        <p id={SPONSORSHIP_HASH} className="scroll-mt-16">
          <strong>Audit sponsorship.</strong> You can donate to sponsor the audit of a model. An audit sponsorship is a
          donation. When you sponsor an audit, you agree that:
        </p>
        <ul>
          {SPONSORSHIP_TERMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection id="acceptable-use" title="6. Acceptable use">
        <p>Use the Service in good faith. Do not:</p>
        <ul>
          <li>break the law, or help others break it;</li>
          <li>attack, overload or probe the Service, or avoid its rate limits or access controls;</li>
          <li>
            scrape or download the Service in bulk in a way that ignores our robots.txt or puts load on the Service;
          </li>
          <li>send spam, or false or misleading submissions or reports;</li>
          <li>
            game an eval, for example by training on its test data, or make a model or method seem better than it is in
            normal use;
          </li>
          <li>
            hide a conflict of interest in a submission, for example that you work for the developer of a model or
            method in it;
          </li>
          <li>put the personal data or secrets of other people in a submission;</li>
          <li>
            use eval content from the Service to train, fine-tune or distill AI models, or put it in a training dataset,
            yourself or through others (see <a href="#ai-training">Evals and AI training</a>);
          </li>
          <li>
            break the license, terms or stated wishes of an eval or dataset, for example by posting samples that its
            owners ask you not to post;
          </li>
          <li>
            misrepresent results: present them as something they are not, remove the settings and limits they come with
            in order to mislead, or say that we or anyone else endorse a model, product or claim;
          </li>
          <li>use the Service to harass, threaten, defame or impersonate anyone;</li>
          <li>infringe the intellectual property or privacy rights of others;</li>
          <li>upload malware, or try to get access to data that is not yours.</li>
        </ul>
      </LegalSection>

      <LegalSection id="suspension" title="7. Suspension and bans">
        <p>
          We can limit, suspend or end your access, block your submissions or emails, or remove content, at any time and
          with or without notice, if we believe in our sole judgment that you misused the Service, broke these terms, or
          put the Service, other users or third parties at risk. You can stop using the Service at any time. Sections 3,
          5 and 8 to 16 continue after your access ends.
        </p>
      </LegalSection>

      <LegalSection id="content" title="8. Content and intellectual property">
        <ul>
          <li>
            <strong>Our content.</strong> We or our licensors own the Service, its software and its design.
          </li>
          <li>
            <strong>Our data.</strong> You can copy, export and reuse the scores, rankings, run settings and other
            metadata that we publish, in full or in part, under the{' '}
            <a href="https://creativecommons.org/licenses/by/4.0/">Creative Commons Attribution 4.0 license</a> (CC BY
            4.0). You must credit {SITE_NAME}, link to openaudit.com or to the source page, and say if you changed the
            data. For large exports, email us. This license does not cover eval content (see below) or the third-party
            materials below: documents, datasets, model outputs, and names and trademarks.
          </li>
          <li id="ai-training" className="scroll-mt-16">
            <strong>Evals and AI training.</strong> An eval works only if the models it tests have not seen it. Eval
            content means the questions, prompts, answers, samples, rubrics, model outputs, transcripts and logs on the
            Service. You must not use eval content to train, fine-tune or distill any AI model, or put it in a dataset
            for that use, yourself or through others. This applies to people, companies, crawlers and AI agents, and it
            is an explicit violation of these terms. You must also respect what each eval&apos;s owners ask in its
            license, terms, paper or dataset card, for example not to post samples or not to train on them. Where their
            terms are stricter than ours, theirs apply. Our pages carry this canary string, so that you can find and
            remove them from training data: <code className="text-xs break-all">{CANARY}</code>. Eval content is open
            only to people who read it in our web pages, and to our staff. You must not use scripts, crawlers or AI
            agents to get it, unless we agree in writing. Requests for eval content must state who sends them (a person,
            or an AI agent with its name, model and operator) and confirm: &ldquo;{NO_TRAINING_PROMISE}&rdquo;. Each
            such request is a separate statement by you, and by the person or company that operates the agent, that the
            information is true and that you will obey this section. The owners of each eval are intended third-party
            beneficiaries of this section for their eval content: they can enforce it against you directly, in any court
            that has jurisdiction. They have no other rights under these terms, and we can change this section without
            their consent.
          </li>
          <li>
            <strong>Your content.</strong> You keep the rights that you have in what you submit, such as incident
            reports, evals, methods, results and anything else you send us. You give us a worldwide, royalty-free,
            perpetual license to host, copy, process, publish and display it, and to make derived works such as
            aggregate results, so that we can operate and improve the Service. You confirm that you have the rights
            needed to give this license. We decide what to publish: we do not promise to add, run or keep a submission,
            and we check submissions for fairness.
          </li>
          <li>
            <strong>Pull requests.</strong> When you submit a method or results as a pull request to our GitHub
            repository, the pull request is public, and GitHub&apos;s terms apply to it. Your files keep the license
            that your submission states, and the license above also applies to them.
          </li>
          <li>
            <strong>Third-party names and materials.</strong> Names, trademarks and logos of companies, models and
            products belong to their owners. We use them only to identify those products and to report on them. We claim
            no ownership of them, and their use does not mean that the owners endorse or are affiliated with the
            Service. Documents that others publish, such as system cards, belong to their publishers. We keep copies so
            that citations stay accurate and links keep working, and we link the original.
          </li>
          <li>
            <strong>Datasets</strong> belong to their creators and come with their own licenses and terms. Those terms
            apply to you when you use the samples.
          </li>
          <li>
            <strong>Model outputs</strong> come from third-party models. We do not write them and do not endorse them.
            They can contain offensive or harmful text, because many evals test exactly that. Before you read eval
            content in our web pages, you confirm: &ldquo;{HARM_PROMISE}&rdquo;. We withhold some dangerous replies, or
            show them only to people that we approve.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="corrections" title="9. Corrections and removals">
        <p>
          We want results to be accurate. If you think a result, extraction or other content is wrong, or that it
          infringes your rights, email <Mail /> with the page link, what is wrong and, if you can, your evidence. This
          includes companies whose models or documents are on the Service. We will review each report in good faith and
          do our best to correct, annotate or remove content that is wrong or that infringes. We are not required to
          remove content that is accurate.
        </p>
      </LegalSection>

      <LegalSection id="copyright" title="10. Copyright complaints">
        <p>
          We respect copyright and respond to notices under the U.S. Digital Millennium Copyright Act. To report an
          infringement, send our agent a notice that includes:
        </p>
        <ol>
          <li>your physical or electronic signature;</li>
          <li>the copyrighted work that you say is infringed;</li>
          <li>the material that you say infringes, and its URL on the Service;</li>
          <li>your name, address, telephone number and email address;</li>
          <li>
            a statement that you believe in good faith that the owner, its agent or the law has not authorized the use;
          </li>
          <li>
            a statement, under penalty of perjury, that the notice is accurate and that you are the owner or are
            authorized to act for the owner.
          </li>
        </ol>
        <p>
          If we remove your material because of a notice and you think that this was a mistake, you can send a
          counter-notice as the law describes. We block people who infringe again and again.
        </p>
        <p>Copyright agent:</p>
        <ContactBlock />
      </LegalSection>

      <LegalSection id="third-parties" title="11. Third-party services">
        <p>
          The Service uses other companies to work, such as hosting and email providers, model providers and model
          routers. Links take you to other sites, such as the donation page of {SPONSOR} and GitHub. Their terms and
          policies apply to their services. We are not responsible for them, and a failure in their service can make a
          run fail.
        </p>
      </LegalSection>

      <LegalSection id="disclaimers" title="12. Disclaimers">
        <Conspicuous>
          The Service, all results, extractions and other content are provided &quot;as is&quot; and &quot;as
          available&quot;, with all faults. To the fullest extent the law allows, we disclaim all warranties, express or
          implied, including warranties of merchantability, fitness for a particular purpose, title, non-infringement
          and accuracy. We do not warrant that the Service will be uninterrupted, secure or free of errors, or that any
          result is complete, current or correct.
        </Conspicuous>
      </LegalSection>

      <LegalSection id="liability" title="13. Limitation of liability">
        <Conspicuous>
          To the fullest extent the law allows, we and our directors, officers, employees, volunteers, contributors and
          fiscal sponsor will not be liable for any indirect, incidental, special, consequential, exemplary or punitive
          damages, or for lost profits, revenue, data, goodwill or reputation, arising from or related to the Service or
          these terms, even if we were told that such damages were possible. Our total liability for all claims is
          limited to 100 U.S. dollars.
        </Conspicuous>
        <p>
          Some places do not allow some of these limits. In those places, the limits apply as far as the law allows.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" title="14. Indemnity">
        <p>
          You will defend and indemnify us, and the people and organizations named in section 13, against claims, losses
          and costs (including reasonable legal fees) that come from your use of the Service, your content, your use or
          publication of results, or your breach of these terms or of the law. This includes claims by the owners of an
          eval that come from your use of their eval content against the section{' '}
          <a href="#ai-training">Evals and AI training</a>.
        </p>
      </LegalSection>

      <LegalSection id="law" title="15. Governing law and disputes">
        <p>
          The laws of the State of Maryland, United States, govern these terms, without regard to its conflict of law
          rules. You and we agree to the exclusive jurisdiction of the state and federal courts in Maryland for any
          dispute about the Service or these terms. Before you start a claim, email us and give us 30 days to try to
          resolve it.
        </p>
      </LegalSection>

      <LegalSection id="general" title="16. General">
        <ul>
          <li>
            <strong>Changes.</strong> We can change the Service, or stop all or part of it, at any time. We can change
            these terms. We will change the date at the top and, for large changes, show a notice on the Service. If you
            use the Service after a change, you accept the new terms.
          </li>
          <li>
            <strong>Whole agreement.</strong> These terms, the Privacy Policy and the dataset terms that apply are the
            whole agreement between you and us about the Service.
          </li>
          <li>
            <strong>Severability and waiver.</strong> If a court finds part of these terms unenforceable, the rest stays
            in effect. If we do not enforce a term, we do not give up the right to enforce it later.
          </li>
          <li>
            <strong>Assignment.</strong> You cannot transfer these terms. We can transfer them, for example to an
            organization that takes over the Service.
          </li>
          <li>
            <strong>Events outside our control.</strong> We are not liable for delays or failures caused by events that
            we cannot reasonably control.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="contact" title="17. Contact">
        <ContactBlock />
      </LegalSection>
    </LegalPage>
  );
}
