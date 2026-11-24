'use client';

import { PdfLoading } from '@/components/pdf-viewer';
import { quoteMatches } from '@/lib/quote-match';
import { Minus, Plus } from 'lucide-react';
import 'pdfjs-dist/web/pdf_viewer.css';
import { useEffect, useRef, useState } from 'react';

// pdf.js in the viewer panel: it opens `page` and marks `quote` there. Its find controller does
// the marking, with our quote match in place of its own, so layout and spacing do not matter.

type Loaded = {
  viewer: import('pdfjs-dist/web/pdf_viewer.mjs').PDFViewer;
  eventBus: import('pdfjs-dist/web/pdf_viewer.mjs').EventBus;
};
type Mark = 'marking' | 'marked' | 'missing' | null;

// One worker for all documents. A loading task destroys a worker it made itself, and a new
// task cannot start until that ends.
let worker: import('pdfjs-dist').PDFWorker | null = null;

function fitScale(viewer: Loaded['viewer'], mode: 'start' | 'width' | 'manual') {
  if (mode === 'manual') return;
  viewer.currentScaleValue = 'page-width';
  if (mode === 'start' && viewer.currentScale > 1) viewer.currentScale = 1;
}

export default function PdfJsView({ url, page, quote }: { url: string; page?: number; quote?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pageNumber, setPageNumber] = useState(page ?? 1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [mark, setMark] = useState<Mark>(null);
  // `start`: 100%, or less if the page is wider than the panel. A resize keeps `start` and `width`.
  const fitMode = useRef<'start' | 'width' | 'manual'>('start');

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      const pdfjs = await import('pdfjs-dist');
      const { EventBus, FindState, PDFFindController, PDFLinkService, PDFViewer } =
        await import('pdfjs-dist/web/pdf_viewer.mjs');
      worker ??= pdfjs.PDFWorker.create({
        port: new Worker(new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url), { type: 'module' }),
      });
      class QuoteFinder extends PDFFindController {
        match(query: string | string[], pageContent: string, pageIndex: number) {
          return typeof query === 'string'
            ? quoteMatches(pageContent, query)
            : super.match(query, pageContent, pageIndex);
        }
        // pdf.js puts the match at the top edge and scrolls the page too; put it a third of the
        // way down the viewer, and scroll the viewer only.
        scrollMatchIntoView(args: { element?: HTMLElement | null; pageIndex?: number; matchIndex?: number }) {
          const self = this as unknown as { _scrollMatches: boolean; _selected: { pageIdx: number; matchIdx: number } };
          const { element, pageIndex = -1, matchIndex = -1 } = args;
          const container = containerRef.current;
          if (!self._scrollMatches || !element || !container) return;
          if (matchIndex !== self._selected.matchIdx || pageIndex !== self._selected.pageIdx) return;
          self._scrollMatches = false;
          const box = container.getBoundingClientRect();
          const at = element.getBoundingClientRect();
          container.scrollTop += at.top - box.top - box.height / 3;
          container.scrollLeft += at.left + at.width / 2 - box.left - box.width / 2;
        }
      }
      const eventBus = new EventBus();
      const linkService = new PDFLinkService({ eventBus });
      const findController = new QuoteFinder({ linkService, eventBus });
      const viewer = new PDFViewer({
        container: containerRef.current!,
        viewer: viewerRef.current!,
        eventBus,
        linkService,
        findController,
        removePageBorders: true,
      });
      linkService.setViewer(viewer);
      eventBus.on('pagechanging', (e: { pageNumber: number }) => setPageNumber(e.pageNumber));
      eventBus.on('scalechanging', (e: { scale: number }) => setScale(e.scale));
      eventBus.on('updatefindcontrolstate', (e: { state: number }) =>
        setMark(
          e.state === FindState.FOUND || e.state === FindState.WRAPPED
            ? 'marked'
            : e.state === FindState.NOT_FOUND
              ? 'missing'
              : 'marking',
        ),
      );

      // Fonts and character maps some PDFs need, from the pdf.js release we run.
      const assets = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}`;
      const task = pdfjs.getDocument({
        url,
        worker,
        cMapUrl: `${assets}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assets}/standard_fonts/`,
        wasmUrl: `${assets}/wasm/`,
      });
      task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => total && setProgress(loaded / total);
      cleanup = () => {
        task.destroy();
        viewer.setDocument(null as never);
      };
      const doc = await task.promise;
      if (cancelled) return;
      eventBus.on('pagesinit', () => {
        fitScale(viewer, fitMode.current);
        setPageCount(doc.numPages);
        setLoaded({ viewer, eventBus });
      });
      viewer.setDocument(doc);
      linkService.setDocument(doc);
    })().catch((e) => {
      if (cancelled) return;
      console.error('pdf.js could not open the document', e);
      setError(true);
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [url]);

  // Go to the page, then mark the quote from there on.
  useEffect(() => {
    if (!loaded) return;
    if (page) loaded.viewer.currentPageNumber = page;
    if (!quote) {
      setMark(null);
      return;
    }
    loaded.eventBus.dispatch('find', {
      source: null,
      type: '',
      query: quote,
      caseSensitive: false,
      entireWord: false,
      highlightAll: false,
      findPrevious: false,
      matchDiacritics: false,
    });
  }, [loaded, page, quote]);

  useEffect(() => {
    if (!loaded) return;
    const observer = new ResizeObserver(() => fitScale(loaded.viewer, fitMode.current));
    observer.observe(containerRef.current!);
    return () => observer.disconnect();
  }, [loaded]);

  const zoom = (factor: number) => {
    if (!loaded) return;
    fitMode.current = 'manual';
    loaded.viewer.currentScale = Math.min(4, Math.max(0.25, loaded.viewer.currentScale * factor));
  };
  const fit = () => {
    if (!loaded) return;
    fitMode.current = 'width';
    fitScale(loaded.viewer, 'width');
  };

  const button =
    'flex size-6 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-40';
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 shrink-0 items-center gap-x-2 border-b border-slate-200 bg-white px-3 text-xs text-slate-600">
        <span className="tabular-nums">
          Page {pageNumber}
          {pageCount ? ` of ${pageCount}` : ''}
        </span>
        <span className="text-slate-300">|</span>
        <button type="button" onClick={() => zoom(1 / 1.2)} aria-label="Zoom out" className={button} disabled={!loaded}>
          <Minus className="size-3.5" />
        </button>
        <span className="w-9 text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoom(1.2)} aria-label="Zoom in" className={button} disabled={!loaded}>
          <Plus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={fit}
          disabled={!loaded}
          className="rounded px-1.5 py-0.5 transition-colors hover:bg-slate-200 disabled:opacity-40"
        >
          Fit width
        </button>
        <span className="ml-auto truncate text-slate-500" aria-live="polite">
          {mark === 'marking' && 'Finding the quote…'}
          {mark === 'marked' && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">Quote marked</span>}
          {mark === 'missing' && 'The quote could not be marked in this file.'}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="pdf-quote absolute inset-0 overflow-auto bg-slate-100">
          <div ref={viewerRef} className="pdfViewer" />
        </div>
        {!loaded && !error && <PdfLoading progress={progress} />}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50 px-6 text-center text-xs text-slate-500">
            This PDF could not be shown here. Open it in a new tab.
          </div>
        )}
      </div>
    </div>
  );
}
