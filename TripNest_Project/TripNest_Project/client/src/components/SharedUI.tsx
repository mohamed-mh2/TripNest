// التخطيط والتنقل وتبديل اللغة ومكونات النماذج والحوار وحالات التحميل والفراغ والخطأ؛ تفصل المكونات عند التنفيذ. المسؤول: mohamed fody.

import '../pages/HelpCenter.css';

import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactElement,
  type ReactNode,
} from 'react';

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

export function TripNestHeader({
  title,
  subtitle,
  actions,
}: Omit<PageShellProps, 'children'>) {
  return (
    <header className="tn-header">
      <div className="tn-header-copy">
        <p className="tn-eyebrow">TRIPNEST · YOUR TRAVEL COMPANION</p>
        <h1 className="tn-title">{title}</h1>
        {subtitle && <p className="tn-subtitle">{subtitle}</p>}
      </div>
      <div className="tn-header-actions">{actions}</div>
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
  'aria-describedby'?: string;
};

export function FormField({ id, label, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId]
    .filter((value): value is string => Boolean(value))
    .join(' ');
  const control = isValidElement<ControlProps>(children)
    ? cloneElement(children as ReactElement<ControlProps>, {
        id: children.props.id ?? id,
        'aria-describedby': describedBy || undefined,
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      if (dialog.open) dialog.close();
    };
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      className="tn-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        closeRef.current();
      }}
    >
      <div className="tn-row">
        <h2 id={titleId}>{title}</h2>
        <button className="tn-button-secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}
