import type { PriceCheckHealth } from "../api/types";
import { formatDateTime } from "./format";

type HealthSummaryPanelProps = {
  health: PriceCheckHealth | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function HealthSummaryPanel(props: HealthSummaryPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Health Summary</h2>
        {props.error ? (
          <button type="button" onClick={props.onRetry}>
            Retry
          </button>
        ) : null}
      </div>

      {props.loading ? <p>Loading health summary...</p> : null}

      {!props.loading && props.error ? (
        <div className="section-error">
          <p>Failed to load health summary.</p>
          <p className="error-detail">{props.error}</p>
        </div>
      ) : null}

      {!props.loading && !props.error && !props.health ? (
        <p>No health summary available.</p>
      ) : null}

      {!props.loading && !props.error && props.health ? (
        <>
          <div className="stats-grid">
            <Stat
              label="Active watch items"
              value={props.health.activeWatchItems}
            />
            <Stat
              label="Without usable sources"
              value={props.health.watchItemsWithoutSources}
            />
            <Stat label="Usable sources" value={props.health.usableSources} />
            <Stat
              label="Recent success sources"
              value={props.health.sourcesWithRecentSuccess}
            />
            <Stat
              label="Recent failure sources"
              value={props.health.sourcesWithRecentFailure}
            />
            <Stat
              label="Needs review sources"
              value={props.health.sourcesNeedingReview}
            />
          </div>
          <p className="muted">
            Last run:{" "}
            {props.health.lastRunAt
              ? formatDateTime(props.health.lastRunAt)
              : "No runs yet"}
          </p>
        </>
      ) : null}
    </section>
  );
}

function Stat(props: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}
