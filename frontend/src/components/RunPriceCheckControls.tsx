import type { FormEvent } from "react";
import type { RunOptionsFormState } from "../api/types";

type RunPriceCheckControlsProps = {
  runBusy: boolean;
  refreshing: boolean;
  runError: string | null;
  runOptions: RunOptionsFormState;
  onRunOptionsChange: (next: RunOptionsFormState) => void;
  onRunPriceCheck: (dryRun: boolean) => void;
  onRefresh: () => void;
};

export function RunPriceCheckControls(props: RunPriceCheckControlsProps) {
  function onSubmit(event: FormEvent) {
    event.preventDefault();
  }

  return (
    <section className="panel">
      <h2>Run Controls</h2>
      <form onSubmit={onSubmit} className="controls-grid">
        <label>
          Cooldown Minutes
          <input
            value={props.runOptions.cooldownMinutes}
            onChange={(event) =>
              props.onRunOptionsChange({
                ...props.runOptions,
                cooldownMinutes: event.target.value,
              })
            }
            inputMode="numeric"
          />
        </label>
        <label>
          Max Sources
          <input
            value={props.runOptions.maxSources}
            onChange={(event) =>
              props.onRunOptionsChange({
                ...props.runOptions,
                maxSources: event.target.value,
              })
            }
            inputMode="numeric"
            placeholder="Optional"
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={props.runOptions.force}
            onChange={(event) =>
              props.onRunOptionsChange({
                ...props.runOptions,
                force: event.target.checked,
              })
            }
          />
          Force (ignore cooldown)
        </label>
        <div className="button-row">
          <button
            type="button"
            disabled={props.runBusy}
            onClick={() => props.onRunPriceCheck(false)}
          >
            Run Price Check
          </button>
          <button
            type="button"
            disabled={props.runBusy}
            onClick={() => props.onRunPriceCheck(true)}
          >
            Dry Run
          </button>
          <button
            type="button"
            disabled={props.refreshing || props.runBusy}
            onClick={props.onRefresh}
          >
            Refresh
          </button>
        </div>
      </form>

      {props.runError ? (
        <div className="section-error">
          <p>Failed to run price check.</p>
          <p className="error-detail">{props.runError}</p>
        </div>
      ) : null}
    </section>
  );
}
