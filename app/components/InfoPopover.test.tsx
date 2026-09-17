import '@testing-library/jest-dom/vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';

import InfoPopover from './InfoPopover';

afterEach(cleanup);

describe('InfoPopover', () => {
  it('opens the encoding guide and closes it with Escape', () => {
    render(<InfoPopover />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: '查看视觉编码说明'}));

    expect(screen.getByRole('dialog', {name: '如何阅读本图'})).toBeVisible();
    expect(screen.getByText(/气泡面积/)).toBeVisible();

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the guide with its close button', () => {
    render(<InfoPopover />);
    fireEvent.click(screen.getByRole('button', {name: '查看视觉编码说明'}));
    fireEvent.click(screen.getByRole('button', {name: '关闭视觉编码说明'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
