// Redux Toolkit slice لإدارة الاستعداد والمساعدة وحالات الخدمات المكملة في الشاشات المشتركة. المسؤول: mohamed fody.

import {
  createAsyncThunk,
  createSlice,
  type PayloadAction,
  type ThunkDispatch,
  type UnknownAction,
} from "@reduxjs/toolkit";

/**
 * Requests live in this slice until client/src/api exports support calls.
 * Paths match server/src/routes/support.js mounted at the site root.
 * Move SUPPORT_API_BASE and supportRequest into that API module when the team connects it.
 */
const SUPPORT_API_BASE = "";

export const READINESS_ITEM_KEYS = [
  "travel_documents",
  "flight_confirmation",
  "accommodation",
  "esim",
  "local_transport",
  "emergency_information",
] as const;

export const SUPPORT_TICKET_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;

export const SUPPORT_TICKET_CATEGORIES = [
  "transport",
  "accommodation",
  "booking",
  "esim",
  "activity",
  "other",
] as const;

export const ALTERNATIVE_STATUSES = ["pending", "accepted", "rejected"] as const;

export type ReadinessItemKey = (typeof READINESS_ITEM_KEYS)[number];
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];
export type AlternativeStatus = (typeof ALTERNATIVE_STATUSES)[number];
export type AlternativeScope = "admin" | "traveler";
export type AdminStatusFilter = SupportTicketStatus | "all";

export type ReadinessItem = {
  key: ReadinessItemKey;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
};

export type ReadinessProgress = {
  completed: number;
  total: number;
  percentage: number;
};

export type SupportTicket = {
  id: string;
  tripId: string;
  ownerId: string | null;
  bookingId: string | null;
  category: SupportTicketCategory;
  message: string;
  status: SupportTicketStatus;
  resolutionNote: string | null;
  assignedAdminId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportAlternative = {
  id: string;
  ticketId: string;
  status: AlternativeStatus;
  originalTitle: string;
  originalStartAt: string | null;
  originalEndAt: string | null;
  originalPriceMinor: number | null;
  alternativeTitle: string;
  alternativeStartAt: string | null;
  alternativeEndAt: string | null;
  alternativePriceMinor: number | null;
  currency: string;
  travelerNote: string | null;
  proposedAt: string;
  decidedAt: string | null;
};

export type AlternativeProposalInput = {
  ticketId: string;
  originalTitle: string;
  originalStartAt: string | null;
  originalEndAt: string | null;
  originalPriceMinor: number | null;
  alternativeTitle: string;
  alternativeStartAt: string | null;
  alternativeEndAt: string | null;
  alternativePriceMinor: number | null;
};

export type SupportState = {
  readiness: {
    tripId: string | null;
    items: ReadinessItem[];
    progress: ReadinessProgress;
    loading: boolean;
    savingKey: ReadinessItemKey | null;
    error: string | null;
  };
  traveler: {
    tickets: SupportTicket[];
    selectedTicket: SupportTicket | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
  };
  admin: {
    tickets: SupportTicket[];
    selectedTicket: SupportTicket | null;
    statusFilter: AdminStatusFilter;
    loading: boolean;
    saving: boolean;
    error: string | null;
  };
  alternative: {
    current: SupportAlternative | null;
    replacementExecutionRequired: boolean;
    loading: boolean;
    saving: boolean;
    error: string | null;
  };
  summaryExport: {
    loading: boolean;
    error: string | null;
  };
};

type StateWithSupport = {
  support: SupportState;
};

const emptyProgress: ReadinessProgress = { completed: 0, total: 6, percentage: 0 };

const initialState: SupportState = {
  readiness: {
    tripId: null,
    items: [],
    progress: emptyProgress,
    loading: false,
    savingKey: null,
    error: null,
  },
  traveler: {
    tickets: [],
    selectedTicket: null,
    loading: false,
    saving: false,
    error: null,
  },
  admin: {
    tickets: [],
    selectedTicket: null,
    statusFilter: "all",
    loading: false,
    saving: false,
    error: null,
  },
  alternative: {
    current: null,
    replacementExecutionRequired: false,
    loading: false,
    saving: false,
    error: null,
  },
  summaryExport: {
    loading: false,
    error: null,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReadinessKey(value: unknown): value is ReadinessItemKey {
  return typeof value === "string" && READINESS_ITEM_KEYS.some((key) => key === value);
}

function isTicketStatus(value: unknown): value is SupportTicketStatus {
  return typeof value === "string" && SUPPORT_TICKET_STATUSES.some((status) => status === value);
}

function isTicketCategory(value: unknown): value is SupportTicketCategory {
  return typeof value === "string" && SUPPORT_TICKET_CATEGORIES.some((category) => category === value);
}

function isAlternativeStatus(value: unknown): value is AlternativeStatus {
  return typeof value === "string" && ALTERNATIVE_STATUSES.some((status) => status === value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNullableString(value: unknown): string | null {
  return typeof value === "string" || value === null ? value : null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.error) && typeof body.error.message === "string") {
      return body.error.message;
    }
  } catch {
    return "The request failed.";
  }
  return "The request failed.";
}

async function supportResponse(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${SUPPORT_API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error("The support service could not be reached.");
  }
}

function parseProgress(value: unknown): ReadinessProgress | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.completed !== "number" ||
    typeof value.total !== "number" ||
    typeof value.percentage !== "number"
  ) {
    return null;
  }
  return {
    completed: value.completed,
    total: value.total,
    percentage: value.percentage,
  };
}

