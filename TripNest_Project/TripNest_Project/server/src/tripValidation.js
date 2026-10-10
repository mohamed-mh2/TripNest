export function validDate(value) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
export function validateTrip(body, partial = false) {
  body = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const errors = {};
  const value = {};
  for (const key of ['name', 'destination']) {
    if (body[key] !== undefined) {
      if (
        typeof body[key] !== 'string' ||
        body[key].trim().length < 2 ||
        body[key].trim().length > (key === 'name' ? 120 : 160)
      )
        errors[key] = 'Enter a valid value.';
      else value[key] = body[key].trim();
    } else if (!partial) errors[key] = 'This field is required.';
  }
  for (const key of ['startDate', 'endDate'])
    if (body[key] !== undefined) {
      if (!validDate(body[key])) errors[key] = 'Use a valid date in YYYY-MM-DD format.';
      else value[key] = body[key] || null;
    }
  if (body.travelerCount !== undefined) {
    if (
      !Number.isInteger(body.travelerCount) ||
      body.travelerCount < 1 ||
      body.travelerCount > 20
    )
      errors.travelerCount = 'Enter a whole number of travelers from 1 to 20.';
    else value.travelerCount = body.travelerCount;
  } else if (!partial) errors.travelerCount = 'Number of travelers is required.';
  if (body.budgetAmount !== undefined) {
    const amount =
      typeof body.budgetAmount === 'number'
        ? body.budgetAmount
        : Number(body.budgetAmount);
    if (
      !['number', 'string'].includes(typeof body.budgetAmount) ||
      (typeof body.budgetAmount === 'string' &&
        !/^\d+(\.\d{1,2})?$/.test(body.budgetAmount)) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 1000000 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8
    )
      errors.budgetAmount =
        'Enter a budget from 0 to 1,000,000 EUR with up to 2 decimal places.';
    else value.budgetAmount = amount;
  } else if (!partial) errors.budgetAmount = 'Planned budget is required.';
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 4000)
      errors.notes = 'Notes must be at most 4000 characters.';
    else value.notes = body.notes.trim();
  }
  const start = value.startDate === undefined ? body.startDate : value.startDate;
  const end = value.endDate === undefined ? body.endDate : value.endDate;
  if (start && end && end < start)
    errors.endDate = 'End date must be on or after the start date.';
  return { value, errors };
}
