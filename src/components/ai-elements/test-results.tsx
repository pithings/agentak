import type { ComponentChild, ComponentChildren, ComponentProps, VNode } from "preact";
import { cloneElement, createContext, isValidElement, toChildArray } from "preact";
import { useContext, useMemo } from "preact/hooks";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  useCollapsible,
} from "@/components/ui/collapsible";
import { CheckCircleIcon, Chevron, CircleDotIcon, CircleIcon, XCircleIcon } from "@/lib/icons";
import { useInteraction } from "@/lib/use-interaction";
import { useAnimation } from "@/lib/use-animation";
import { pulseKeyframes, pulseOptions, reset, u } from "@/styles/base";
import { sx, type Sx, type WithSx } from "@/styles/sx";

import { toolBodyErrorSx, toolBodySx } from "./tool";

/** A line between tests — a flex `gap` cannot draw one. */
const DIVIDER: Sx = { borderTop: "1px solid var(--border)" };

/** Narrows `isValidElement` so the clone below can type the `style` it adds. */
function hasStyle(child: ComponentChild): child is VNode<{ style?: Sx }> {
  return isValidElement(child);
}

function withDividers(children: ComponentChildren): ComponentChildren {
  return toChildArray(children).map((child, index) =>
    index > 0 && hasStyle(child)
      ? cloneElement(child, { style: sx(DIVIDER, child.props.style) })
      : child,
  );
}

export type TestStatus = "passed" | "failed" | "skipped" | "running";

/**
 * One status color, shared by the badges, the icons and the counts. Nothing
 * overrides it, so it is plain inline color — no compound selector needed.
 */
const STATUS_COLOR = {
  passed: { color: "var(--success)" },
  failed: { color: "var(--danger)" },
  skipped: { color: "var(--warning)" },
  running: { color: "var(--info)" },
} satisfies Record<TestStatus, Sx>;

/**
 * The badge tint. Badge's own background is inline now, so this used to be
 * `.badge.test--passed` — that compound selector could never win over
 * an inline value, so the override goes on the `style` prop instead.
 * "running" has no summary badge, so it is not in this map.
 */
const STATUS_BADGE_TINT = {
  passed: { background: "color-mix(in oklab, var(--success) 15%, transparent)" },
  failed: { background: "color-mix(in oklab, var(--danger) 15%, transparent)" },
  skipped: { background: "color-mix(in oklab, var(--warning) 15%, transparent)" },
} satisfies Record<"passed" | "failed" | "skipped", Sx>;

const S = {
  tests: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    background: "var(--background)",
  },
  testsHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--border)",
    padding: "0.75rem 1rem",
  },
  testsSummary: {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  },
  testsDuration: {
    color: "var(--muted-foreground)",
    fontSize: "0.875rem",
  },
  testsBar: {
    display: "flex",
    height: "0.5rem",
    overflow: "hidden",
    borderRadius: "9999px",
    background: "var(--muted)",
  },
  testsBarFill: {
    transition: "width var(--transition)",
  },
  testsBarFillPassed: {
    background: "var(--success)",
  },
  testsBarFillFailed: {
    background: "var(--danger)",
  },
  testsLegend: {
    display: "flex",
    justifyContent: "space-between",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  testsProgress: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  testsContent: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "1rem",
  },
  suite: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
  },
  suiteName: {
    boxSizing: "border-box",
    display: "flex",
    width: "100%",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.75rem 1rem",
    textAlign: "left",
    transition: "background-color var(--transition)",
  },
  suiteNameHover: {
    background: "var(--muted-surface)",
  },
  suiteTitle: {
    display: "flex",
    flex: "1",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  suiteStats: {
    display: "flex",
    marginLeft: "auto",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.75rem",
  },
  suiteContent: {
    borderTop: "1px solid var(--border)",
  },
  test: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    padding: "0.5rem 1rem",
    fontSize: "0.875rem",
  },
  testStatus: {
    flexShrink: "0",
  },
  testName: {
    flex: "1",
  },
  testDuration: {
    marginLeft: "auto",
    color: "var(--muted-foreground)",
    fontSize: "0.75rem",
  },
  // The error pane borrows the tool error surface. Inset to the test row.
  testError: {
    margin: "0 1rem 0.75rem",
    padding: "0.75rem",
  },
  testErrorMessage: {
    fontSize: "0.875rem",
    fontWeight: "500",
  },
  testErrorStack: {
    marginTop: "0.5rem",
    overflow: "auto",
    fontSize: "0.75rem",
  },
  pulseIconWrap: { display: "inline-flex" },
  pulseIconGlyph: { width: "100%", height: "100%" },
} satisfies Record<string, Sx>;

