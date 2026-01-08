# Production Verification Script

**Run this in production to verify drag-and-drop deployment**

---

## Step 0: Verify Production Build SHA

### In Browser Console:

```javascript
// Check current build version
console.log('Build SHA:', window.__WOOCOMBINE_BUILD__?.sha);
console.log('Build Time:', window.__WOOCOMBINE_BUILD__?.timestamp);
console.log('Expected SHA:', '76555e3' || later);

// Verify the v3 capture-phase handlers are present
console.log('Bundle includes v3 dropzone:', 
  document.querySelector('[data-dropzone="player-upload"]') !== null
);

// Check for telemetry function
console.log('Telemetry available:', 
  window.__WOOCOMBINE_BUILD__ !== undefined
);
```

**Expected Output:**
```
Build SHA: "76555e3" (or later commit)
Build Time: "2026-01-08T..." 
Expected SHA: true
Bundle includes v3 dropzone: true
Telemetry available: true
```

---

## Step 1: Check for Caching Issues

### Clear All Caches:

1. **Hard Refresh:**
   - Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
   - Safari: `Cmd+Option+E` then `Cmd+R`

2. **Clear Browser Cache:**
   ```
   Chrome: Settings → Privacy → Clear browsing data → Cached images and files
   Safari: Develop → Empty Caches
   ```

3. **Check Network Tab:**
   - Open DevTools → Network
   - Refresh page
   - Look for `index-*.js` file
   - Verify timestamp in filename matches recent build: `1767902993674` or later

4. **Verify No Service Worker:**
   ```javascript
   // In console
   navigator.serviceWorker.getRegistrations().then(registrations => {
     console.log('Service Workers:', registrations.length);
     if (registrations.length > 0) {
       console.warn('Service worker detected! Unregister:');
       registrations.forEach(r => r.unregister());
     }
   });
   ```

---

## Step 2: Verify Dropzone is Mounted

### In Production Console:

```javascript
// Navigate to: /admin#player-upload-section
// Then run:

// 1. Check dropzone element
const dropzone = document.querySelector('[data-dropzone="player-upload"]');
console.log('Dropzone found:', dropzone !== null);
console.log('Dropzone rect:', dropzone?.getBoundingClientRect());
console.log('Dropzone visible:', dropzone?.offsetWidth > 0 && dropzone?.offsetHeight > 0);

// 2. Check for overlays
const computed = dropzone ? window.getComputedStyle(dropzone) : null;
console.log('Dropzone z-index:', computed?.zIndex);
console.log('Dropzone pointer-events:', computed?.pointerEvents);
console.log('Dropzone position:', computed?.position);

// 3. Check for version indicator
console.log('Version indicator visible:', 
  dropzone?.querySelector('.absolute.top-1.right-1')?.textContent
);

// 4. Look for mounted telemetry
// Open DevTools → Console → Filter for "[DRAG-TELEMETRY]"
// Should see: "[DRAG-TELEMETRY] dropzone-mounted"
```

**Expected Output:**
```
Dropzone found: true
Dropzone rect: DOMRect {x: 24, y: 850, width: 560, height: 172, top: 850, right: 584, bottom: 1022, left: 24}
Dropzone visible: true
Dropzone z-index: "1"
Dropzone pointer-events: "auto"
Dropzone position: "relative"
Version indicator visible: "v3-76555e3" (or similar)
```

---

## Step 3: Capture Real Drag Telemetry

### Test Drag-and-Drop with Telemetry:

1. **Open DevTools Console**
2. **Filter for: `[DRAG-TELEMETRY]`**
3. **Drag a CSV file over the dropzone**
4. **Watch for telemetry events**

**Expected Console Output:**
```
[DRAG-TELEMETRY] window-handlers-mounted: {
  event: "window-handlers-mounted",
  timestamp: "2026-01-08T...",
  buildSHA: "76555e3",
  buildTime: "2026-01-08T...",
  userAgent: "Mozilla/5.0 ...",
  route: "/admin",
  hash: "#player-upload-section"
}

[DRAG-TELEMETRY] dropzone-mounted: {
  event: "dropzone-mounted",
  version: "v3-capture-phase",
  buildSHA: "76555e3",
  dimensions: {width: 560, height: 172, ...},
  visible: true,
  zIndex: "1",
  pointerEvents: "auto"
}

// When dragging:
[DRAG-TELEMETRY] dragenter: {
  event: "dragenter",
  counter: 1,
  target: "DIV",
  currentTarget: "...",
  defaultPrevented: true
}

[DRAG-TELEMETRY] dragenter: {
  counter: 2,
  target: "BUTTON",
  ...
}

// When dropping:
[DRAG-TELEMETRY] drop: {
  event: "drop",
  target: "DIV",
  defaultPrevented: true,
  filesLength: 1,
  fileDetails: {
    name: "players.csv",
    type: "text/csv",
    size: 2048
  }
}

[DRAG-TELEMETRY] drop-success: {
  event: "drop-success",
  fileName: "players.csv"
}

[DRAG-TELEMETRY] csv-parsed: {
  event: "csv-parsed",
  rowCount: 25,
  headerCount: 5
}
```

