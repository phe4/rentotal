import type { OverviewItem } from "../api/types";
import { budgetText, formatDateTime, formatMoney } from "./format";

type WatchItemsOverviewTableProps = {
  items: OverviewItem[];
  loading: boolean;
  error: string | null;
  selectedWatchItemId: string | null;
  onRetry: () => void;
  onSelectWatchItem: (watchItemId: string) => void;
};

export function WatchItemsOverviewTable(props: WatchItemsOverviewTableProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Watch Items Overview</h2>
        {props.error ? (
          <button type="button" onClick={props.onRetry}>
            Retry
          </button>
        ) : null}
      </div>

      {props.loading ? <p>Loading watch items overview...</p> : null}

      {!props.loading && props.error ? (
        <div className="section-error">
          <p>Failed to load watch items overview.</p>
          <p className="error-detail">{props.error}</p>
        </div>
      ) : null}

      {!props.loading && !props.error && props.items.length === 0 ? (
        <p>No watch items found.</p>
      ) : null}

      {!props.loading && !props.error && props.items.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Property</th>
                <th>Status</th>
                <th>Effective Rent</th>
                <th>Budget</th>
                <th>Unread Alerts</th>
                <th>Last Checked</th>
                <th>Source Health</th>
                <th>Needs Review</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr
                  key={item.watchItemId}
                  onClick={() => props.onSelectWatchItem(item.watchItemId)}
                  className={
                    props.selectedWatchItemId === item.watchItemId
                      ? "selected"
                      : ""
                  }
                >
                  <td>{item.propertyName ?? item.watchItemId}</td>
                  <td>{item.watchItemStatus}</td>
                  <td>
                    {formatMoney(item.latestPrice?.effectiveRent ?? null)}
                  </td>
                  <td>{budgetText(item)}</td>
                  <td>{item.alertSummary.unreadCount}</td>
                  <td>{formatDateTime(item.trackingStatus.lastCheckedAt)}</td>
                  <td>
                    {item.sourceHealthStatus.overallStatus} (
                    {item.sourceHealthStatus.usableSources})
                  </td>
                  <td>{item.trackingStatus.needsReview ? "YES" : "NO"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
