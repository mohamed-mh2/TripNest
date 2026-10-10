// Calendar date helpers. Dates are 'YYYY-MM-DD' strings and times are treated as UTC. المسؤول: abed alrahman.

import pg from 'pg';

// #explain_notes: Preserve DATE as a calendar string in production and integration tests.
pg.types.setTypeParser(1082, (value) => value);

const DAY_MS = 24 * 60 * 60 * 1000;

// #explain_notes: pg returns DATE as a string, while pg-mem returns a Date object; both become 'YYYY-MM-DD'.
function toDateString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function todayString(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

function daysBetween(startDate, endDate) {
  return Math.round(
    (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS,
  );
}

function combineDateAndTime(dateString, time) {
  const safeTime = /^\d{2}:\d{2}$/.test(time || '') ? time : '00:00';

  return new Date(`${dateString}T${safeTime}:00Z`);
}

export {
  toDateString,
  isValidDateString,
  todayString,
  addDays,
  daysBetween,
  combineDateAndTime,
};
