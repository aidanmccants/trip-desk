// Signed-out landing page. Sign-in is a plain link to the Worker's /auth/login, which redirects
// to Tripsy's own sign-in page. Nothing here collects credentials.
import { AlertCircle, CalendarDays, FileText, LogIn, Wallet, type LucideIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: CalendarDays, title: 'Itinerary', body: 'Flights, lodgings and activities on one timeline.' },
  { icon: Wallet, title: 'Expenses', body: 'Log costs and see what the trip adds up to.' },
  { icon: FileText, title: 'Documents', body: 'Attach tickets and confirmations to the right item.' },
];

// Dark travel-style backdrop with an orange glow at the top. Fixed colors: this page does not
// follow the light/dark surface tokens.
const BACKDROP =
  'radial-gradient(70% 50% at 50% 0%, rgba(255, 122, 26, 0.35), rgba(255, 122, 26, 0) 70%), ' +
  'linear-gradient(180deg, #1b1530 0%, #0b0b12 100%)';

export function Landing() {
  const [params] = useSearchParams();
  const failed = params.has('auth_error');

  return (
    <div
      className="flex min-h-full flex-col items-center justify-center px-6 py-12 text-white"
      style={{ background: BACKDROP }}
    >
      <div className="w-full max-w-md text-center">
        <img src="/favicon.svg" alt="" className="mx-auto h-20 w-20 rounded-[22px] shadow-2xl" />
        <h1 className="mt-6 text-large-title sm:text-5xl">Trip Desk</h1>
        <p className="mt-3 text-callout text-white/70">Plan and edit your Tripsy trips from any computer.</p>

        <ul className="mt-8 divide-y divide-white/10 rounded-card bg-white/5 text-left ring-1 ring-white/10">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-badge bg-accent/20 text-accent">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-callout font-semibold">{title}</span>
                <span className="block text-footnote text-white/60">{body}</span>
              </span>
            </li>
          ))}
        </ul>

        {failed && (
          <div role="alert" className="mt-6 flex items-start gap-2 rounded-2xl bg-danger/20 px-4 py-3 text-left text-subhead text-white">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <span>Sign-in didn't complete. Try again.</span>
          </div>
        )}

        <a
          href="/auth/login"
          className="mt-8 inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-accent px-6 text-headline font-semibold text-white shadow-lg transition hover:brightness-110"
        >
          <LogIn className="h-5 w-5" />
          Sign in with Tripsy
        </a>

        <p className="mt-6 text-footnote text-white/50">
          You sign in on Tripsy's own page. Trip Desk never sees your password. Not affiliated with Tripsy.
        </p>
      </div>
    </div>
  );
}
