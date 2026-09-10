import { renderHook, act } from '@testing-library/react';
import { useDraft, useDraftPicks, useDraftTeams, useAvailablePlayers } from '../useDraft';
import api from '../../lib/api';
jest.mock('../../lib/api',()=>({__esModule:true,default:{get:jest.fn()}}));
beforeEach(()=>{jest.useFakeTimers();api.get.mockReset();});
afterEach(()=>jest.useRealTimers());
test.each([useDraft,useDraftPicks,useDraftTeams,useAvailablePlayers])('slow polling does not accumulate requests (%#)',async hook=>{
 let resolve;
 api.get.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const {unmount}=renderHook(()=>hook('synthetic'));
 expect(api.get).toHaveBeenCalledTimes(1);
 act(()=>jest.advanceTimersByTime(20000));
 expect(api.get).toHaveBeenCalledTimes(1);
 await act(async()=>resolve({data:[]}));
 act(()=>jest.advanceTimersByTime(2000));
 expect(api.get).toHaveBeenCalledTimes(2);
 unmount();
});
