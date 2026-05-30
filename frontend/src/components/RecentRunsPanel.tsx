import type { PriceCheckRun } from "../api/types";
import { formatDateTime } from "./format";

type RecentRunsPanelProps = {
  runs: PriceCheckRun[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

export function RecentRunsPanel(props: RecentRunsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Recent Price Check Runs</h2>
        {props.error ? (
          <button type="button" onClick={props.onRetry}>
            Retry
          </button>
        ) : null}
      </div>

      {props.loading ? <p>Loading recent runs...</p> : null}

      {!props.loading && props.error ? (
        <div className="section-error">
          <p>Failed to load recent runs.</p>
          <p className="error-detail">{props.error}</p>
        </div>
      ) : null}

      {!props.loading && !props.error && props.runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : null}

      {!props.loading && !props.error && props.runs.length > 0 ? (
        <ul className="run-list">
          {props.runs.map((run) => (
            <li key={run.id}>
              <strong>{run.status}</strong> at {formatDateTime(run.startedAt)} |
              selected {run.sourcesSelected}, success {run.sourcesSucceeded},
              failed {run.sourcesFailed}, needs review {run.sourcesNeedsReview}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