function parseReadinessItem(value: unknown): ReadinessItem | null {
  if (!isRecord(value) || !isReadinessKey(value.key) || typeof value.title !== "string") {
    return null;
  }
  if (typeof value.description !== "string" || typeof value.completed !== "boolean") {
    return null;
  }
  if (typeof value.completedAt !== "string" && value.completedAt !== null) {
    return null;
  }
  return {
    key: value.key,
    title: value.title,
    description: value.description,
    completed: value.completed,
    completedAt: value.completedAt,
  };
}

function parseReadinessPayload(body: unknown): { items: ReadinessItem[]; progress: ReadinessProgress } | null {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.items)) {
    return null;
  }
  const items: ReadinessItem[] = [];
  for (const item of body.data.items) {
    const parsed = parseReadinessItem(item);
    if (!parsed) {
      return null;
    }
    items.push(parsed);
  }
  const progress = parseProgress(body.data.progress);
  if (!progress || items.length !== READINESS_ITEM_KEYS.length) {
    return null;
  }
  return { items, progress };
}

function parseTicket(value: unknown): SupportTicket | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.tripId !== "string") {
    return null;
  }
  if (!isTicketCategory(value.category) || !isTicketStatus(value.status) || typeof value.message !== "string") {
    return null;
  }
  const createdAt = readString(value.createdAt);
  const updatedAt = readString(value.updatedAt);
  if (!createdAt || !updatedAt) {
    return null;
  }
  return {
    id: value.id,
    tripId: value.tripId,
    ownerId: readNullableString(value.ownerId),
    bookingId: readNullableString(value.bookingId),
    category: value.category,
    message: value.message,
    status: value.status,
    resolutionNote: readNullableString(value.resolutionNote),
    assignedAdminId: readNullableString(value.assignedAdminId),
    createdAt,
    updatedAt,
  };
}

function parseTicketPayload(body: unknown): SupportTicket | null {
  if (!isRecord(body) || !isRecord(body.data)) {
    return null;
  }
  return parseTicket(body.data.ticket);
}

function parseTicketList(body: unknown): SupportTicket[] | null {
  if (!isRecord(body) || !isRecord(body.data) || !Array.isArray(body.data.tickets)) {
    return null;
  }
  const tickets: SupportTicket[] = [];
  for (const ticket of body.data.tickets) {
    const parsed = parseTicket(ticket);
    if (!parsed) {
      return null;
    }
    tickets.push(parsed);
  }
  return tickets;
}

