// Price breakdown (quantity, unit price, taxes, fees, total) and cancellation policy. المسؤول: abed alrahman.

import { formatDateTime, formatMoney } from '../format';
import type { CancellationPolicy, PriceLine } from '../../../../../shared/types';

interface PriceSummaryProps {
  lines: PriceLine[];
  totalMinor: number;
  currency: string;
  totalLabel?: string;
}

export function PriceSummary({
  lines,
  totalMinor,
  currency,
  totalLabel = 'Total',
}: PriceSummaryProps) {
  return (
    <table className="price-table">
      <tbody>
        {lines.map((line) => (
          <tr key={`${line.kind}-${line.label}`}>
            <th scope="row">
              {line.label}
              {line.quantity > 1 && (
                <span className="price-table__detail">
                  {line.quantity} x {formatMoney(line.unitPriceMinor, currency)}
                </span>
              )}
            </th>
            <td>{formatMoney(line.amountMinor, currency)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">{totalLabel}</th>
          <td>{formatMoney(totalMinor, currency)}</td>
        </tr>
      </tfoot>
    </table>
  );
}

export function PolicyBox({ policy }: { policy: CancellationPolicy }) {
  return (
    <div className="policy-box">
      <strong>Cancellation policy</strong>
      <p>{policy.summary}</p>
      {policy.freeCancelUntil && (
        <p className="policy-box__deadline">
          Free cancellation until {formatDateTime(policy.freeCancelUntil)} (UTC).
        </p>
      )}
    </div>
  );
}
