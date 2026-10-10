// Mohamed mhamed: shared budget rules. All amounts use integer cents.

export const categories = [
  'Transport',
  'Accommodation',
  'Food',
  'Activities',
  'Other',
] as const;

export type Category = (typeof categories)[number];

export type Expense = {
  id: string;
  name: string;
  category: Category;
  amountInCents: number;
  coveredByBookingId?: string | null;
  bookingCancelled?: boolean;
};

export type BudgetState = {
  budgetInCents: number;
  reserveInCents: number;
  expenses: Expense[];
  bookedNetInCents?: number;
  bookings?: {
    id: string;
    netMinor: number;
    serviceName?: string | null;
    reference?: string | null;
    status?: string;
    category?: string | null;
  }[];
};

export const maximumAmount = 100000000;

export const emptyBudget: BudgetState = {
  budgetInCents: 160000,
  reserveInCents: 0,
  expenses: [],
};

export function validCents(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximumAmount
  );
}

export function parseAmount(input: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(input.trim())) return null;
  const cents = Math.round(Number(input) * 100);
  return validCents(cents) ? cents : null;
}

export function validExpense(value: unknown): value is Expense {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    item.id.length <= 100 &&
    typeof item.name === 'string' &&
    item.name.trim().length > 0 &&
    item.name.length <= 80 &&
    categories.some((category) => category === item.category) &&
    validCents(item.amountInCents) &&
    item.amountInCents > 0
  );
}

// Treat browser storage as untrusted data, including old or malformed versions.

export function decodeBudget(raw: string): BudgetState | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const record = value as Record<string, unknown>;
    if (
      record.version !== 1 ||
      !validCents(record.budgetInCents) ||
      !validCents(record.reserveInCents) ||
      !Array.isArray(record.expenses) ||
      record.expenses.length > 1000 ||
      !record.expenses.every(validExpense)
    )
      return null;
    const expenses: Expense[] = record.expenses;
    if (new Set(expenses.map((expense) => expense.id)).size !== expenses.length)
      return null;
    return {
      budgetInCents: record.budgetInCents,
      reserveInCents: record.reserveInCents,
      expenses,
    };
  } catch {
    return null;
  }
}

export function calculateBudget(state: BudgetState) {
  const expensesInCents = state.expenses
    .filter((expense) => !expense.coveredByBookingId)
    .reduce((sum, expense) => sum + expense.amountInCents, 0);
  const estimatedInCents =
    expensesInCents + state.reserveInCents + (state.bookedNetInCents ?? 0);
  return {
    expensesInCents,
    estimatedInCents,
    remainingInCents: state.budgetInCents - estimatedInCents,
  };
}

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
