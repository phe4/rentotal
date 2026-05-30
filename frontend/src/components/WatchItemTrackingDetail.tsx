import type { WatchItemDetail } from "../api/types";
import { formatDateTime, formatMoney } from "./format";

type WatchItemTrackingDetailProps = {
  selectedWatchItemId: string | null;
  selectedItemLabel?: string;
  detail: WatchItemDetail | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function WatchItemTrackingDetail(props: WatchItemTrackingDetailProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Watch Item Detail</h2>
        {props.selectedWatchItemId && props.error ? (
          <button type="button" onClick={props.onRetry}>
            Retry Detail
          </button>
        ) : null}
      </div>

      {!props.selectedWatchItemId ? (
        <p>Select a watch item from overview.</p>
      ) : null}

      {props.selectedWatchItemId && props.loading ? (
        <p>Loading detail...</p>
      ) : null}

      {props.selectedWatchItemId && !props.loading && props.error ? (
        <div className="section-error">
          <p>Failed to load watch item detail.</p>
          <p className="error-detail">{props.error}</p>
        </div>
      ) : null}

      {props.selectedWatchItemId &&
      !props.loading &&
      !props.error &&
      props.detail ? (
        <div className="detail-grid">
          <p>
            <strong>Property:</strong>{" "}
            {props.detail.propertyName ?? props.selectedItemLabel ?? "N/A"}
          </p>
          <p>
            <strong>Status:</strong> {props.detail.watchItemStatus}
          </p>
          <p>
            <strong>Latest Effective Rent:</strong>{" "}
            {formatMoney(props.detail.latestPrice?.effectiveRent ?? null)}
          </p>
          <p>
            <strong>Latest Base Rent:</strong>{" "}
            {formatMoney(props.detail.latestPrice?.baseRent ?? null)}
          </p>
          <p>
            <strong>Unread Alerts:</strong>{" "}
            {props.detail.alertSummary.unreadCount}
          </p>
          <p>
            <strong>Last Checked:</strong>{" "}
            {formatDateTime(props.detail.trackingStatus.lastCheckedAt)}
          </p>
          <p>
            <strong>Needs Review:</strong>{" "}
            {props.detail.trackingStatus.needsReview ? "YES" : "NO"}
          </p>
          <p>
            <strong>Last Error:</strong>{" "}
            {props.detail.trackingStatus.lastErrorMessage ?? "None"}
          </p>
          <h3>Source Health</h3>
          <ul className="run-list">
            {props.detail.sourceHealth.map((source) => (
              <li key={source.sourceId}>
                {source.sourceType} | usable {source.isUsable ? "yes" : "no"} |
                status {source.lastRunStatus ?? "unknown"} | needs review{" "}
                {source.needsReview ? "yes" : "no"}
                {source.errorMessage ? ` | ${source.errorMessage}` : ""}
              </li>
            ))}
          </ul>
          <h3>Recent Results</h3>
          <ul className="run-list">
            {props.detail.recentResults.length === 0 ? (
              <li>No recent results.</li>
            ) : (
              props.detail.recentResults.map((result) => (
                <li
                  key={`${result.createdAt}-${result.status}-${result.crawlerTier ?? "none"}`}
                >
                  {result.status}{" "}
                  {result.crawlerTier ? `(${result.crawlerTier})` : ""} at{" "}
                  {formatDateTime(result.createdAt)} | items{" "}
                  {result.itemsFound ?? 0}
                  {result.errorMessage ? ` | ${result.errorMessage}` : ""}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