function parseAlternative(value: unknown): SupportAlternative | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.ticketId !== "string") {
    return null;
  }
  if (!isAlternativeStatus(value.status) || typeof value.originalTitle !== "string") {
    return null;
  }
  if (typeof value.alternativeTitle !== "string" || typeof value.currency !== "string") {
    return null;
  }
  const proposedAt = readString(value.proposedAt);
  if (!proposedAt) {
    return null;
  }
  return {
    id: value.id,
    ticketId: value.ticketId,
    status: value.status,
    originalTitle: value.originalTitle,
    originalStartAt: readNullableString(value.originalStartAt),
    originalEndAt: readNullableString(value.originalEndAt),
    originalPriceMinor: typeof value.originalPriceMinor === "number" ? value.originalPriceMinor : null,
    alternativeTitle: value.alternativeTitle,
    alternativeStartAt: readNullableString(value.alternativeStartAt),
    alternativeEndAt: readNullableString(value.alternativeEndAt),
    alternativePriceMinor: typeof value.alternativePriceMinor === "number" ? value.alternativePriceMinor : null,
    currency: value.currency,
    travelerNote: readNullableString(value.travelerNote),
    proposedAt,
    decidedAt: readNullableString(value.decidedAt),
  };
}

function parseAlternativePayload(body: unknown): {
  alternative: SupportAlternative | null;
  replacementExecutionRequired: boolean;
} | null {
  if (body === null) {
    return { alternative: null, replacementExecutionRequired: false };
  }
  if (!isRecord(body) || !isRecord(body.data)) {
    return null;
  }
  if (body.data.alternative === null || body.data.alternative === undefined) {
    return { alternative: null, replacementExecutionRequired: false };
  }
  const alternative = parseAlternative(body.data.alternative);
  if (!alternative) {
    return null;
  }
  return {
    alternative,
    replacementExecutionRequired: body.data.replacementExecutionRequired === true || alternative.status === "accepted",
  };
}

async function requestJson<T>(
  path: string,
  init: RequestInit | undefined,
  parse: (body: unknown) => T | null,
  emptyStatus?: number,
): Promise<T> {
  const response = await supportResponse(path, init);
  if (emptyStatus !== undefined && response.status === emptyStatus) {
    const empty = parse(null);
    if (empty === null) {
      throw new Error("The response was incomplete.");
    }
    return empty;
  }
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  const body: unknown = await response.json();
  const parsed = parse(body);
  if (parsed === null) {
    throw new Error("The response was incomplete.");
  }
  return parsed;
}

function rejectMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export const loadReadiness = createAsyncThunk<
  { tripId: string; items: ReadinessItem[]; progress: ReadinessProgress },
  string,
  { rejectValue: string }
>("support/loadReadiness", async (tripId, { rejectWithValue }) => {
  try {
    const payload = await requestJson(`/readiness/${tripId}`, undefined, parseReadinessPayload);
    return { tripId, ...payload };
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "The checklist could not be loaded."));
  }
});

export const toggleReadinessItem = createAsyncThunk<
  { items: ReadinessItem[]; progress: ReadinessProgress },
  { tripId: string; itemKey: ReadinessItemKey; completed: boolean },
  { rejectValue: string }
>("support/toggleReadinessItem", async (input, { rejectWithValue }) => {
  try {
    return await requestJson(
      `/readiness/${input.tripId}`,
      { method: "PATCH", body: JSON.stringify({ itemKey: input.itemKey, completed: input.completed }) },
      parseReadinessPayload,
    );
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "That change was not saved. Try again."));
  }
});

export const loadTravelerTickets = createAsyncThunk<SupportTicket[], undefined, { rejectValue: string }>(
  "support/loadTravelerTickets",
  async (_input, { rejectWithValue }) => {
    try {
      return await requestJson("/tickets", undefined, parseTicketList);
    } catch (error) {
      return rejectWithValue(rejectMessage(error, "Support requests could not be loaded."));
    }
  },
);

export const createTicket = createAsyncThunk<
  SupportTicket,
  { tripId: string; category: SupportTicketCategory; message: string },
  { rejectValue: string }
>("support/createTicket", async (input, { rejectWithValue }) => {
  try {
    const ticket = await requestJson("/tickets", { method: "POST", body: JSON.stringify(input) }, parseTicketPayload);
    if (!ticket) {
      throw new Error("The support request was not created.");
    }
    return ticket;
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "The support request was not created."));
  }
});

