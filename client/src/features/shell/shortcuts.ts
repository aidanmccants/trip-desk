// Global keyboard shortcuts: n (new trip), / (search trips), 1-6 (trip tabs).
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TAB_IDS = ['overview', 'itinerary', 'places', 'expenses', 'documents', 'people'];

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/** Global keyboard shortcuts. */
export function useShortcuts() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      // Don't act behind an open sheet.
      if (document.querySelector('[data-sheet]')) return;
      if (e.key === 'n') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('tripdesk:new-trip'));
      } else if (e.key === '/') {
        e.preventDefault();
        document.getElementById('trip-search')?.focus();
      } else if (/^[1-6]$/.test(e.key)) {
        const m = pathname.match(/^\/trips\/(\d+)/);
        if (m) navigate(`/trips/${m[1]}/${TAB_IDS[Number(e.key) - 1]}`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, pathname]);
}
