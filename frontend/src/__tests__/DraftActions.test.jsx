import { act, renderHook } from '@testing-library/react';
import api from '../lib/api';
import { useDraftActions } from '../hooks/useDraft';

jest.mock('../lib/api', () => ({ __esModule: true, default: { post: jest.fn() } }));

describe('draft commissioner actions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends the visible turn with a selection so a stale click cannot take the following turn', async () => {
    api.post.mockResolvedValue({ data: { player_id: 'player-7' } });
    const { result } = renderHook(() => useDraftActions('draft-1'));
    await act(async () => { await result.current.makePick('player-7', 12); });
    expect(api.post).toHaveBeenCalledWith('/drafts/draft-1/picks', {
      player_id: 'player-7', expected_pick_number: 12
    });
    expect(result.current.loading).toBe(false);
  });

  it('guards automatic selections against a stale timer or manual request', async () => {
    api.post.mockResolvedValue({ data: { player_id: 'player-8' } });
    const { result } = renderHook(() => useDraftActions('draft-1'));
    await act(async () => { await result.current.autoPick(13); });
    expect(api.post).toHaveBeenCalledWith('/drafts/draft-1/picks/auto', {
      expected_pick_number: 13
    });
  });

  it('preserves an actionable server rejection and releases the busy state', async () => {
    const failure = { response: { data: { detail: 'The draft has moved to another pick. Refresh and retry.' } } };
    api.post.mockRejectedValue(failure);
    const { result } = renderHook(() => useDraftActions('draft-1'));
    await act(async () => {
      await expect(result.current.makePick('player-7', 12)).rejects.toEqual(failure);
    });
    expect(result.current.error).toBe(failure.response.data.detail);
    expect(result.current.loading).toBe(false);
  });
});
