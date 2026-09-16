import { createContext, type ComponentChildren } from 'preact';
import { useContext, useRef } from 'preact/hooks';
import { InertContext } from '../layout/LessonContext';
import { AskButton } from './AskButton';

type Report = (patch: Record<string, unknown>) => void;

const ReportContext = createContext<Report>(() => {});

/** Simulations call this to publish their current settings for the ask button. */
export function useReportState(): Report {
  return useContext(ReportContext);
}

export function Figure({ id, children }: { id: string; children?: ComponentChildren }) {
  const inert = useContext(InertContext);
  const state = useRef<Record<string, unknown>>({});
  const report = useRef<Report>((patch) => {
    state.current = { ...state.current, ...patch };
  });

  if (inert) return <div class="figure figure--inert" />;

  return (
    <figure class="figure" id={`fig-${id}`}>
      <ReportContext.Provider value={report.current}>{children}</ReportContext.Provider>
      <AskButton where={`figure "${id}"`} getState={() => state.current} />
    </figure>
  );
}