export const loadTicketDetails = createAsyncThunk<SupportTicket, string, { rejectValue: string }>(
  "support/loadTicketDetails",
  async (ticketId, { rejectWithValue }) => {
    try {
      const ticket = await requestJson(`/tickets/${ticketId}`, undefined, parseTicketPayload);
      if (!ticket) {
        throw new Error("This support request could not be loaded.");
      }
      return ticket;
    } catch (error) {
      return rejectWithValue(rejectMessage(error, "This support request could not be loaded."));
    }
  },
);

export const loadAdminTickets = createAsyncThunk<
  { tickets: SupportTicket[]; statusFilter: AdminStatusFilter },
  AdminStatusFilter,
  { rejectValue: string }
>("support/loadAdminTickets", async (statusFilter, { rejectWithValue }) => {
  try {
    const path = statusFilter === "all" ? "/admin/tickets" : `/admin/tickets?status=${statusFilter}`;
    const tickets = await requestJson(path, undefined, parseTicketList);
    return { tickets, statusFilter };
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "Admin tickets could not be loaded."));
  }
});

export const loadAdminTicket = createAsyncThunk<SupportTicket, string, { rejectValue: string }>(
  "support/loadAdminTicket",
  async (ticketId, { rejectWithValue }) => {
    try {
      const ticket = await requestJson(`/admin/tickets/${ticketId}`, undefined, parseTicketPayload);
      if (!ticket) {
        throw new Error("This ticket could not be loaded.");
      }
      return ticket;
    } catch (error) {
      return rejectWithValue(rejectMessage(error, "This ticket could not be loaded."));
    }
  },
);

export const updateAdminStatus = createAsyncThunk<
  SupportTicket,
  { ticketId: string; status: SupportTicketStatus; resolutionNote?: string },
  { rejectValue: string }