interface TestResultsSummary {
  passed: number;
  failed: number;
  skipped: number;
  total: number;
  duration?: number;
}

interface TestResultsContextType {
  summary?: TestResultsSummary;
}

const TestResultsContext = createContext<TestResultsContextType>({});

const formatDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`);

export type TestResultsHeaderProps = WithSx<ComponentProps<"div">>;

export const TestResultsHeader = ({
  className,
  style,
  children,
  ...props
}: TestResultsHeaderProps) => (
  <div className={className} style={sx(S.testsHeader, style)} {...props}>
    {children}
  </div>
);

export type TestResultsDurationProps = WithSx<ComponentProps<"span">>;

export const TestResultsDuration = ({
  className,
  style,
  children,
  ...props
}: TestResultsDurationProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary?.duration) {
    return null;
  }

  return (
    <span className={className} style={sx(S.testsDuration, style)} {...props}>
      {children ?? formatDuration(summary.duration)}
    </span>
  );
};

export type TestResultsSummaryProps = WithSx<ComponentProps<"div">>;

export const TestResultsSummary = ({
  className,
  style,
  children,
  ...props
}: TestResultsSummaryProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  return (
    <div className={className} style={sx(S.testsSummary, style)} {...props}>
      {children ?? (
        <>
          <Badge style={sx(STATUS_COLOR.passed, STATUS_BADGE_TINT.passed)} variant="secondary">
            <CheckCircleIcon />
            {summary.passed} passed
          </Badge>
          {summary.failed > 0 && (
            <Badge style={sx(STATUS_COLOR.failed, STATUS_BADGE_TINT.failed)} variant="secondary">
              <XCircleIcon />
              {summary.failed} failed
            </Badge>
          )}
          {summary.skipped > 0 && (
            <Badge style={sx(STATUS_COLOR.skipped, STATUS_BADGE_TINT.skipped)} variant="secondary">
              <CircleIcon />
              {summary.skipped} skipped
            </Badge>
          )}
        </>
      )}
    </div>
  );
};

/** One test, as data. A transcript carries data, not composed children. */
export interface TestData {
  name: string;
  status: TestStatus;
  duration?: number;
  error?: { message: string; stack?: string };
}

export interface TestSuiteData {
  name: string;
  status: TestStatus;
  tests?: TestData[];
}

const countBy = (tests: TestData[] | undefined, status: TestStatus) =>
  tests?.filter((test) => test.status === status).length ?? 0;

export type TestResultsProps = WithSx<ComponentProps<"div">> & {
  summary?: TestResultsSummary;
  suites?: TestSuiteData[];
};

export const TestResults = ({
  summary,
  suites,
  className,
  style,
  children,
  ...props
}: TestResultsProps) => {
  const contextValue = useMemo(() => ({ summary }), [summary]);

  return (
    <TestResultsContext.Provider value={contextValue}>
      <div className={className} style={sx(S.tests, style)} {...props}>
        {children ?? (
          <>
            {summary && (
              <TestResultsHeader>
                <TestResultsSummary />
                <TestResultsDuration />
              </TestResultsHeader>
            )}
            {(summary || suites) && (
              <TestResultsContent>
                {summary && <TestResultsProgress />}
                {suites?.map((suite) => (
                  <TestSuite defaultOpen key={suite.name} name={suite.name} status={suite.status}>
                    <TestSuiteName>
                      {suite.name}
                      <TestSuiteStats
                        failed={countBy(suite.tests, "failed")}
                        passed={countBy(suite.tests, "passed")}
                        skipped={countBy(suite.tests, "skipped")}
                      />
                    </TestSuiteName>
                    <TestSuiteContent>
                      {suite.tests?.map((test) => (
                        <div key={test.name}>
                          <Test duration={test.duration} name={test.name} status={test.status} />
                          {test.error && (
                            <TestError>
                              <TestErrorMessage>{test.error.message}</TestErrorMessage>
                              {test.error.stack && (
                                <TestErrorStack>{test.error.stack}</TestErrorStack>
                              )}
                            </TestError>
                          )}
                        </div>
                      ))}
                    </TestSuiteContent>
                  </TestSuite>
                ))}
              </TestResultsContent>
            )}
          </>
        )}
      </div>
    </TestResultsContext.Provider>
  );
};

export type TestResultsProgressProps = WithSx<ComponentProps<"div">>;

export const TestResultsProgress = ({
  className,
  style,
  children,
  ...props
}: TestResultsProgressProps) => {
  const { summary } = useContext(TestResultsContext);

  if (!summary) {
    return null;
  }

  const passedPercent = (summary.passed / summary.total) * 100;
  const failedPercent = (summary.failed / summary.total) * 100;

  return (
    <div className={className} style={sx(S.testsProgress, style)} {...props}>
      {children ?? (
        <>
          <div style={S.testsBar}>
            <div style={sx(S.testsBarFill, S.testsBarFillPassed, { width: `${passedPercent}%` })} />
            <div style={sx(S.testsBarFill, S.testsBarFillFailed, { width: `${failedPercent}%` })} />
          </div>
          <div style={S.testsLegend}>
            <span>
              {summary.passed}/{summary.total} tests passed
            </span>
            <span>{passedPercent.toFixed(0)}%</span>
          </div>
        </>
      )}
    </div>
  );
};

export type TestResultsContentProps = WithSx<ComponentProps<"div">>;

export const TestResultsContent = ({
  className,
  style,
  children,
  ...props
}: TestResultsContentProps) => (
  <div className={className} style={sx(S.testsContent, style)} {...props}>
    {children}
  </div>
);

interface TestSuiteContextType {
  name: string;
  status: TestStatus;
}

const TestSuiteContext = createContext<TestSuiteContextType>({
  name: "",
  status: "passed",
});

/**
 * The running-status icon, pulsing. A component of its own because
 * `useAnimation()` is a hook — the plain-VNode `statusIcons` map below never
 * mounts as a component, so it cannot call one itself.
 */
const PulsingCircleDotIcon = () => {
  const ref = useAnimation<HTMLSpanElement>(pulseKeyframes, pulseOptions);

  return (
    <span ref={ref} style={sx(u.icon, S.pulseIconWrap)}>
      <CircleDotIcon style={S.pulseIconGlyph} />
    </span>
  );
};

const statusIcons: Record<TestStatus, ComponentChildren> = {
  failed: <XCircleIcon style={u.icon} />,
  passed: <CheckCircleIcon style={u.icon} />,
  running: <PulsingCircleDotIcon />,
  skipped: <CircleIcon style={u.icon} />,
};

const TestStatusIcon = ({ status }: { status: TestStatus }) => (
  <span style={sx(S.testStatus, STATUS_COLOR[status])}>{statusIcons[status]}</span>
);

export type TestSuiteProps = WithSx<ComponentProps<typeof Collapsible>> & {
  name: string;
  status: TestStatus;
};

export const TestSuite = ({
  name,
  status,
  className,
  style,
  children,
  ...props
}: TestSuiteProps) => {
  const contextValue = useMemo(() => ({ name, status }), [name, status]);

  return (
    <TestSuiteContext.Provider value={contextValue}>
      <Collapsible className={className} style={sx(S.suite, style)} {...props}>
        {children}
      </Collapsible>
    </TestSuiteContext.Provider>
  );
};

export type TestSuiteNameProps = WithSx<ComponentProps<typeof CollapsibleTrigger>>;

export const TestSuiteName = ({ className, style, children, ...props }: TestSuiteNameProps) => {
  const { name, status } = useContext(TestSuiteContext);
  const { open } = useCollapsible("TestSuiteName");
  const { hovered, handlers } = useInteraction<HTMLButtonElement>(props);

  return (
    <CollapsibleTrigger
      className={className}
      style={sx(S.suiteName, hovered && S.suiteNameHover, style)}
      {...props}
      {...handlers}
    >
      <Chevron open={open} style={u.muted} turn={90} />
      <TestStatusIcon status={status} />
      <span style={S.suiteTitle}>{children ?? name}</span>
    </CollapsibleTrigger>
  );
};

export type TestSuiteStatsProps = WithSx<ComponentProps<"div">> & {
  passed?: number;
  failed?: number;
  skipped?: number;
};

export const TestSuiteStats = ({
  passed = 0,
  failed = 0,
  skipped = 0,
  className,
  style,
  children,
  ...props
}: TestSuiteStatsProps) => (
  <div className={className} style={sx(S.suiteStats, style)} {...props}>
    {children ?? (
      <>
        {passed > 0 && <span style={STATUS_COLOR.passed}>{passed} passed</span>}
        {failed > 0 && <span style={STATUS_COLOR.failed}>{failed} failed</span>}
        {skipped > 0 && <span style={STATUS_COLOR.skipped}>{skipped} skipped</span>}
      </>
    )}
  </div>
);

export type TestSuiteContentProps = WithSx<ComponentProps<typeof CollapsibleContent>>;

export const TestSuiteContent = ({
  className,
  style,
  children,
  ...props
}: TestSuiteContentProps) => (
  <CollapsibleContent className={className} style={sx(S.suiteContent, style)} {...props}>
    <div>{withDividers(children)}</div>
  </CollapsibleContent>
);

interface TestContextType {
  name: string;
  status: TestStatus;
  duration?: number;
}

const TestContext = createContext<TestContextType>({
  name: "",
  status: "passed",
});

export type TestNameProps = WithSx<ComponentProps<"span">>;

export const TestName = ({ className, style, children, ...props }: TestNameProps) => {
  const { name } = useContext(TestContext);

  return (
    <span className={className} style={sx(S.testName, style)} {...props}>
      {children ?? name}
    </span>
  );
};

export type TestDurationProps = WithSx<ComponentProps<"span">>;

export const TestDuration = ({ className, style, children, ...props }: TestDurationProps) => {
  const { duration } = useContext(TestContext);

  if (duration === undefined) {
    return null;
  }

  return (
    <span className={className} style={sx(S.testDuration, style)} {...props}>
      {children ?? `${duration}ms`}
    </span>
  );
};

export type TestStatusProps = WithSx<ComponentProps<"span">>;

export const TestStatus = ({ className, style, children, ...props }: TestStatusProps) => {
  const { status } = useContext(TestContext);

  return (
    <span className={className} style={sx(S.testStatus, STATUS_COLOR[status], style)} {...props}>
      {children ?? statusIcons[status]}
    </span>
  );
};

export type TestProps = WithSx<ComponentProps<"div">> & {
  name: string;
  status: TestStatus;
  duration?: number;
};

export const Test = ({
  name,
  status,
  duration,
  className,
  style,
  children,
  ...props
}: TestProps) => {
  const contextValue = useMemo(() => ({ duration, name, status }), [duration, name, status]);

  return (
    <TestContext.Provider value={contextValue}>
      <div className={className} style={sx(S.test, style)} {...props}>
        {children ?? (
          <>
            <TestStatus />
            <TestName />
            {duration !== undefined && <TestDuration />}
          </>
        )}
      </div>
    </TestContext.Provider>
  );
};

export type TestErrorProps = WithSx<ComponentProps<"div">>;

export const TestError = ({ className, style, children, ...props }: TestErrorProps) => (
  <div className={className} style={sx(toolBodySx, toolBodyErrorSx, S.testError, style)} {...props}>
    {children}
  </div>
);

export type TestErrorMessageProps = WithSx<ComponentProps<"p">>;

export const TestErrorMessage = ({
  className,
  style,
  children,
  ...props
}: TestErrorMessageProps) => (
  <p className={className} style={sx(reset.text, S.testErrorMessage, style)} {...props}>
    {children}
  </p>
);

export type TestErrorStackProps = WithSx<ComponentProps<"pre">>;

export const TestErrorStack = ({ className, style, children, ...props }: TestErrorStackProps) => (
  <pre className={className} style={sx(reset.pre, u.mono, S.testErrorStack, style)} {...props}>
    {children}
  </pre>
);
