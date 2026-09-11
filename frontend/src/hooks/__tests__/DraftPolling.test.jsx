import { renderHook, act } from '@testing-library/react';
import { useDraft, useDraftPicks, useDraftTeams, useAvailablePlayers } from '../useDraft';
import api from '../../lib/api';
jest.mock('../../lib/api',()=>({__esModule:true,default:{get:jest.fn()}}));
let revision;
const hooks = () => ({ draft: useDraft('synthetic'), picks: useDraftPicks('synthetic'), teams: useDraftTeams('synthetic'), players: useAvailablePlayers('synthetic') });
const flush = async () => act(async()=>{});
beforeEach(()=>{
 jest.useFakeTimers(); revision=1; api.get.mockReset();
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 api.get.mockImplementation(async path=>({data:path.endsWith('/synthetic')?{status:'active',current_pick:revision}:[]}));
});
afterEach(()=>jest.useRealTimers());
test('four panels share one initial fetch; unchanged active draft avoids roster scans',async()=>{
 const {unmount}=renderHook(hooks);await flush();expect(api.get).toHaveBeenCalledTimes(4);
 for(let i=0;i<5;i++) await act(async()=>jest.advanceTimersByTime(10000));
 expect(api.get).toHaveBeenCalledTimes(9); // Previously 104 requests in 50 seconds across these hooks.
 expect(api.get.mock.calls.filter(([p])=>p.endsWith('/picks'))).toHaveLength(1);
 unmount();
});
test('pick revision refreshes all panels together, including undo to an earlier slot',async()=>{
 const {result,unmount}=renderHook(hooks);await flush();revision=2;
 await act(async()=>jest.advanceTimersByTime(10000));expect(api.get).toHaveBeenCalledTimes(8);
 expect(result.current.draft.draft.current_pick).toBe(2);
 revision=1;await act(async()=>jest.advanceTimersByTime(10000));expect(api.get).toHaveBeenCalledTimes(12);unmount();
});
test('hidden tabs stop polling and refresh on return',async()=>{
 const {unmount}=renderHook(hooks);await flush();
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
 act(()=>document.dispatchEvent(new Event('visibilitychange')));
 await act(async()=>jest.advanceTimersByTime(120000));expect(api.get).toHaveBeenCalledTimes(4);
 Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});
 await act(async()=>document.dispatchEvent(new Event('visibilitychange')));expect(api.get).toHaveBeenCalledTimes(8);unmount();
});
test('slow requests do not accumulate polls',async()=>{
 let resolve;api.get.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const {unmount}=renderHook(hooks);expect(api.get).toHaveBeenCalledTimes(1);
 act(()=>jest.advanceTimersByTime(120000));expect(api.get).toHaveBeenCalledTimes(1);unmount();
 await act(async()=>resolve({data:{status:'active'}}));
});
test('failed refresh retains last coherent snapshot and backs off',async()=>{
 const {result,unmount}=renderHook(hooks);await flush();
 api.get.mockRejectedValue(new Error('quota unavailable'));
 await act(async()=>jest.advanceTimersByTime(10000));expect(result.current.draft.error).toBe('quota unavailable');
 expect(result.current.draft.draft.current_pick).toBe(1);
 const n=api.get.mock.calls.length;
 await act(async()=>jest.advanceTimersByTime(10000));expect(api.get).toHaveBeenCalledTimes(n);
 await act(async()=>jest.advanceTimersByTime(10000));expect(api.get).toHaveBeenCalledTimes(n+1);unmount();
});
test('completed views poll once per minute and still recover final undo',async()=>{
 api.get.mockImplementation(async path=>({data:path.endsWith('/synthetic')?{status:revision===1?'completed':'active',current_pick:revision}:[]}));
 const {result,unmount}=renderHook(hooks);await flush();
 await act(async()=>jest.advanceTimersByTime(59000));expect(api.get).toHaveBeenCalledTimes(4);
 revision=2;await act(async()=>jest.advanceTimersByTime(1000));expect(result.current.draft.draft.status).toBe('active');unmount();
});
test('multiple panel refetches share one full refresh',async()=>{
 const {result,unmount}=renderHook(hooks);await flush();api.get.mockClear();
 await act(async()=>Promise.all(Object.values(result.current).map(panel=>panel.refetch())));
 expect(api.get).toHaveBeenCalledTimes(4);unmount();
});
test('mutation refresh queued behind an old lightweight read is not lost',async()=>{
 const {result,unmount}=renderHook(hooks);await flush();
 let resolve;api.get.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
 act(()=>jest.advanceTimersByTime(10000));
 let forced;act(()=>{forced=result.current.picks.refetch();});revision=2;
 await act(async()=>{resolve({data:{status:'active',current_pick:1}});await forced;});
 expect(result.current.draft.draft.current_pick).toBe(2);unmount();
});