>("support/updateAdminStatus", async (input, { rejectWithValue }) => {
  try {
    const ticket = await requestJson(
      `/admin/tickets/${input.ticketId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: input.status,
          ...(input.resolutionNote ? { resolutionNote: input.resolutionNote } : {}),
        }),
      },
      parseTicketPayload,
    );
    if (!ticket) {
      throw new Error("The ticket was not updated.");
    }
    return ticket;
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "The ticket was not updated."));
  }
});

export const loadAlternative = createAsyncThunk<
  { alternative: SupportAlternative | null; replacementExecutionRequired: boolean },
  { ticketId: string; scope: AlternativeScope },
  { rejectValue: string }
>("support/loadAlternative", async (input, { rejectWithValue }) => {
  const path =
    input.scope === "admin"
      ? `/admin/tickets/${input.ticketId}/alternative`
      : `/tickets/${input.ticketId}/alternative`;
  try {
    return await requestJson(path, undefined, parseAlternativePayload, 404);
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "The alternative could not be loaded."));
  }
});

export const createAlternative = createAsyncThunk<
  SupportAlternative,
  AlternativeProposalInput,
  { rejectValue: string }
>("support/createAlternative", async (input, { rejectWithValue }) => {
  try {
    const payload = await requestJson(
      `/admin/tickets/${input.ticketId}/alternative`,
      {
        method: "POST",
        body: JSON.stringify({
          originalTitle: input.originalTitle,
          originalStartAt: input.originalStartAt,
          originalEndAt: input.originalEndAt,
          originalPriceMinor: input.originalPriceMinor,
          alternativeTitle: input.alternativeTitle,
          alternativeStartAt: input.alternativeStartAt,
          alternativeEndAt: input.alternativeEndAt,
          alternativePriceMinor: input.alternativePriceMinor,
          currency: "EUR",
        }),
      },
      parseAlternativePayload,
    );
    if (!payload.alternative) {
      throw new Error("The alternative was not proposed.");
    }
    return payload.alternative;
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "The alternative was not proposed."));
  }
});

export const decideAlternative = createAsyncThunk<
  { alternative: SupportAlternative; replacementExecutionRequired: boolean },
  { ticketId: string; decision: "accepted" | "rejected"; travelerNote?: string },
  { rejectValue: string }
>("support/decideAlternative", async (input, { rejectWithValue }) => {
  try {
    const payload = await requestJson(
      `/tickets/${input.ticketId}/alternative`,
      {
        method: "PATCH",
        body: JSON.stringify({ decision: input.decision, travelerNote: input.travelerNote }),
      },
      parseAlternativePayload,
    );
    if (!payload.alternative) {
      throw new Error("The decision was not saved.");
    }
    return { alternative: payload.alternative, replacementExecutionRequired: payload.replacementExecutionRequired };
  } catch (error) {
    return rejectWithValue(rejectMessage(error, "The decision was not saved."));
  }
});

export const exportTripSummary = createAsyncThunk<{ tripId: string }, string, { rejectValue: string }>(
  "support/exportTripSummary",
  async (tripId, { rejectWithValue }) => {
    if (typeof document === "undefined") {
      return rejectWithValue("Trip summary download runs in the browser.");
    }
    try {
      const response = await fetch(`${SUPPORT_API_BASE}/trips/${tripId}/export`, {
        credentials: "include",
        headers: { Accept: "text/html" },
      });
      if (!response.ok) {
        return rejectWithValue(await readErrorMessage(response));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "tripnest-trip-summary.html";
      anchor.click();
      URL.revokeObjectURL(url);
      return { tripId };
    } catch {
      return rejectWithValue("The trip summary could not be downloaded.");
    }
  },
);

const supportSlice = createSlice({
  name: "support",
  initialState,
  reducers: {
    clearSupportError(state) {
      state.readiness.error = null;
      state.traveler.error = null;
      state.admin.error = null;
      state.alternative.error = null;
      state.summaryExport.error = null;
    },
    setAdminStatusFilter(state, action: PayloadAction<AdminStatusFilter>) {
      state.admin.statusFilter = action.payload;
    },
  },
  extraReducers(builder) {
    builder
      .addCase(loadReadiness.pending, (state) => {
        state.readiness.loading = true;
        state.readiness.error = null;
      })
      .addCase(loadReadiness.fulfilled, (state, action) => {
        state.readiness.loading = false;
        state.readiness.tripId = action.payload.tripId;
        state.readiness.items = action.payload.items;
        state.readiness.progress = action.payload.progress;
      })
      .addCase(loadReadiness.rejected, (state, action) => {
        state.readiness.loading = false;
        state.readiness.items = [];
        state.readiness.progress = emptyProgress;
        state.readiness.error = action.payload ?? "The checklist could not be loaded.";
      })
      .addCase(toggleReadinessItem.pending, (state, action) => {
        state.readiness.savingKey = action.meta.arg.itemKey;
        state.readiness.error = null;
      })
      .addCase(toggleReadinessItem.fulfilled, (state, action) => {
        state.readiness.savingKey = null;
        state.readiness.items = action.payload.items;
        state.readiness.progress = action.payload.progress;
      })
      .addCase(toggleReadinessItem.rejected, (state, action) => {
        state.readiness.savingKey = null;
        state.readiness.error = action.payload ?? "That change was not saved. Try again.";
      })
      .addCase(loadTravelerTickets.pending, (state) => {
        state.traveler.loading = true;
        state.traveler.error = null;
      })
      .addCase(loadTravelerTickets.fulfilled, (state, action) => {
        state.traveler.loading = false;
        state.traveler.tickets = action.payload;
      })
      .addCase(loadTravelerTickets.rejected, (state, action) => {
        state.traveler.loading = false;
        state.traveler.tickets = [];
        state.traveler.error = action.payload ?? "Support requests could not be loaded.";
      })
      .addCase(createTicket.pending, (state) => {
        state.traveler.saving = true;
        state.traveler.error = null;
      })
      .addCase(createTicket.fulfilled, (state, action) => {
        state.traveler.saving = false;
        state.traveler.tickets = [action.payload, ...state.traveler.tickets];
        state.traveler.selectedTicket = action.payload;
      })
      .addCase(createTicket.rejected, (state, action) => {
        state.traveler.saving = false;
        state.traveler.error = action.payload ?? "The support request was not created.";
      })
      .addCase(loadTicketDetails.pending, (state) => {
        state.traveler.loading = true;
        state.traveler.error = null;
      })
      .addCase(loadTicketDetails.fulfilled, (state, action) => {
        state.traveler.loading = false;
        state.traveler.selectedTicket = action.payload;
      })
      .addCase(loadTicketDetails.rejected, (state, action) => {
        state.traveler.loading = false;
        state.traveler.selectedTicket = null;
        state.traveler.error = action.payload ?? "This support request could not be loaded.";
      })
      .addCase(loadAdminTickets.pending, (state, action) => {
        state.admin.loading = true;
        state.admin.error = null;
        state.admin.statusFilter = action.meta.arg;
      })
      .addCase(loadAdminTickets.fulfilled, (state, action) => {
        state.admin.loading = false;
        state.admin.tickets = action.payload.tickets;
        state.admin.statusFilter = action.payload.statusFilter;
      })
      .addCase(loadAdminTickets.rejected, (state, action) => {
        state.admin.loading = false;
        state.admin.tickets = [];
        state.admin.error = action.payload ?? "Admin tickets could not be loaded.";
      })
      .addCase(loadAdminTicket.pending, (state) => {
        state.admin.loading = true;
        state.admin.error = null;
      })
      .addCase(loadAdminTicket.fulfilled, (state, action) => {
        state.admin.loading = false;
        state.admin.selectedTicket = action.payload;
      })
      .addCase(loadAdminTicket.rejected, (state, action) => {
        state.admin.loading = false;
        state.admin.selectedTicket = null;
        state.admin.error = action.payload ?? "This ticket could not be loaded.";
      })
      .addCase(updateAdminStatus.pending, (state) => {
        state.admin.saving = true;
        state.admin.error = null;
      })
      .addCase(updateAdminStatus.fulfilled, (state, action) => {
        state.admin.saving = false;
        state.admin.selectedTicket = action.payload;
        state.admin.tickets = state.admin.tickets.map((ticket) =>
          ticket.id === action.payload.id ? action.payload : ticket,
        );
      })
      .addCase(updateAdminStatus.rejected, (state, action) => {
        state.admin.saving = false;
        state.admin.error = action.payload ?? "The ticket was not updated.";
      })
      .addCase(loadAlternative.pending, (state) => {
        state.alternative.loading = true;
        state.alternative.error = null;
      })
      .addCase(loadAlternative.fulfilled, (state, action) => {
        state.alternative.loading = false;
        state.alternative.current = action.payload.alternative;
        state.alternative.replacementExecutionRequired = action.payload.replacementExecutionRequired;
      })
      .addCase(loadAlternative.rejected, (state, action) => {
        state.alternative.loading = false;
        state.alternative.current = null;
        state.alternative.error = action.payload ?? "The alternative could not be loaded.";
      })
      .addCase(createAlternative.pending, (state) => {
        state.alternative.saving = true;
        state.alternative.error = null;
      })
      .addCase(createAlternative.fulfilled, (state, action) => {
        state.alternative.saving = false;
        state.alternative.current = action.payload;
        state.alternative.replacementExecutionRequired = false;
      })
      .addCase(createAlternative.rejected, (state, action) => {
        state.alternative.saving = false;
        state.alternative.error = action.payload ?? "The alternative was not proposed.";
      })
      .addCase(decideAlternative.pending, (state) => {
        state.alternative.saving = true;
        state.alternative.error = null;
      })
      .addCase(decideAlternative.fulfilled, (state, action) => {
        state.alternative.saving = false;
        state.alternative.current = action.payload.alternative;
        state.alternative.replacementExecutionRequired = action.payload.replacementExecutionRequired;
      })
      .addCase(decideAlternative.rejected, (state, action) => {
        state.alternative.saving = false;
        state.alternative.error = action.payload ?? "The decision was not saved.";
      })
      .addCase(exportTripSummary.pending, (state) => {
        state.summaryExport.loading = true;
        state.summaryExport.error = null;
      })
      .addCase(exportTripSummary.fulfilled, (state) => {
        state.summaryExport.loading = false;
      })
      .addCase(exportTripSummary.rejected, (state, action) => {
        state.summaryExport.loading = false;
        state.summaryExport.error = action.payload ?? "The trip summary could not be downloaded.";
      });
  },
});

export const supportReducer = supportSlice.reducer;
export const { clearSupportError, setAdminStatusFilter } = supportSlice.actions;

export function selectSupport(state: StateWithSupport): SupportState {
  return state.support;
}

export type SupportThunkDispatch = ThunkDispatch<StateWithSupport, undefined, UnknownAction>;
