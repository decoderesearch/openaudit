import Link from '@/components/link';
import { Page, PageHeader } from '@/components/page';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <Page width="narrow">
      <PageHeader title="Not found" description="This page does not exist, or you do not have access to it." />
      <div>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </Page>
  );
}
