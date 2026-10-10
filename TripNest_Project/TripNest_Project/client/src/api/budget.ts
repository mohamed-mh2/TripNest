import { financeAccessToken, getFinanceSession } from './financeSession';
import type { BudgetState, Expense } from '../features/budget/model';
type Snapshot = {
  budgetMinor: number;
  reserveMinor: number;
  bookedNetMinor: number;
  bookings: NonNullable<BudgetState['bookings']>;
  expenses: {
    id: string;
    label: string;
    amountMinor: number;
    category: Expense['category'];
    coveredByBookingId: string | null;
    bookingCancelled?: boolean;
  }[];
};

export class BudgetApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

let token = '';
let tripId = '';

async function request(path: string, method = 'GET', body?: unknown): Promise<Snapshot> {
  const response = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + financeAccessToken(token),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Server unavailable.' }));
    throw new BudgetApiError(data.error ?? 'Request failed.', response.status);
  }
  return response.json();
}

function convert(data: Snapshot): BudgetState {
  return {
    budgetInCents: data.budgetMinor,
    reserveInCents: data.reserveMinor,
    bookedNetInCents: data.bookedNetMinor,
    bookings: data.bookings,
    expenses: data.expenses.map((e) => ({
      id: e.id,
      name: e.label,
      amountInCents: e.amountMinor,
      category: e.category,
      coveredByBookingId: e.coveredByBookingId,
      bookingCancelled: e.bookingCancelled,
    })),
  };
}
export async function connectLocalBudget() {
  const session = await getFinanceSession('traveler');
  if (!session.tripId) throw new Error('Select a trip before opening its budget.');
  token = session.token;
  tripId = session.tripId;
  return convert(await request(`/trips/${tripId}/budget`));
}
export async function saveRemotePlan(budgetInCents: number, reserveInCents: number) {
  return convert(
    await request(`/trips/${tripId}/budget`, 'PATCH', {
      budgetMinor: budgetInCents,
      reserveMinor: reserveInCents,
    }),
  );
}
export async function saveRemoteExpense(expense: Expense, editing: boolean) {
  return convert(
    await request(
      `/trips/${tripId}/expenses${editing ? '/' + expense.id : ''}`,
      editing ? 'PATCH' : 'POST',
      {
        id: expense.id,
        label: expense.name,
        amountMinor: expense.amountInCents,
        category: expense.category,
        coveredByBookingId: expense.coveredByBookingId ?? null,
      },
    ),
  );
}
export async function deleteRemoteExpense(id: string) {
  return convert(await request(`/trips/${tripId}/expenses/${id}`, 'DELETE'));
}

export async function saveRemoteEstimates(
  expenses: Expense[],
  expectedTotalMinor: number,
  expectedExpenseCount: number,
) {
  return convert(
    await request(`/trips/${tripId}/estimate-import`, 'POST', {
      expectedTotalMinor,
      expectedExpenseCount,
      expenses: expenses.map((e) => ({
        id: e.id,
        label: e.name,
        category: e.category,
        amountMinor: e.amountInCents,
      })),
    }),
  );
}
