/** For each anchor in a `NavPanel`: it stops below the navbar, and from `lg` below the breadcrumbs.
 * It is not in the client file of `NavPanel`, so that server pages get the string. */
export const ANCHOR = 'scroll-mt-16 lg:scroll-mt-24';

/** For the last anchor in a `NavPanel`: it fills the screen under the navbar, so a link to it can
 * bring it to the top. */
export const LAST_ANCHOR = 'min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-6rem)]';
