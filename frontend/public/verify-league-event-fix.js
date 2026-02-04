/* eslint-disable no-console, no-unused-vars, no-extra-boolean-cast */
/**
 * League/Event Fix Verification Script
 * 
 * Run this in browser console (DevTools → Console) while on woo-combine.com
 * Paste the entire script and press Enter
 * 
 * Commit: 67a250e
 */

(async function verifyLeagueEventFix() {
  console.log('%c🔍 League/Event Fix Verification', 'font-size: 16px; font-weight: bold; color: #4CAF50');
  console.log('Commit: 67a250e');
  console.log('---');

  const results = {
    frontend: {},
    backend: {},
    overall: 'UNKNOWN'
  };

  // ============================================
  // FRONTEND STATE CHECKS
  // ============================================
  console.log('%c📱 Frontend State Checks', 'font-size: 14px; font-weight: bold; color: #2196F3');

  // Check 1: localStorage event data
  try {
    const selectedEvent = localStorage.getItem('selectedEvent');
    if (selectedEvent) {
      const eventObj = JSON.parse(selectedEvent);
      results.frontend.hasSelectedEvent = true;
      results.frontend.eventHasLeagueId = !!eventObj.league_id;
      results.frontend.eventData = {
        id: eventObj.id,
        name: eventObj.name,
        league_id: eventObj.league_id,
        drillTemplate: eventObj.drillTemplate
      };
      
      console.log('✅ selectedEvent exists in localStorage');
      console.log('   league_id present:', !!eventObj.league_id ? '✅' : '❌');
      console.log('   Event data:', results.frontend.eventData);
    } else {
      results.frontend.hasSelectedEvent = false;
      console.log('⚠️  No selectedEvent in localStorage (may be on login page)');
    }
  } catch (e) {
    results.frontend.eventParseError = e.message;
    console.error('❌ Error parsing selectedEvent:', e);
  }

  // Check 2: League selection
  try {
    const selectedLeagueId = localStorage.getItem('selectedLeagueId');
    results.frontend.selectedLeagueId = selectedLeagueId;
    
    if (selectedLeagueId) {
      console.log('✅ selectedLeagueId:', selectedLeagueId);
      
      // Check if event and league IDs match
      if (results.frontend.eventData?.league_id) {
        const match = results.frontend.eventData.league_id === selectedLeagueId;
        results.frontend.leagueIdMatch = match;
        console.log('   Event/League ID match:', match ? '✅' : '❌ MISMATCH!');
        
        if (!match) {
          console.warn('⚠️  WARNING: Event league_id does not match selectedLeagueId!');
          console.warn('   Event league:', results.frontend.eventData.league_id);
          console.warn('   Selected league:', selectedLeagueId);
        }
      }
    } else {
      console.log('⚠️  No selectedLeagueId (may be on login page)');
    }
  } catch (e) {
    results.frontend.leagueCheckError = e.message;
    console.error('❌ Error checking league:', e);
  }

  // Check 3: User role and auth state
  try {
    const userRole = localStorage.getItem('userRole');
    results.frontend.userRole = userRole;
    console.log('✅ User role:', userRole || 'Not set');
  } catch (e) {
    console.log('⚠️  Could not read user role');
  }

  console.log('---');

  // ============================================
  // BACKEND API CHECKS
  // ============================================
  console.log('%c🖥️  Backend API Checks', 'font-size: 14px; font-weight: bold; color: #2196F3');
  console.log('⚠️  To test backend response shape, create a new event and check Network tab');
  console.log('   Look for POST /leagues/{id}/events');
  console.log('   Response should include BOTH:');
  console.log('   • event_id: "..."');
  console.log('   • event: { id, league_id, ... }');
  console.log('---');

  // ============================================
  // ISSUE DETECTION
  // ============================================
  console.log('%c🐛 Issue Detection', 'font-size: 14px; font-weight: bold; color: #FF9800');

  const issues = [];

  if (results.frontend.hasSelectedEvent && !results.frontend.eventHasLeagueId) {
    issues.push({
      severity: 'HIGH',
      issue: 'Event missing league_id',
      description: 'Selected event does not have league_id field',
      impact: 'May cause "Create League" redirect when creating second event',
      fix: 'Clear localStorage and re-create events, or wait for backend deployment'
    });
  }

  if (results.frontend.leagueIdMatch === false) {
    issues.push({
      severity: 'CRITICAL',
      issue: 'League/Event ID mismatch',
      description: 'Event belongs to different league than currently selected',
      impact: 'EventContext will clear the event, causing UX issues',
      fix: 'Clear localStorage or select the correct league'
    });
  }

  if (issues.length === 0) {
    console.log('✅ No issues detected in frontend state');
  } else {
    console.log(`❌ Found ${issues.length} issue(s):`);
    issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. [${issue.severity}] ${issue.issue}`);
      console.log(`   Description: ${issue.description}`);
      console.log(`   Impact: ${issue.impact}`);
      console.log(`   Fix: ${issue.fix}`);
    });
  }

  console.log('---');

  // ============================================
  // OVERALL ASSESSMENT
  // ============================================
  console.log('%c📊 Overall Assessment', 'font-size: 14px; font-weight: bold; color: #9C27B0');

  if (issues.length === 0 && results.frontend.eventHasLeagueId) {
    results.overall = 'PASS';
    console.log('%c✅ FRONTEND STATE: PASS', 'color: #4CAF50; font-weight: bold');
    console.log('   All frontend checks passed. Event has league_id.');
  } else if (issues.length > 0) {
    results.overall = 'FAIL';
    console.log('%c❌ FRONTEND STATE: FAIL', 'color: #F44336; font-weight: bold');
    console.log(`   ${issues.length} issue(s) detected.`);
  } else {
    results.overall = 'INCOMPLETE';
    console.log('%c⚠️  FRONTEND STATE: INCOMPLETE', 'color: #FF9800; font-weight: bold');
    console.log('   Not enough data to assess (may need to login/select event).');
  }

  console.log('\n%c📋 Next Steps:', 'font-weight: bold');
  console.log('1. Test backend by creating a new event and checking Network tab');
  console.log('2. Verify response includes both event_id AND event object');
  console.log('3. Create multiple events and ensure no "Create League" redirect');
  console.log('4. See VERIFY_LEAGUE_EVENT_FIX.md for detailed testing guide');

  console.log('\n%c🔍 Full Results:', 'font-weight: bold');
  console.table(results.frontend);

  return results;
})();

