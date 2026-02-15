# Cloud Sync Setup (Free) via Google Apps Script

Use this to make Saved Jobs shared across employee and owner devices.

## 1) Create script
1. Open [https://script.google.com](https://script.google.com)
2. New Project
3. Replace code with:

```javascript
const STORE_KEY = 'job_costing_store';
const SYNC_KEY = 'CHANGE_ME_TO_A_SHARED_SECRET';

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || '{}');
    if (!body || body.key !== SYNC_KEY) return json({ error: 'unauthorized' }, 401);

    const incoming = Array.isArray(body.jobs) ? body.jobs : [];
    const props = PropertiesService.getScriptProperties();
    const current = JSON.parse(props.getProperty(STORE_KEY) || '[]');

    const merged = mergeJobs(current, incoming);
    props.setProperty(STORE_KEY, JSON.stringify(merged));
    return json({ jobs: merged }, 200);
  } catch (err) {
    return json({ error: 'bad_request' }, 400);
  }
}

function mergeJobs(a, b) {
  const map = {};
  [...a, ...b].forEach(job => {
    if (!job || !job.jobId) return;
    const existing = map[job.jobId];
    if (!existing) {
      map[job.jobId] = job;
      return;
    }
    const tExisting = Date.parse(existing.updatedAt || existing.createdDate || 0);
    const tIncoming = Date.parse(job.updatedAt || job.createdDate || 0);
    map[job.jobId] = tIncoming >= tExisting ? job : existing;
  });
  return Object.values(map).sort((x, y) => Date.parse(y.createdDate || 0) - Date.parse(x.createdDate || 0));
}

function json(obj, status) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## 2) Deploy web app
1. `Deploy` -> `New deployment`
2. Type: `Web app`
3. Execute as: `Me`
4. Who has access: `Anyone`
5. Deploy and copy the Web App URL

## 3) Configure PWA settings on each device
In app `Settings` tab:
- `Sync Endpoint URL`: paste Web App URL
- `Sync Key`: same key you set in script (`SYNC_KEY`)

## 4) Use it
- Tap `Sync Cloud` in Saved Jobs tab any time.
- `Calculate` also attempts an automatic sync.

## Notes
- All devices must use the same endpoint + key.
- This stores only saved job records (not in-progress draft).
