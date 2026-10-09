// طلبات المساعدة ومعالجتها من المسؤول وتصدير ملخص الرحلة. المسؤول: mohamed fody.

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useDispatch, useSelector } from "react-redux";

import {
  EmptyState,
  ErrorState,
  FormField,
  LoadingState,
  Modal,
  PageShell,
  StatusBadge,
} from "../components/SharedUI";
import {
  createAlternative,
  createTicket,
  decideAlternative,
  exportTripSummary,
  loadAdminTicket,
  loadAdminTickets,
  loadAlternative,
  loadTicketDetails,
  loadTravelerTickets,
  selectSupport,
  updateAdminStatus,
  type AdminStatusFilter,
  type SupportAlternative,
  type SupportTicket,
  type SupportTicketCategory,
  type SupportTicketStatus,
  type SupportThunkDispatch,
} from "../store/supportSlice";

const DEVELOPMENT_TRIP_ID = "11111111-1111-4111-8111-111111111111";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CATEGORIES: SupportTicketCategory[] = [
  "transport",
  "accommodation",
  "booking",
  "esim",
  "activity",
  "other",
];

const FILTERS: AdminStatusFilter[] = ["all", "open", "in_progress", "resolved", "closed"];

type SupportView =
  | "traveler-list"
  | "traveler-create"
  | "traveler-detail"
  | "admin-list"
  | "admin-detail";

function categoryLabel(category: SupportTicketCategory): string {
  switch (category) {
    case "transport":
      return "Transport";
    case "accommodation":
      return "Accommodation";
    case "booking":
      return "Booking";
    case "esim":
      return "eSIM";
    case "activity":
      return "Activity";
    case "other":
      return "Other";
    default: {
      const unreachable: never = category;
      return unreachable;
    }
  }
}

