// التخطيط والتنقل وتبديل اللغة ومكونات النماذج والحوار وحالات التحميل والفراغ والخطأ؛ تفصل المكونات عند التنفيذ. المسؤول: mohamed fody.

import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";

type HeaderAction = ReactNode;

type PageShellProps = {
  title: string;
  subtitle?: string;
  actions?: HeaderAction;
  children: ReactNode;
};

type StateProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

type FormFieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
};

type ModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

type ProgressProps = {
  label: string;
  completed: number;
  total: number;
  percentage: number;
};

function clampPercentage(percentage: number): number {
  if (!Number.isFinite(percentage)) {
    return 0;
  }
  return Math.min(100, Math.max(0, percentage));
}

export function TripNestLogo() {
  return (
    <span className="tn-logo">
      <svg className="tn-logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0f6e6e" />
        <path d="M7 20c6-1 8-7 18-9" fill="none" stroke="#ffffff" strokeWidth="2" />
        <path d="M21 8l5 3-5 2" fill="#ffffff" />
      </svg>
      <span className="tn-logo-word">TripNest</span>
    </span>
  );
}

export function LanguageToggle() {
  const [language, setLanguage] = useState<"en" | "ar">("en");

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  function toggleLanguage() {
    setLanguage((current) => (current === "en" ? "ar" : "en"));
  }

  return (
    <button className="tn-button-secondary" type="button" onClick={toggleLanguage}>
      {language === "en" ? "العربية" : "English"}
      <span className="tn-sr">{language === "en" ? "Switch to Arabic layout" : "Switch to English layout"}</span>
    </button>
  );
}

export function TripNestHeader({ title, subtitle, actions }: Omit<PageShellProps, "children">) {
  return (
    <header className="tn-header">
      <div className="tn-brand">
        <TripNestLogo />
        <div className="tn-header-copy">
          <h1 className="tn-title">{title}</h1>
          {subtitle ? <p className="tn-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      <div className="tn-header-actions">
        {actions}
        <LanguageToggle />
      </div>
    </header>
  );
}

export function PageShell({ title, subtitle, actions, children }: PageShellProps) {
  return (
    <main className="tn-page">
      <a className="tn-skip" href="#tn-content">
        Skip to content
      </a>
      <TripNestHeader title={title} subtitle={subtitle} actions={actions} />
      <div className="tn-content" id="tn-content">
        {children}
      </div>
    </main>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="tn-state" role="status" aria-live="polite" aria-busy="true">
      <h2>{label}</h2>
    </div>
  );
}

export function ErrorState({ title, message, onRetry }: StateProps) {
  return (
    <section className="tn-state" role="alert">
      <h2>{title}</h2>
      {message ? <p className="tn-muted">{message}</p> : null}
      {onRetry ? (
        <button className="tn-button" type="button" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </section>
  );
}

export function EmptyState({ title, message }: StateProps) {
  return (
    <section className="tn-state">
      <h2>{title}</h2>
      {message ? <p className="tn-muted">{message}</p> : null}
    </section>
  );
}

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={`tn-badge tn-badge-${status}`}>
      <span className="tn-sr">Status: </span>
      {label}
    </span>
  );
}

type ControlProps = {
  id?: string;
  "aria-describedby"?: string;
};

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter((value): value is string => Boolean(value)).join(" ");
  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id: children.props.id ?? id,
        "aria-describedby": describedBy || undefined,
      })
    : children;
  return (
    <div className="tn-field">
      <label className="tn-label" htmlFor={id}>
        {label}
      </label>
      {control}
      {hint ? (
        <p className="tn-hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="tn-field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ProgressMeter({ label, completed, total, percentage }: ProgressProps) {
  const labelId = useId();
  const width = clampPercentage(percentage);
  return (
    <div className="tn-progress">
      <div className="tn-row">
        <span id={labelId}>{label}</span>
        <span>
          {completed} of {total} complete ({width}%)
        </span>
      </div>
      <div
        className="tn-progress-track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={width}
        aria-valuetext={`${completed} of ${total} complete`}
      >
        <div className="tn-progress-value" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="tn-dialog-backdrop">
      <div
        className="tn-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tn-row">
          <h2 id={titleId}>{title}</h2>
          <button className="tn-button-secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
