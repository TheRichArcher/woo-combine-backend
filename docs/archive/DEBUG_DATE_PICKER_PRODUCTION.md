# Event Date Picker Debug Guide - Production Troubleshooting

## Status
**Debug logging deployed:** Commit cc19487  
**Deployed to:** woo-combine.com (rendering now, ~2-3 min)

---

## Rich - Please Run These Tests

Once Render finishes deploying (check your dashboard), follow these steps **exactly**:

### **Step 1: Open Browser Console**
1. Open woo-combine.com in **Incognito/Private mode** (clears cache)
2. Open DevTools → **Console tab**
3. Clear console (to see fresh logs only)

### **Step 2: Open Edit Event Modal**
1. Navigate to `/admin` → Event Setup
2. Click **"Edit Event Details"**
3. **Check console logs** - you should see:

```javascript
[EventFormModal] useEffect triggered - open: true, mode: "edit", event: {Object}
[EventFormModal] Initializing EDIT mode with event.date: "2026-01-15"
[EventFormModal] Setting date to: "2026-01-15"
[EventFormModal] Date state changed: "2026-01-15"
```

**If you DON'T see these logs**, the modal isn't rendering EventFormModal (different component issue).

### **Step 3: Select a Date**
1. Click the calendar icon
2. Select **January 31, 2026**
3. **Watch console** - you should see:

```javascript
[EventFormModal] Date onInput fired. New value: "2026-01-31"
[EventFormModal] Date onChange fired. New value: "2026-01-31"
[EventFormModal] Date state changed: "2026-01-31"
```

**If you DON'T see these logs**, the calendar picker is disconnected from the input.

### **Step 4: Check for Overwrites**
After selecting date, **watch for additional logs**:

```javascript
// ❌ BAD - if you see this AFTER your selection:
[EventFormModal] useEffect triggered - open: true, mode: "edit", event: {Object}
[EventFormModal] Setting date to: ""  // or old date
[EventFormModal] Date state changed: ""  // Value overwritten!
```

**If you see this**, the useEffect is still firing and overwriting your selection.

---

## **What to Look For in Console**

### **Scenario A: No onChange Events**
```
// You select date, but console shows NOTHING
// (No "onChange fired" or "onInput fired" messages)
```

**Diagnosis:** Calendar picker not wired to input  
**Likely cause:** Browser extension, CSS interference, or wrong input element

**Fix needed:** Inspect actual DOM element

### **Scenario B: onChange Fires But Value Resets**
```
[EventFormModal] Date onChange fired. New value: "2026-01-31"  ✅
[EventFormModal] Date state changed: "2026-01-31"              ✅
[EventFormModal] useEffect triggered - open: true...           ❌
[EventFormModal] Setting date to: ""                            ❌
[EventFormModal] Date state changed: ""                         ❌
```

**Diagnosis:** useEffect race condition still happening  
**Likely cause:** Dependencies issue with `event?.id`

**Fix needed:** Adjust useEffect dependencies

### **Scenario C: onChange Fires With Wrong Value**
```
[EventFormModal] Date onChange fired. New value: ""  // Empty!
```

**Diagnosis:** Browser returning empty value from date picker  
**Likely cause:** Date format incompatibility or browser bug

**Fix needed:** Use different date picker library

---

## **Step 5: Inspect DOM Element**

While modal is open, in DevTools **Elements tab**:

1. Find the Event Date input field
2. Inspect its attributes
3. **Copy** the entire element HTML

**Expected:**
```html
<input 
  type="date" 
  value="2026-01-15"  <!-- Should show YYYY-MM-DD -->
  required 
  class="w-full border..."
>
```

**Red flags:**
```html
<!-- ❌ BAD: No value attribute -->
<input type="date" value="" required>

<!-- ❌ BAD: Wrong type -->
<input type="text" value="2026-01-15" required>

<!-- ❌ BAD: Disabled/readonly -->
<input type="date" value="2026-01-15" disabled>
<input type="date" value="2026-01-15" readonly>

<!-- ❌ BAD: Wrong format -->
<input type="date" value="01/15/2026" required>  <!-- Browser rejects -->
```

**Send me the actual HTML you see.**

---

## **Step 6: Network Tab Test**

1. Select a date (Jan 31)
2. Click **"Save Changes"**
3. DevTools → **Network tab**
4. Find the **PUT request** to `/leagues/{id}/events/{id}`
5. Click it → **Payload tab**

**Expected payload:**
```json
{
  "name": "Football Combine Beta 3.1",
  "date": "2026-01-31",  // ← Should have the selected date
  "location": "...",
  "notes": "...",
  "drillTemplate": "football"
}
```

**If date is empty/null:**
```json
{
  "name": "Football Combine Beta 3.1",
  "date": null,  // ❌ Your selection didn't reach state
  ...
}
```

This tells us whether it's a **UI issue** (state not updating) or **state → submission** issue.

---

## **Step 7: Manual Console Test**

With modal open, paste this in console:

```javascript
// Test 1: Check React state
const input = document.querySelector('input[type="date"]');
console.log('Input element:', input);
console.log('Input value:', input?.value);
console.log('Input required:', input?.required);
console.log('Input disabled:', input?.disabled);
console.log('Input readOnly:', input?.readOnly);

// Test 2: Manually set value
if (input) {
  input.value = "2026-01-31";
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  console.log('After manual set, value is:', input.value);
}
```

**Expected output:**
```
Input element: <input type="date" ...>
Input value: "2026-01-15"  (or whatever is set)
Input required: true
Input disabled: false
Input readOnly: false
After manual set, value is: "2026-01-31"
```

**Watch console for our debug logs** after running this. If logs appear, React is wired correctly. If not, there's a DOM/React mismatch.

---

## **Report Back With:**

1. **Console logs** when you:
   - Open modal
   - Select a date
   - After selection (check for overwrites)

2. **DOM element HTML** from Elements tab

3. **Network payload** from Save Changes request

4. **Manual test results** from Step 7

5. **Screenshots** of:
   - Console logs
   - Elements inspector showing input
   - Network request payload

This will definitively tell us whether:
- ❌ Events not firing (picker disconnected)
- ❌ Value being overwritten by useEffect
- ❌ Wrong input type/attributes
- ❌ Browser-specific issue
- ❌ Something else entirely

---

## **If It Still Doesn't Work**

If after these debug steps the issue persists, we'll need to:

1. **Check for browser extensions** interfering (test in clean profile)
2. **Check for CSS** hiding/overlaying the real input
3. **Consider alternative date picker** (react-datepicker library)
4. **Check EventFormModal parent** for conflicting state management

But the debug logs should show us exactly where it's breaking.

---

## **Temporary Workaround**

If you need to set a date immediately while we debug:

1. Open Edit Event modal
2. Open DevTools console
3. Paste:

```javascript
const input = document.querySelector('input[type="date"]');
input.value = "2026-01-31";  // Your desired date
input.dispatchEvent(new Event('input', { bubbles: true }));
input.dispatchEvent(new Event('change', { bubbles: true }));
```

4. Click "Save Changes"

This manually sets the date and triggers React's onChange.

---

**Debug logs are deployed now - please run these tests and send me the results!**

I'll be able to pinpoint the exact issue once I see the console output and DOM inspection.

