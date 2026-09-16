import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { useEffect } from 'preact/hooks';
import { afterEach, expect, test } from 'vitest';
import { InertContext } from '../layout/LessonContext';
import { Figure, useReportState } from './Figure';
import { clipboardProvider, setAskProvider } from './provider';

function Reporter() {
  const report = useReportState();
  useEffect(() => report({ omega: 2.51234, mode: 'dt' }), []);
  return <p>sim</p>;
}

afterEach(() => {
  cleanup();
  setAskProvider(clipboardProvider);
});

test('the ask button sends the figure id and reported settings to the provider', async () => {
  let sent = '';
  setAskProvider(async (text) => {
    sent = text;
    return 'copied';
  });
  render(
    <Figure id="euler">
      <Reporter />
    </Figure>,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Ask about this/ }));
  });
  expect(sent).toContain('Where: figure "euler"');
  expect(sent).toContain('Settings: omega=2.51, mode=dt');
  expect(screen.getByRole('status').textContent).toBe('Copied. Paste it into our chat.');
});

test('an inert figure renders nothing inside', () => {
  const { container } = render(
    <InertContext.Provider value={true}>
      <Figure id="x">
        <Reporter />
      </Figure>
    </InertContext.Provider>,
  );
  expect(container.textContent).toBe('');
  expect(container.querySelector('.figure--inert')).not.toBeNull();
});