function statusLabel(status: SupportTicketStatus): string {
  switch (status) {
    case "open":
      return "Open";
    case "in_progress":
      return "In progress";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function alternativeLabel(status: SupportAlternative["status"]): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

function filterLabel(filter: AdminStatusFilter): string {
  if (filter === "all") {
    return "All";
  }
  return statusLabel(filter);
}

function formatWhen(value: string | null): string {
  if (!value) {
    return "Not specified";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatPrice(minor: number | null, currency: string): string {
  if (minor === null) {
    return "Not specified";
  }
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

function priceDifference(alternative: SupportAlternative): string {
  if (alternative.originalPriceMinor === null || alternative.alternativePriceMinor === null) {
    return "Not calculable";
  }
  const difference = alternative.alternativePriceMinor - alternative.originalPriceMinor;
  const sign = difference > 0 ? "+" : "";
  return `${sign}${(difference / 100).toFixed(2)} ${alternative.currency}`;
}

function timeDifference(alternative: SupportAlternative): string {
  if (!alternative.originalStartAt || !alternative.alternativeStartAt) {
    return "Not calculable";
  }
  const minutes = Math.round(
    (new Date(alternative.alternativeStartAt).getTime() - new Date(alternative.originalStartAt).getTime()) / 60000,
  );
  if (minutes === 0) {
    return "Same start time";
  }
  const direction = minutes > 0 ? "later" : "earlier";
  const absolute = Math.abs(minutes);
  if (absolute % 60 === 0) {
    const hours = absolute / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} ${direction}`;
  }
  return `${absolute} minutes ${direction}`;
}

function toIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function toMinor(value: string): number | null | undefined {
  if (!value.trim()) {
    return null;
  }
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return undefined;
  }
  return Math.round(amount * 100);
}

function TicketSummary({ ticket, onOpen }: { ticket: SupportTicket; onOpen: (ticketId: string) => void }) {
  return (
    <li>
      <button className="tn-ticket" type="button" onClick={() => onOpen(ticket.id)}>
        <span className="tn-ticket-top">
          <span className="tn-ticket-title">{categoryLabel(ticket.category)}</span>
          <StatusBadge status={ticket.status} label={statusLabel(ticket.status)} />
        </span>
        <span className="tn-ticket-message">{ticket.message}</span>
        <span className="tn-meta">Updated {formatWhen(ticket.updatedAt)}</span>
      </button>
    </li>
  );
}

function AlternativeComparison({ alternative }: { alternative: SupportAlternative }) {
  return (
    <>
      <div className="tn-row">
        <h3>Alternative proposal</h3>
        <StatusBadge status={alternative.status} label={alternativeLabel(alternative.status)} />
      </div>
      <div className="tn-compare">
        <div>
          <h3>Original</h3>
          <p>{alternative.originalTitle}</p>
          <p className="tn-meta">Start: {formatWhen(alternative.originalStartAt)}</p>
          <p className="tn-meta">End: {formatWhen(alternative.originalEndAt)}</p>
          <p className="tn-meta">{formatPrice(alternative.originalPriceMinor, alternative.currency)}</p>
        </div>
        <div>
          <h3>Proposed alternative</h3>
          <p>{alternative.alternativeTitle}</p>
          <p className="tn-meta">Start: {formatWhen(alternative.alternativeStartAt)}</p>
          <p className="tn-meta">End: {formatWhen(alternative.alternativeEndAt)}</p>
          <p className="tn-meta">{formatPrice(alternative.alternativePriceMinor, alternative.currency)}</p>
        </div>
      </div>
      <p className="tn-meta">Price difference: {priceDifference(alternative)}</p>
      <p className="tn-meta">Time difference: {timeDifference(alternative)}</p>
    </>
  );
}

export default function Support() {
  const dispatch = useDispatch<SupportThunkDispatch>();
  const support = useSelector(selectSupport);
  const [view, setView] = useState<SupportView>("traveler-list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tripId, setTripId] = useState(DEVELOPMENT_TRIP_ID);
  const [category, setCategory] = useState<SupportTicketCategory>("transport");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [originalTitle, setOriginalTitle] = useState("");
  const [originalStart, setOriginalStart] = useState("");
  const [originalEnd, setOriginalEnd] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [alternativeTitle, setAlternativeTitle] = useState("");
  const [alternativeStart, setAlternativeStart] = useState("");
  const [alternativeEnd, setAlternativeEnd] = useState("");
  const [alternativePrice, setAlternativePrice] = useState("");

  useEffect(() => {
    if (view === "traveler-list") {
      void dispatch(loadTravelerTickets());
    }
    if (view === "admin-list") {
      void dispatch(loadAdminTickets(support.admin.statusFilter));
    }
  }, [dispatch, view, support.admin.statusFilter]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    if (view === "traveler-detail") {
      void dispatch(loadTicketDetails(selectedId));
      void dispatch(loadAlternative({ ticketId: selectedId, scope: "traveler" }));
    }
    if (view === "admin-detail") {
      void dispatch(loadAdminTicket(selectedId));
      void dispatch(loadAlternative({ ticketId: selectedId, scope: "admin" }));
    }
  }, [dispatch, selectedId, view]);

  function openTraveler(ticketId: string) {
    setSelectedId(ticketId);
    setView("traveler-detail");
  }

  function openAdmin(ticketId: string) {
    setSelectedId(ticketId);
    setResolveOpen(false);
    setShowProposal(false);
    setView("admin-detail");
  }

  function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!UUID_PATTERN.test(tripId)) {
      setFormError("Enter a valid trip id.");
      return;
    }
    if (trimmed.length < 10 || trimmed.length > 2000) {
      setFormError("Message must be between 10 and 2000 characters.");
      return;
    }
    setFormError(null);
    void dispatch(createTicket({ tripId, category, message: trimmed })).then((result) => {
      if (createTicket.fulfilled.match(result)) {
        setMessage("");
        setSelectedId(result.payload.id);
        setView("traveler-detail");
      }
    });
  }

  function submitResolution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) {
      return;
    }
    if (resolutionNote.trim().length < 10) {
      setFormError("A resolution note must be at least 10 characters.");
      return;
    }
    setFormError(null);
    void dispatch(
      updateAdminStatus({ ticketId: selectedId, status: "resolved", resolutionNote: resolutionNote.trim() }),
    ).then((result) => {
      if (updateAdminStatus.fulfilled.match(result)) {
        setResolutionNote("");
        setResolveOpen(false);
      }
    });
  }

  function submitProposal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) {
      return;
    }
    const originalPriceMinor = toMinor(originalPrice);
    const alternativePriceMinor = toMinor(alternativePrice);
    if (originalPriceMinor === undefined || alternativePriceMinor === undefined) {
      setFormError("Enter prices as positive amounts, or leave them blank.");
      return;
    }
    if (originalTitle.trim().length < 1 || alternativeTitle.trim().length < 1) {
      setFormError("Enter both titles.");
      return;
    }
    setFormError(null);
    void dispatch(
      createAlternative({
        ticketId: selectedId,
        originalTitle: originalTitle.trim(),
        originalStartAt: toIso(originalStart),
        originalEndAt: toIso(originalEnd),
        originalPriceMinor,
        alternativeTitle: alternativeTitle.trim(),
        alternativeStartAt: toIso(alternativeStart),
        alternativeEndAt: toIso(alternativeEnd),
        alternativePriceMinor,
      }),
    ).then((result) => {
      if (createAlternative.fulfilled.match(result)) {
        setShowProposal(false);
      }
    });
  }

  const travelerTicket = support.traveler.selectedTicket;
  const adminTicket = support.admin.selectedTicket;
  const alternative = support.alternative.current;
  const canPropose = adminTicket?.status === "in_progress" && alternative?.status !== "pending";

  let screen: ReactNode;
  switch (view) {
    case "traveler-list":
      screen = (
        <section className="tn-card" aria-labelledby="traveler-list-heading">
          <div className="tn-row">
            <h2 id="traveler-list-heading">Your requests</h2>
            <button className="tn-button" type="button" onClick={() => setView("traveler-create")}>
              New request
            </button>
          </div>
          {support.traveler.loading ? <LoadingState label="Loading support requests" /> : null}
          {!support.traveler.loading && support.traveler.error ? (
            <ErrorState title="Support requests could not be loaded." message={support.traveler.error} onRetry={() => void dispatch(loadTravelerTickets())} />
          ) : null}
          {!support.traveler.loading && !support.traveler.error && support.traveler.tickets.length === 0 ? (
            <EmptyState title="No support requests" message="Create a request when a booking needs help." />
          ) : null}
          {support.traveler.tickets.length > 0 ? (
            <ul className="tn-list">
              {support.traveler.tickets.map((ticket) => (
                <TicketSummary key={ticket.id} ticket={ticket} onOpen={openTraveler} />
              ))}
            </ul>
          ) : null}
        </section>
      );
      break;
    case "traveler-create":
      screen = (
        <section className="tn-card">
          <h2>Create support request</h2>
          <form className="tn-form" onSubmit={submitTicket} noValidate>
            <FormField id="ticket-trip" label="Trip" error={null}>
              <input id="ticket-trip" className="tn-input" value={tripId} onChange={(event) => setTripId(event.target.value.trim())} />
            </FormField>
            <FormField id="ticket-category" label="Category">
              <select
                id="ticket-category"
                className="tn-select"
                value={category}
                onChange={(event) => {
                  const next = CATEGORIES.find((item) => item === event.target.value);
                  if (next) {
                    setCategory(next);
                  }
                }}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {categoryLabel(item)}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="ticket-message" label="Message" hint="At least 10 characters." error={formError}>
              <textarea
                id="ticket-message"
                className="tn-textarea"
                maxLength={2000}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
            </FormField>
            <div className="tn-inline-actions">
              <button className="tn-button" type="submit" disabled={support.traveler.saving}>
                {support.traveler.saving ? "Sending" : "Send request"}
              </button>
              <button className="tn-button-secondary" type="button" onClick={() => setView("traveler-list")}>
                Back
              </button>
            </div>
          </form>
        </section>
      );
      break;
    case "traveler-detail":
      screen = (
        <section className="tn-card">
          <button className="tn-button-secondary" type="button" onClick={() => setView("traveler-list")}>
            Back to requests
          </button>
          {support.traveler.loading ? <LoadingState label="Loading ticket" /> : null}
          {!support.traveler.loading && support.traveler.error ? (
            <ErrorState title="This ticket could not be loaded." message={support.traveler.error} onRetry={() => selectedId && void dispatch(loadTicketDetails(selectedId))} />
          ) : null}
          {travelerTicket ? (
            <>
              <div className="tn-ticket-top">
                <h2>{categoryLabel(travelerTicket.category)}</h2>
                <StatusBadge status={travelerTicket.status} label={statusLabel(travelerTicket.status)} />
              </div>
              <p className="tn-meta">Request ref {travelerTicket.id}</p>
              <p>{travelerTicket.message}</p>
              {travelerTicket.resolutionNote ? (
                <>
                  <h3>Resolution note</h3>
                  <p>{travelerTicket.resolutionNote}</p>
                </>
              ) : null}
            </>
          ) : null}
          <AlternativePanel
            mode="traveler"
            alternative={alternative}
            loading={support.alternative.loading}
            saving={support.alternative.saving}
            error={support.alternative.error}
            approvalRecorded={support.alternative.replacementExecutionRequired}
            onAccept={() => selectedId && void dispatch(decideAlternative({ ticketId: selectedId, decision: "accepted" }))}
            onReject={() => selectedId && void dispatch(decideAlternative({ ticketId: selectedId, decision: "rejected" }))}
          />
        </section>
      );
      break;
    case "admin-list":
      screen = (
        <section className="tn-card" aria-labelledby="admin-list-heading">
          <h2 id="admin-list-heading">Admin queue</h2>
          <div className="tn-inline-actions" role="group" aria-label="Filter by status">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                className={support.admin.statusFilter === filter ? "tn-button" : "tn-button-secondary"}
                type="button"
                aria-pressed={support.admin.statusFilter === filter}
                onClick={() => void dispatch(loadAdminTickets(filter))}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>
          {support.admin.loading ? <LoadingState label="Loading admin tickets" /> : null}
          {!support.admin.loading && support.admin.error ? (
            <ErrorState title="Admin tickets could not be loaded." message={support.admin.error} onRetry={() => void dispatch(loadAdminTickets(support.admin.statusFilter))} />
          ) : null}
          {!support.admin.loading && !support.admin.error && support.admin.tickets.length === 0 ? (
            <EmptyState title="No tickets in this filter" message="New traveler requests appear here after they are created." />
          ) : null}
          {support.admin.tickets.length > 0 ? (
            <ul className="tn-list">
              {support.admin.tickets.map((ticket) => (
                <TicketSummary key={ticket.id} ticket={ticket} onOpen={openAdmin} />
              ))}
            </ul>
          ) : null}
        </section>
      );
      break;
    case "admin-detail":
      screen = (
        <section className="tn-card">
          <button className="tn-button-secondary" type="button" onClick={() => setView("admin-list")}>
            Back to admin tickets
          </button>
          {support.admin.loading ? <LoadingState label="Loading ticket" /> : null}
          {!support.admin.loading && support.admin.error ? (
            <ErrorState title="This ticket could not be loaded." message={support.admin.error} onRetry={() => selectedId && void dispatch(loadAdminTicket(selectedId))} />
          ) : null}
          {adminTicket ? (
            <>
              <div className="tn-ticket-top">
                <h2>{categoryLabel(adminTicket.category)}</h2>
                <StatusBadge status={adminTicket.status} label={statusLabel(adminTicket.status)} />
              </div>
              <p className="tn-meta">Request ref {adminTicket.id}</p>
              <p>{adminTicket.message}</p>
              {adminTicket.resolutionNote ? (
                <>
                  <h3>Resolution note</h3>
                  <p>{adminTicket.resolutionNote}</p>
                </>
              ) : null}
              {formError ? <p className="tn-field-error" role="alert">{formError}</p> : null}
              <div className="tn-inline-actions">
                {adminTicket.status === "open" ? (
                  <>
                    <button className="tn-button" type="button" disabled={support.admin.saving} onClick={() => void dispatch(updateAdminStatus({ ticketId: adminTicket.id, status: "in_progress" }))}>
                      Start progress
                    </button>
                    <button className="tn-button-secondary" type="button" disabled={support.admin.saving} onClick={() => void dispatch(updateAdminStatus({ ticketId: adminTicket.id, status: "closed" }))}>
                      Close
                    </button>
                  </>
                ) : null}
                {adminTicket.status === "in_progress" ? (
                  <>
                    <button className="tn-button" type="button" disabled={support.admin.saving} onClick={() => setResolveOpen(true)}>
                      Resolve
                    </button>
                    <button className="tn-button-secondary" type="button" disabled={support.admin.saving} onClick={() => void dispatch(updateAdminStatus({ ticketId: adminTicket.id, status: "closed" }))}>
                      Close
                    </button>
                  </>
                ) : null}
                {adminTicket.status === "resolved" ? (
                  <button className="tn-button" type="button" disabled={support.admin.saving} onClick={() => void dispatch(updateAdminStatus({ ticketId: adminTicket.id, status: "closed" }))}>
                    Close
                  </button>
                ) : null}
                {adminTicket.status === "closed" ? <p className="tn-muted">This ticket is closed.</p> : null}
              </div>
              <Modal title="Resolution note" open={resolveOpen} onClose={() => setResolveOpen(false)}>
                <form className="tn-form" onSubmit={submitResolution}>
                  <FormField id="resolution-note" label="Resolution note" hint="At least 10 characters." error={formError}>
                    <textarea id="resolution-note" className="tn-textarea" value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} />
                  </FormField>
                  <button className="tn-button" type="submit" disabled={support.admin.saving}>
                    {support.admin.saving ? "Saving" : "Save resolution"}
                  </button>
                </form>
              </Modal>
            </>
          ) : null}
          <AlternativePanel
            mode="admin"
            alternative={alternative}
            loading={support.alternative.loading}
            saving={support.alternative.saving}
            error={support.alternative.error}
            approvalRecorded={false}
            canPropose={canPropose}
            showProposal={showProposal}
            onShowProposal={() => setShowProposal(true)}
            onSubmitProposal={submitProposal}
            originalTitle={originalTitle}
            originalStart={originalStart}
            originalEnd={originalEnd}
            originalPrice={originalPrice}
            alternativeTitle={alternativeTitle}
            alternativeStart={alternativeStart}
            alternativeEnd={alternativeEnd}
            alternativePrice={alternativePrice}
            onOriginalTitle={setOriginalTitle}
            onOriginalStart={setOriginalStart}
            onOriginalEnd={setOriginalEnd}
            onOriginalPrice={setOriginalPrice}
            onAlternativeTitle={setAlternativeTitle}
            onAlternativeStart={setAlternativeStart}
            onAlternativeEnd={setAlternativeEnd}
            onAlternativePrice={setAlternativePrice}
            formError={formError}
          />
        </section>
      );
      break;
    default: {
      const unreachable: never = view;
      screen = unreachable;
    }
  }

  return (
    <PageShell
      title="Support"
      subtitle="Traveler requests, admin workflow, and trip summary export."
      actions={
        <>
          <button className="tn-button-secondary" type="button" aria-pressed={view.startsWith("traveler")} onClick={() => setView("traveler-list")}>
            Traveler
          </button>
          <button className="tn-button-secondary" type="button" aria-pressed={view.startsWith("admin")} onClick={() => setView("admin-list")}>
            Admin
          </button>
          <button
            className="tn-button"
            type="button"
            disabled={support.summaryExport.loading || !UUID_PATTERN.test(tripId)}
            onClick={() => void dispatch(exportTripSummary(tripId))}
          >
            {support.summaryExport.loading ? "Preparing summary" : "Download trip summary"}
          </button>
        </>
      }
    >
      <p className="tn-banner" role="note">
        Traveler and Admin switch the screen only. The server still requires the auth middleware before it will accept a request.
      </p>
      {support.summaryExport.error ? <p className="tn-field-error" role="alert">{support.summaryExport.error}</p> : null}
      {screen}
    </PageShell>
  );
}

function AlternativePanel(props: {
  mode: "traveler" | "admin";
  alternative: SupportAlternative | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  approvalRecorded: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  canPropose?: boolean;
  showProposal?: boolean;
  onShowProposal?: () => void;
  onSubmitProposal?: (event: FormEvent<HTMLFormElement>) => void;
  originalTitle?: string;
  originalStart?: string;
  originalEnd?: string;
  originalPrice?: string;
  alternativeTitle?: string;
  alternativeStart?: string;
  alternativeEnd?: string;
  alternativePrice?: string;
  onOriginalTitle?: (value: string) => void;
  onOriginalStart?: (value: string) => void;
  onOriginalEnd?: (value: string) => void;
  onOriginalPrice?: (value: string) => void;
  onAlternativeTitle?: (value: string) => void;
  onAlternativeStart?: (value: string) => void;
  onAlternativeEnd?: (value: string) => void;
  onAlternativePrice?: (value: string) => void;
  formError?: string | null;
}) {
  return (
    <section className="tn-card" aria-labelledby="alternative-heading">
      <h2 id="alternative-heading">Alternative proposal</h2>
      {props.loading ? <LoadingState label="Loading alternative" /> : null}
      {props.error ? <p className="tn-field-error" role="alert">{props.error}</p> : null}
      {props.alternative ? <AlternativeComparison alternative={props.alternative} /> : null}
      {!props.loading && !props.alternative ? (
        <p className="tn-muted">No alternative has been proposed yet.</p>
      ) : null}
      {props.mode === "traveler" && (props.approvalRecorded || props.alternative?.status === "accepted") ? (
        <p>Your approval has been recorded. The booking replacement has not been executed yet.</p>
      ) : null}
      {props.alternative?.status === "rejected" ? <p>This alternative was rejected. No booking was changed.</p> : null}
      {props.mode === "traveler" && props.alternative?.status === "pending" ? (
        <div className="tn-inline-actions">
          <button className="tn-button" type="button" disabled={props.saving} onClick={props.onAccept}>
            {props.saving ? "Saving" : "Accept alternative"}
          </button>
          <button className="tn-button-secondary" type="button" disabled={props.saving} onClick={props.onReject}>
            Reject alternative
          </button>
        </div>
      ) : null}
      {props.canPropose && !props.showProposal ? (
        <button className="tn-button" type="button" onClick={props.onShowProposal}>
          Propose alternative
        </button>
      ) : null}
      {props.showProposal ? (
        <form className="tn-form" onSubmit={props.onSubmitProposal}>
          <FormField id="original-title" label="Original title" error={props.formError}>
            <input id="original-title" className="tn-input" value={props.originalTitle ?? ""} onChange={(event) => props.onOriginalTitle?.(event.target.value)} required />
          </FormField>
          <FormField id="original-start" label="Original start">
            <input id="original-start" className="tn-input" type="datetime-local" value={props.originalStart ?? ""} onChange={(event) => props.onOriginalStart?.(event.target.value)} />
          </FormField>
          <FormField id="original-end" label="Original end">
            <input id="original-end" className="tn-input" type="datetime-local" value={props.originalEnd ?? ""} onChange={(event) => props.onOriginalEnd?.(event.target.value)} />
          </FormField>
          <FormField id="original-price" label="Original price (EUR)" hint="Optional. Sent to the server as minor units.">
            <input id="original-price" className="tn-input" inputMode="decimal" value={props.originalPrice ?? ""} onChange={(event) => props.onOriginalPrice?.(event.target.value)} />
          </FormField>
          <FormField id="alternative-title" label="Alternative title">
            <input id="alternative-title" className="tn-input" value={props.alternativeTitle ?? ""} onChange={(event) => props.onAlternativeTitle?.(event.target.value)} required />
          </FormField>
          <FormField id="alternative-start" label="Alternative start">
            <input id="alternative-start" className="tn-input" type="datetime-local" value={props.alternativeStart ?? ""} onChange={(event) => props.onAlternativeStart?.(event.target.value)} />
          </FormField>
          <FormField id="alternative-end" label="Alternative end">
            <input id="alternative-end" className="tn-input" type="datetime-local" value={props.alternativeEnd ?? ""} onChange={(event) => props.onAlternativeEnd?.(event.target.value)} />
          </FormField>
          <FormField id="alternative-price" label="Alternative price (EUR)" hint="Optional. Sent to the server as minor units.">
            <input id="alternative-price" className="tn-input" inputMode="decimal" value={props.alternativePrice ?? ""} onChange={(event) => props.onAlternativePrice?.(event.target.value)} />
          </FormField>
          <button className="tn-button" type="submit" disabled={props.saving}>
            {props.saving ? "Sending" : "Send proposal"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
