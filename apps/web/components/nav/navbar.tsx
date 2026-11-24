import NavbarClient from '@/components/nav/navbar-client';
import { SIGN_IN_ENABLED } from '@/lib/env';
import { adminTodo } from '@/lib/server/admin-summary';
import { navMethods } from '@/lib/server/nav-methods';
import { navOrgs } from '@/lib/server/nav-orgs';
import { isAdmin, type Viewer } from '@/lib/server/viewer';

// The sign-in flag is server only, so the server gives it to the client. The
// Organizations and Methods menus come with the page. When a read fails, the menu loads on open.
// An admin sees the count of admin work that waits on the account button.
export default async function Navbar({ viewer }: { viewer: Viewer | null }) {
  const [orgs, methods, todo] = await Promise.all([
    navOrgs().catch(() => null),
    navMethods().catch(() => null),
    isAdmin(viewer)
      ? adminTodo().then(
          (t) => t.total,
          () => 0,
        )
      : 0,
  ]);
  return <NavbarClient viewer={viewer} signIn={SIGN_IN_ENABLED} menus={{ orgs, methods }} adminTodo={todo} />;
}
