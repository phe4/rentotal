import { useEffect, useMemo, useState } from "react";
import { dashboardApi } from "./api/client";
import type {
  OverviewResponse,
  PriceCheckHealth,
  PriceCheckRun,
  RunOptionsFormState,
  WatchItemDetail,
} from "./api/types";
import { HealthSummaryPanel } from "./components/HealthSummaryPanel";
import { RecentRunsPanel } from "./components/RecentRunsPanel";
import { RunPriceCheckControls } from "./components/RunPriceCheckControls";
import { WatchItemTrackingDetail } from "./components/WatchItemTrackingDetail";
import { WatchItemsOverviewTable } from "./components/WatchItemsOverviewTable";

export function App() {
  const [health, setHealth] = useState<PriceCheckHealth | null>(null);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [runs, setRuns] = useState<PriceCheckRun[]>([]);
  const [selectedWatchItemId, setSelectedWatchItemId] = useState<string | null>(
    null,
  );
  const [selectedDetail, setSelectedDetail] = useState<WatchItemDetail | null>(
    null,
  );
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [runOptions, setRunOptions] = useState<RunOptionsFormState>({
    cooldownMinutes: "360",
    maxSources: "",
    force: false,
  });

  const selectedItemLabel = useMemo(
    () =>
      overview?.items.find((item) => item.watchItemId === selectedWatchItemId)
        ?.propertyName,
    [overview, selectedWatchItemId],
  );

  async function loadDashboardData() {
    setDashboardLoading(true);
    setHealthLoading(true);
    setOverviewLoading(true);
    setRunsLoading(true);
    setHealthError(null);
    setOverviewError(null);
    setRunsError(null);

    const [healthResult, overviewResult, runsResult] = await Promise.allSettled(
      [
        dashboardApi.getHealth(),
        dashboardApi.getTrackingOverview(50, 0),
        dashboardApi.getRuns(10),
      ],
    );

    if (healthResult.status === "fulfilled") {
      setHealth(healthResult.value);
    } else {
      setHealth(null);
      setHealthError(extractErrorMessage(healthResult.reason));
    }
    setHealthLoading(false);

    if (overviewResult.status === "fulfilled") {
      setOverview(overviewResult.value);
    } else {
      setOverview(null);
      setOverviewError(extractErrorMessage(overviewResult.reason));
    }
    setOverviewLoading(false);

    if (runsResult.status === "fulfilled") {
      setRuns(runsResult.value);
    } else {
      setRuns([]);
      setRunsError(extractErrorMessage(runsResult.reason));
    }
    setRunsLoading(false);
    setDashboardLoading(false);
  }

  async function loadDetail(watchItemId: string) {
    setSelectedWatchItemId(watchItemId);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const detail = await dashboardApi.getWatchItemDetail(watchItemId);
      setSelectedDetail(detail);
    } catch (loadError) {
      setSelectedDetail(null);
      setDetailError(extractErrorMessage(loadError));
    } finally {
      setDetailLoading(false);
    }
  }

  async function runPriceCheck(dryRun: boolean) {
    setRunBusy(true);
    setRunError(null);
    try {
      const payload: {
        dryRun: boolean;
        force: boolean;
        cooldownMinutes?: number;
        maxSources?: number;
      } = {
        dryRun,
        force: runOptions.force,
      };
      const cooldownMinutes = parseOptionalNonNegativeNumber(
        runOptions.cooldownMinutes,
        "Cooldown Minutes",
      );
      if (cooldownMinutes !== undefined) {
        payload.cooldownMinutes = cooldownMinutes;
      }

      const maxSources = parseOptionalPositiveInteger(
        runOptions.maxSources,
        "Max Sources",
      );
      if (maxSources !== undefined) {
        payload.maxSources = maxSources;
      }

      await dashboardApi.runPriceCheck(payload);
      await loadDashboardData();
      if (selectedWatchItemId) {
        await loadDetail(selectedWatchItemId);
      }
    } catch (runError) {
      setRunError(extractErrorMessage(runError));
    } finally {
      setRunBusy(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
  }, []);

  return (
    <main className="page">
      <header className="page-header">
        <h1>Rentotal Admin Dashboard</h1>
        <p>Phase 7H frontend hardening on the minimal local admin dashboard</p>
      </header>

      <RunPriceCheckControls
        runBusy={runBusy}
        refreshing={dashboardLoading}
        runError={runError}
        runOptions={runOptions}
        onRunOptionsChange={setRunOptions}
        onRunPriceCheck={(dryRun) => void runPriceCheck(dryRun)}
        onRefresh={() => void loadDashboardData()}
      />

      <HealthSummaryPanel
        health={health}
        loading={healthLoading}
        error={healthError}
        onRetry={() => void loadDashboardData()}
      />

      <WatchItemsOverviewTable
        items={overview?.items ?? []}
        loading={overviewLoading}
        error={overviewError}
        selectedWatchItemId={selectedWatchItemId}
        onRetry={() => void loadDashboardData()}
        onSelectWatchItem={(watchItemId) => void loadDetail(watchItemId)}
      />

      <RecentRunsPanel
        runs={runs}
        loading={runsLoading}
        error={runsError}
        onRetry={() => void loadDashboardData()}
      />

      <WatchItemTrackingDetail
        selectedWatchItemId={selectedWatchItemId}
        selectedItemLabel={selectedItemLabel}
        detail={selectedDetail}
        loading={detailLoading}
        error={detailError}
        onRetry={() => {
          if (selectedWatchItemId) {
            void loadDetail(selectedWatchItemId);
          }
        }}
      />
    </main>
  );
}

function extractErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error.";
}

function parseOptionalNonNegativeNumber(
  value: string,
  label: string,
): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }

  return parsed;
}

function parseOptionalPositiveInteger(
  value: string,
  label: string,
): number | undefined {
  const trimmed = value.trim();
  if (trimmed === "") return undefined;

  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer.`);
  }

  return parsed;
}
