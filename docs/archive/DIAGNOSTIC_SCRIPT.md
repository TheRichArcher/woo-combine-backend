# Event Date Picker - Quick Diagnostic Script

Rich - Please copy this entire script into your browser console while the Edit Event modal is open:

```javascript
// ==========================================
// COMPREHENSIVE DATE PICKER DIAGNOSTIC
// ==========================================

console.clear();
console.log('=== DATE PICKER DIAGNOSTIC START ===\n');

// 1. Find the date input
const dateInput = document.querySelector('input[type="date"]') || 
                  document.querySelector('input[name*="date"]') ||
                  Array.from(document.querySelectorAll('input')).find(i => 
                    i.placeholder?.toLowerCase().includes('date') ||
                    i.id?.toLowerCase().includes('date')
                  );

if (!dateInput) {
  console.error('❌ NO DATE INPUT FOUND!');
  console.log('All inputs on page:', document.querySelectorAll('input'));
} else {
  console.log('✅ DATE INPUT FOUND');
  console.log('Element:', dateInput);
  console.log('Type:', dateInput.type);
  console.log('Value:', `"${dateInput.value}"`);
  console.log('Required:', dateInput.required);
  console.log('Disabled:', dateInput.disabled);
  console.log('ReadOnly:', dateInput.readOnly);
  console.log('Placeholder:', dateInput.placeholder);
  console.log('ClassName:', dateInput.className);
  
  // 2. Check for overlay blocking clicks
  const rect = dateInput.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const elementAtCenter = document.elementFromPoint(centerX, centerY);
  
  console.log('\n=== OVERLAY CHECK ===');
  console.log('Input bounding box:', {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height
  });
  console.log('Element at center point:', elementAtCenter);
  console.log('Is same as input?', elementAtCenter === dateInput);
  
  if (elementAtCenter !== dateInput) {
    console.error('❌ OVERLAY DETECTED!');
    console.log('Overlay element:', {
      tag: elementAtCenter.tagName,
      class: elementAtCenter.className,
      id: elementAtCenter.id,
      zIndex: window.getComputedStyle(elementAtCenter).zIndex,
      pointerEvents: window.getComputedStyle(elementAtCenter).pointerEvents
    });
  } else {
    console.log('✅ No overlay - clicks should reach input');
  }
  
  // 3. Check input styles
  const styles = window.getComputedStyle(dateInput);
  console.log('\n=== INPUT STYLES ===');
  console.log('Display:', styles.display);
  console.log('Visibility:', styles.visibility);
  console.log('Opacity:', styles.opacity);
  console.log('Pointer-events:', styles.pointerEvents);
  console.log('Z-index:', styles.zIndex);
  console.log('Position:', styles.position);
  
  // 4. Attach event listeners
  console.log('\n=== ATTACHING EVENT LISTENERS ===');
  
  let eventsFired = false;
  
  dateInput.addEventListener('click', (e) => {
    console.log('🖱️  CLICK event on input');
    eventsFired = true;
  });
  
  dateInput.addEventListener('focus', (e) => {
    console.log('🎯 FOCUS event on input');
    eventsFired = true;
  });
  
  dateInput.addEventListener('input', (e) => {
    console.log('⌨️  INPUT event - value:', `"${e.target.value}"`);
    eventsFired = true;
  });
  
  dateInput.addEventListener('change', (e) => {
    console.log('✏️  CHANGE event - value:', `"${e.target.value}"`);
    eventsFired = true;
  });
  
  console.log('✅ Listeners attached');
  console.log('\n👉 NOW: Click the calendar icon and select a date');
  console.log('👉 Watch for event logs above');
  
  // 5. Test manual value setting
  setTimeout(() => {
    if (!eventsFired) {
      console.log('\n⚠️  NO EVENTS FIRED AFTER 10 SECONDS');
      console.log('Running manual value test...\n');
      
      const testValue = '2026-01-31';
      console.log(`Setting value to: "${testValue}"`);
      dateInput.value = testValue;
      console.log('Value after set:', `"${dateInput.value}"`);
      
      console.log('Dispatching input event...');
      dateInput.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log('Dispatching change event...');
      dateInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      setTimeout(() => {
        console.log('Value after 1 second:', `"${dateInput.value}"`);
        
        if (dateInput.value === testValue) {
          console.log('✅ Manual set WORKED - value persisted');
          console.log('❌ But calendar picker is not working');
          console.log('🔧 Likely cause: Calendar picker not wired to input');
        } else {
          console.log('❌ Manual set FAILED - value was reset');
          console.log('🔧 Likely cause: React state overwriting value');
        }
      }, 1000);
    }
  }, 10000);
  
  // 6. Check React component info
  console.log('\n=== REACT COMPONENT INFO ===');
  const reactKey = Object.keys(dateInput).find(key => key.startsWith('__react'));
  if (reactKey) {
    const reactData = dateInput[reactKey];
    console.log('Has React data:', !!reactData);
    console.log('onChange handler:', typeof reactData?.memoizedProps?.onChange);
    console.log('value prop:', reactData?.memoizedProps?.value);
  } else {
    console.log('⚠️  No React data found on input');
  }
}

console.log('\n=== DATE PICKER DIAGNOSTIC END ===');
console.log('Run this again after clicking a date to see if events fire.');
```

## Copy this entire block into your browser console, then:

1. **Immediately** you'll see diagnostic info
2. **Click a date** in the calendar picker
3. **Watch console** for event logs
4. **After 10 seconds** if no events fire, it will auto-test manual value setting

## What to send me:

**Screenshot of the entire console output** - this will tell us exactly what's wrong.

The script will identify:
- ✅ If input exists and is configured correctly
- ✅ If there's an overlay blocking clicks
- ✅ If events fire when you click a date
- ✅ If manual value setting works
- ✅ If React is wired correctly

This single diagnostic will pinpoint the exact issue.

