import type { OverviewItem } from "../api/types";

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

export function budgetText(item: OverviewItem): string {
  const status = item.budgetStatus;
  if (status.withinBudget === null) return "N/A";
  if (status.withinBudget) {
    return `Within (${formatMoney(status.amountBelowBudget ?? null)} below)`;
  }
  return `Over (${formatMoney(status.amountAboveBudget ?? null)} above)`;
}
