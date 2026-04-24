import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('../lib/api.js', () => ({
  apiCreateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiUpdateSession: vi.fn().mockResolvedValue({ ok: false, data: null }),
  apiRecordEvent: vi.fn().mockResolvedValue({ ok: false, data: null }),
}));

import { useBingoGame } from '../composables/useBingoGame.js';
import BingoGrid from './BingoGrid.vue';

const TILES = Array.from({ length: 9 }, (_, i) => ({
  title: `Task ${i + 1}`,
  tag: i % 2 === 0 ? 'Productivity' : 'Analysis',
  tileIndex: i,
  packId: 1,
  verify: () => [],
}));

beforeEach(() => {
  const { state } = useBingoGame();
  state.tiles = [...TILES];
  state.cleared = new Array(9).fill(false);
});

describe('BingoGrid', () => {
  it('renders 9 tiles with title, tag, and task number', () => {
    const w = mount(BingoGrid);
    const tiles = w.findAll('.tile');
    expect(tiles).toHaveLength(9);
    expect(tiles[0].text()).toContain('Task 1');
    expect(tiles[0].text()).toContain('Productivity');
    expect(tiles[1].text()).toContain('Analysis');
  });

  it('adds the "cleared" class only to cleared tiles', async () => {
    const { state } = useBingoGame();
    state.cleared[2] = true;
    state.cleared[5] = true;
    const w = mount(BingoGrid);
    await w.vm.$nextTick();
    const cleared = w.findAll('.tile.cleared');
    expect(cleared).toHaveLength(2);
  });

  it('emits open-tile with the index when a tile is clicked', async () => {
    const w = mount(BingoGrid);
    await w.findAll('.tile')[3].trigger('click');
    expect(w.emitted('open-tile')).toEqual([[3]]);
  });

  it('uses responsive grid columns (2-col compact, 3-col expanded)', () => {
    const w = mount(BingoGrid);
    const grid = w.find('div');
    expect(grid.classes()).toContain('grid-cols-2');
    expect(grid.classes()).toContain('sm:grid-cols-3');
  });
});
