import type { ComponentChildren } from 'preact';
import { tr } from '../i18n/ui';

type BoxProps = { kind: 'syllabus' | 'beyond' | 'exam'; icon: string; label: string; children?: ComponentChildren };

function Box({ kind, icon, label, children }: BoxProps) {
  return (
    <aside class={`box box--${kind}`} data-kind={kind}>
      <div class="box__label">
        <span aria-hidden="true">{icon}</span> {label}
      </div>
      <div class="box__body">{children}</div>
    </aside>
  );
}

type Props = { children?: ComponentChildren };

export const Syllabus = ({ children }: Props) => (
  <Box kind="syllabus" icon="📘" label={tr('syllabus')}>
    {children}
  </Box>
);

export const Beyond = ({ children }: Props) => (
  <Box kind="beyond" icon="🎓" label={tr('beyond')}>
    {children}
  </Box>
);

export const ExamTip = ({ children }: Props) => (
  <Box kind="exam" icon="🎯" label={tr('examTip')}>
    {children}
  </Box>
);
