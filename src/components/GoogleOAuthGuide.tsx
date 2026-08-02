import React, { useState } from 'react';
import { BookOpen, Check, ChevronDown, Copy, ExternalLink } from 'lucide-react';

interface GoogleOAuthGuideProps {
  redirectUri: string;
}

export const GoogleOAuthGuide: React.FC<GoogleOAuthGuideProps> = ({ redirectUri }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyRedirect = async () => {
    try {
      await navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const steps: { title: string; body: React.ReactNode }[] = [
    {
      title: 'Ouvre Google Cloud Console',
      body: (
        <a
          href="https://console.cloud.google.com/apis/credentials"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-accent-text underline underline-offset-2"
        >
          console.cloud.google.com/apis/credentials
          <ExternalLink className="w-3 h-3" />
        </a>
      ),
    },
    {
      title: 'Crée ou choisis un projet',
      body: 'En haut à gauche, sélectionne un projet (ou « New Project »).',
    },
    {
      title: 'Active l’API Google Drive',
      body: (
        <>
          Menu <strong>APIs & Services → Library</strong>, cherche « Google Drive API »,
          puis <strong>Enable</strong>.
        </>
      ),
    },
    {
      title: 'Écran de consentement OAuth',
      body: (
        <>
          <strong>APIs & Services → OAuth consent screen</strong> : type External (ou
          Internal si Workspace), renseigne le nom de l’app (ex. Cobea), ton email, puis
          sauvegarde. En mode test, ajoute ton compte Google dans « Test users ».
        </>
      ),
    },
    {
      title: 'Crée un Client ID OAuth',
      body: (
        <>
          <strong>Credentials → Create credentials → OAuth client ID</strong>. Type
          d’application : <strong>Web application</strong>.
        </>
      ),
    },
    {
      title: 'Ajoute l’URI de redirection',
      body: (
        <div className="space-y-2">
          <p>
            Dans « Authorized redirect URIs », ajoute exactement cette URL
            (copier-coller) :
          </p>
          <div className="flex items-stretch gap-1.5">
            <code className="flex-1 text-[10px] leading-relaxed break-all rounded-lg bg-zinc-100 dark:bg-zinc-950 px-2 py-1.5 text-zinc-800 dark:text-zinc-200">
              {redirectUri}
            </code>
            <button
              type="button"
              onClick={() => void copyRedirect()}
              className="shrink-0 px-2 rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5"
              title="Copier"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      ),
    },
    {
      title: 'Récupère Client ID et Secret',
      body: (
        <>
          Après création, copie le <strong>Client ID</strong> et le{' '}
          <strong>Client secret</strong>, puis colle-les ci-dessous.
        </>
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-950/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100/80 dark:hover:bg-white/5"
      >
        <BookOpen className="w-4 h-4 text-accent-text shrink-0" />
        <span className="flex-1">Comment obtenir Client ID & Secret</span>
        <ChevronDown
          className={`w-4 h-4 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <ol className="px-3 pb-3 space-y-3 border-t border-zinc-200/80 dark:border-white/10 pt-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex gap-2.5 text-xs text-zinc-600 dark:text-zinc-300">
              <span className="shrink-0 w-5 h-5 rounded-full bg-accent/15 text-accent-text flex items-center justify-center text-[10px] font-semibold">
                {i + 1}
              </span>
              <div className="min-w-0 space-y-1 pt-0.5">
                <p className="font-medium text-zinc-800 dark:text-zinc-100">{step.title}</p>
                <div className="leading-relaxed">{step.body}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