---

## Step 4: Verify Sentry Breadcrumbs

### Check Sentry Integration:

```javascript
// In console
Sentry.getCurrentHub().getIntegration('Breadcrumbs') !== undefined
```

If drag-and-drop fails, check Sentry dashboard for breadcrumbs:
- Category: `drag-drop`
- Should contain all telemetry events

---

## Step 5: Browser Matrix Testing

### Test in Each Browser:

| Browser | OS | Test Result | Events Fired | Notes |
|---------|----|----|--------------|-------|
| Chrome | macOS | ☐ | ☐ dragenter ☐ drop | |
| Safari | macOS | ☐ | ☐ dragenter ☐ drop | |
| Firefox | macOS | ☐ | ☐ dragenter ☐ drop | |
| Chrome | Windows | ☐ | ☐ dragenter ☐ drop | |
| Edge | Windows | ☐ | ☐ dragenter ☐ drop | |

### For Each Browser:

1. Clear cache
2. Navigate to `/admin#player-upload-section`
3. Open DevTools Console
4. Filter for `[DRAG-TELEMETRY]`
5. Drag a CSV file
6. Document which events fire
7. Check if `defaultPrevented` is `true` on drop

---

## Step 6: Diagnose Failures

### If Drag-and-Drop Still Fails:

#### A) No Telemetry at All
**Diagnosis:** Old bundle still cached
**Fix:** 
- Clear CDN cache (if applicable)
- Check Network tab for old bundle timestamp
- Verify `index.html` is not cached

#### B) Dragenter Fires, Drop Doesn't
**Diagnosis:** Something blocking drop event
**Fix:**
```javascript
// Check for overlays
document.elementsFromPoint(x, y) // where x,y is drop point
// Should show dropzone div, not something else
```

#### C) Drop Fires, defaultPrevented = false
**Diagnosis:** preventDefault not being called
**Fix:**
```javascript
// Verify capture handlers
dropzone.addEventListener('drop', e => console.log('Drop capture:', e), true);
```

#### D) Drop Fires, But No Files
**Diagnosis:** DataTransfer not working
**Fix:**
```javascript
// Check dataTransfer
dropzone.addEventListener('drop', e => {
  console.log('Files:', e.dataTransfer.files);
  console.log('Items:', e.dataTransfer.items);
}, true);
```

---

## Step 7: Production CDN Cache Purge

### If Using Netlify:

1. Go to: https://app.netlify.com/sites/[your-site]/deploys
2. Find latest deploy (should be commit `76555e3` or later)
3. Click "Publish deploy"
4. Wait 30 seconds
5. Hard refresh browser

### If Using Cloudflare:

1. Go to: Caching → Configuration
2. Click "Purge Everything"
3. Wait 30 seconds
4. Hard refresh browser

---

## Acceptance Criteria Checklist

- [ ] Build SHA in console matches latest commit (`76555e3` or later)
- [ ] Dropzone element has `data-dropzone="player-upload"` attribute
- [ ] Version indicator shows `v3-[commit-sha]` in top-right
- [ ] `[DRAG-TELEMETRY] dropzone-mounted` appears in console
- [ ] Dragging CSV shows `[DRAG-TELEMETRY] dragenter` events
- [ ] Dropping CSV shows `[DRAG-TELEMETRY] drop` event with filesLength: 1
- [ ] `defaultPrevented: true` in all drag events
- [ ] CSV processes successfully after drop
- [ ] Works in Safari macOS (user's primary browser)
- [ ] Works in at least one Windows browser
- [ ] Telemetry captured in Sentry dashboard

---

## Emergency Rollback

If v3 makes things worse:

```bash
git revert 76555e3..HEAD
npm run build
git push
```

Then investigate why capture-phase handlers didn't work in production.

---

## Report Template

When reporting back, include:

```
Browser: [Chrome/Safari/Firefox/Edge]
OS: [macOS/Windows] version
Build SHA: [from console]
Dropzone visible: [yes/no]
Telemetry events seen: [list]
defaultPrevented on drop: [true/false]
Drop success: [yes/no]
Error messages: [any]
```

