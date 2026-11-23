/**
 * Bulk-transfer ownership of everything you own in My Drive:
 * folders and files of every type (Google Docs/Sheets/Slides/Forms, PDFs,
 * Office files, images, etc.).
 *
 * Menu "Drive Transfer":
 *   1. List everything I own      → fills the "Drive Ownership Transfer" tab
 *                                   (folders first, then files, with folder path)
 *   2. Transfer ownership         → for each row with an email in "New owner email":
 *                                   adds them as editor (if not already), then makes them owner
 *   3. Move items marked "Delete" to Trash
 *   Fill new owner for selected rows  → type one email, fills every selected visible row
 *   Build name → email lookup     → for @ chips that show a name instead of an email
 *
 * Notes
 * - Transferring a FOLDER transfers only the folder itself, not what's inside.
 *   Every file and subfolder is its own row, so give each the new owner's email
 *   (filter by "Folder path", select the rows, and use "Fill new owner for selected rows").
 * - Every step stops safely before Apps Script's 6-minute limit. If you see
 *   "run again to continue", run the same menu item again; it picks up where it left off.
 * - Blank email = skipped. "Done", "Delete" and "Trashed" rows are never transferred again.
 */

const SHEET_NAME = 'Drive Ownership Transfer';
const HEADERS = ['Name', 'Type', 'Folder path', 'ID', 'URL', 'Last updated', 'New owner email', 'Status', 'Notes'];
const COL = { NAME: 1, TYPE: 2, PATH: 3, ID: 4, URL: 5, UPDATED: 6, EMAIL: 7, STATUS: 8, NOTES: 9 };
const TIME_LIMIT_MS = 5 * 60 * 1000; // stop at 5 minutes to stay under the 6-minute cap
const QUERY = "'me' in owners and trashed = false";
const PHASE_KEY = 'DRIVE_LIST_PHASE';
const TOKEN_KEY = 'DRIVE_LIST_TOKEN';
const LOOKUP_SHEET = 'Name lookup';
const EMAIL_RE = /[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+/;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Drive Transfer')
    .addItem('1. List everything I own', 'listMyDrive')
    .addItem('2. Transfer ownership', 'transferOwnership')
    .addItem('3. Move items marked "Delete" to Trash', 'trashMarkedItems')
    .addSeparator()
    .addItem('Check the list is complete', 'verifyListing')
    .addItem('Fill new owner for selected rows', 'fillOwnerForSelection')
    .addItem('Build name → email lookup (for @ chips)', 'buildNameLookup')
    .addSeparator()
    .addItem('Restart listing from scratch', 'resetListing')
    .addToUi();
}

/* ───────────────────────── Step 1: list ───────────────────────── */

function listMyDrive() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getUserProperties();
  let phase = props.getProperty(PHASE_KEY);
  let token = props.getProperty(TOKEN_KEY);
  let sh = ss.getSheetByName(SHEET_NAME);

  if (!phase || !sh) { // fresh start
    if (sh && sh.getLastRow() > 1) {
      // Listing already finished earlier: don't wipe emails/statuses without asking.
      let proceed = false;
      try {
        const ui = SpreadsheetApp.getUi();
        proceed = ui.alert('Listing is already complete',
          `The tab already has ${sh.getLastRow() - 1} items, so the earlier listing finished.\n\n` +
          'Click OK only if you want to WIPE the tab (including emails and statuses) and list again from scratch. ' +
          'Otherwise click Cancel.', ui.ButtonSet.OK_CANCEL) === ui.Button.OK;
      } catch (e) {
        console.log('Listing already complete; nothing done. Use "Restart listing from scratch" to start over.');
      }
      if (!proceed) return;
    }
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    sh.clear();
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    phase = 'folders';
    token = null;
  }

  const start = Date.now();
  const thisId = ss.getId();
  ss.toast('Listing your Drive… watch the progress box in the top-right of the tab.', 'Drive Transfer', 15);
  progress_(sh, `⏳ Listing ${phase}… ${sh.getLastRow() - 1} items so far`);
  const pathCache = {};

  while (phase) {
    const isFolders = phase === 'folders';
    const it = token
      ? (isFolders ? DriveApp.continueFolderIterator(token) : DriveApp.continueFileIterator(token))
      : (isFolders ? DriveApp.searchFolders(QUERY) : DriveApp.searchFiles(QUERY));
    const rows = [];

    while (it.hasNext()) {
      if (Date.now() - start > TIME_LIMIT_MS) {
        writeRows_(sh, rows);
        props.setProperty(PHASE_KEY, phase);
        props.setProperty(TOKEN_KEY, it.getContinuationToken());
        progress_(sh, `⏸ Paused at ${sh.getLastRow() - 1} items. Run "1. List everything I own" again to continue.`);
        notify_(`Listed ${sh.getLastRow() - 1} items so far. Run "1. List everything I own" again to continue.`,
          'Not finished yet', 10);
        return;
      }
      const item = it.next();
      if (item.getId() === thisId) continue; // skip this control spreadsheet
      rows.push(rowFor_(item, isFolders, pathCache));
      if (rows.length >= 100) {
        writeRows_(sh, rows); rows.length = 0;
        progress_(sh, `⏳ Listing ${phase}… ${sh.getLastRow() - 1} items so far`);
      }
    }
    writeRows_(sh, rows);
    token = null;
    phase = isFolders ? 'files' : null;
    if (phase) { props.setProperty(PHASE_KEY, phase); props.deleteProperty(TOKEN_KEY); }
  }

  props.deleteProperty(PHASE_KEY);
  props.deleteProperty(TOKEN_KEY);
  sh.autoResizeColumns(1, HEADERS.length);
  progress_(sh, `✅ Listing complete: ${sh.getLastRow() - 1} items`);
  notify_(`Done: ${sh.getLastRow() - 1} items listed. Now fill in "New owner email".`, 'Listing complete', 10);
}

function resetListing() {
  const props = PropertiesService.getUserProperties();
  props.deleteProperty(PHASE_KEY);
  props.deleteProperty(TOKEN_KEY);
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (sh) sh.clear(); // "Restart" is an explicit choice, so no extra confirmation
  listMyDrive();
}

function writeRows_(sh, rows) {
  if (!rows.length) return;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
}

function rowFor_(item, isFolder, cache) {
  let type = 'Folder', path = '';
  if (!isFolder) {
    try { type = friendlyType_(item.getMimeType()); } catch (e) { type = 'Unknown'; }
  }
  try {
    const parents = item.getParents();
    path = parents.hasNext() ? folderPath_(parents.next(), cache) : '(not in any folder)';
  } catch (e) {
    path = '(unknown)';
  }
  return [item.getName(), type, path, item.getId(), item.getUrl(), item.getLastUpdated(), '', '', ''];
}

/** Full path of a folder, e.g. "My Drive / Projects / 2026". Cached per run. */
function folderPath_(folder, cache) {
  const id = folder.getId();
  if (cache[id] !== undefined) return cache[id];
  let path;
  try {
    const parents = folder.getParents();
    path = parents.hasNext() ? folderPath_(parents.next(), cache) + ' / ' + folder.getName() : folder.getName();
  } catch (e) {
    path = folder.getName();
  }
  cache[id] = path;
  return path;
}

function friendlyType_(mime) {
  const map = {
    'application/vnd.google-apps.document': 'Google Doc',
    'application/vnd.google-apps.spreadsheet': 'Google Sheet',
    'application/vnd.google-apps.presentation': 'Google Slides',
    'application/vnd.google-apps.form': 'Google Form',
    'application/vnd.google-apps.drawing': 'Google Drawing',
    'application/vnd.google-apps.script': 'Apps Script',
    'application/vnd.google-apps.site': 'Google Site',
    'application/vnd.google-apps.jam': 'Jamboard',
    'application/vnd.google-apps.shortcut': 'Shortcut',
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/msword': 'Word',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
    'application/vnd.ms-excel': 'Excel',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
    'application/vnd.ms-powerpoint': 'PowerPoint',
    'text/csv': 'CSV',
    'text/plain': 'Text',
    'application/zip': 'ZIP'
  };
  if (map[mime]) return map[mime];
  const [kind, sub] = String(mime).split('/');
  if (['image', 'video', 'audio'].includes(kind)) return kind.charAt(0).toUpperCase() + kind.slice(1) + ' (' + sub + ')';
  return mime;
}

function getItem_(id, type) {
  return type === 'Folder' ? DriveApp.getFolderById(id) : DriveApp.getFileById(id);
}

/* ───────────────────────── Step 2: transfer ───────────────────────── */

function transferOwnership() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run "1. List everything I own" first.');

  const data = sh.getDataRange().getValues();
  const richEmails = sh.getRange(1, COL.EMAIL, data.length, 1).getRichTextValues();
  const lookup = loadLookup_();
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const start = Date.now();
  let done = 0, failed = 0;
  ss.toast('Transferring… watch the progress box in the top-right of the tab.', 'Drive Transfer', 15);
  progress_(sh, '⏳ Transferring… starting');

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = String(row[COL.STATUS - 1]).trim();
    if (status === 'Done' || isDeleteStatus_(status)) continue;
    const email = extractEmail_(row[COL.EMAIL - 1], richEmails[i][0], lookup);
    if (!email) continue;

    if (Date.now() - start > TIME_LIMIT_MS) {
      progress_(sh, `⏸ Paused: ${done} transferred, ${failed} errors this run. Run "2. Transfer ownership" again.`);
      notify_(`${done} transferred, ${failed} errors so far. Run "2. Transfer ownership" again to continue.`,
        'Not finished yet', 10);
      return;
    }

    const r = i + 1;
    try {
      if (!EMAIL_RE.test(email)) {
        throw new Error('Could not read an email from "' + email + '". If this is an @ chip, select the email column, right-click → Remove smart chip ' +
          'so it shows the email, then run the transfer again. Or type the email as plain text.');
      }
      if (email === me) throw new Error('That is your own email');

      const item = getItem_(row[COL.ID - 1], row[COL.TYPE - 1]);
      const alreadyEditor = item.getEditors().some(u => u.getEmail().toLowerCase() === email);
      if (!alreadyEditor) item.addEditor(email); // step A: edit access
      item.setOwner(email);                       // step B: ownership (you stay on as editor)

      const note = (alreadyEditor ? 'Was already an editor. ' : 'Edit access added. ') +
        'Transferred ' + new Date().toLocaleString();
      sh.getRange(r, COL.STATUS, 1, 2).setValues([['Done', note]]);
      done++;
    } catch (e) {
      sh.getRange(r, COL.STATUS, 1, 2).setValues([['Error', e.message]]);
      failed++;
    }
    if ((done + failed) % 5 === 0) progress_(sh, `⏳ Transferring… ${done} done, ${failed} errors (row ${r})`);
  }

  progress_(sh, `✅ Transfer run complete: ${done} transferred, ${failed} errors`);
  notify_(`Finished: ${done} transferred, ${failed} errors (see Notes column).`, 'Transfer complete', 10);
}

/* ───────────────────────── Step 3: trash ───────────────────────── */

function isDeleteStatus_(status) {
  const s = String(status).trim().toLowerCase();
  return s === 'delete' || s === 'trashed';
}

function trashMarkedItems() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run "1. List everything I own" first.');

  const data = sh.getDataRange().getValues();
  const targets = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.STATUS - 1]).trim().toLowerCase() === 'delete') targets.push(i);
  }
  if (!targets.length) { ui.alert('No rows have "Delete" in the Status column.'); return; }

  const folders = targets.filter(i => data[i][COL.TYPE - 1] === 'Folder').length;
  const preview = targets.slice(0, 10).map(i => `• ${data[i][COL.NAME - 1]} (${data[i][COL.TYPE - 1]})`).join('\n') +
    (targets.length > 10 ? `\n…and ${targets.length - 10} more` : '');
  const folderWarning = folders
    ? `\n\n⚠ ${folders} of these are FOLDERS. Trashing a folder also trashes everything inside it.`
    : '';
  const ok = ui.alert(
    `Move ${targets.length} item(s) to Trash?`,
    preview + folderWarning + '\n\nThey can be restored from Drive → Trash for 30 days.',
    ui.ButtonSet.OK_CANCEL
  );
  if (ok !== ui.Button.OK) return;

  const start = Date.now();
  let done = 0, failed = 0;
  progress_(sh, `⏳ Moving ${targets.length} item(s) to Trash…`);
  for (const i of targets) {
    if (Date.now() - start > TIME_LIMIT_MS) {
      progress_(sh, `⏸ Paused: ${done} trashed. Run "3. Move items marked Delete to Trash" again.`);
      notify_(`${done} trashed so far. Run "3. Move items marked Delete to Trash" again to continue.`,
        'Not finished yet', 10);
      return;
    }
    const r = i + 1;
    try {
      getItem_(data[i][COL.ID - 1], data[i][COL.TYPE - 1]).setTrashed(true);
      if ((done + 1) % 5 === 0) progress_(sh, `⏳ Trashing… ${done + 1} of ${targets.length}`);
      sh.getRange(r, COL.STATUS, 1, 2).setValues([['Trashed', 'Moved to Trash ' + new Date().toLocaleString()]]);
      done++;
    } catch (e) {
      sh.getRange(r, COL.NOTES).setValue('Could not trash: ' + e.message); // keeps "Delete" so it's retried
      failed++;
    }
  }
  progress_(sh, `✅ Trash run complete: ${done} moved to Trash, ${failed} errors`);
  notify_(`Finished: ${done} moved to Trash, ${failed} errors (see Notes column).`, 'Trash complete', 10);
}

/* ───────────────────────── Helpers for filling emails ───────────────────────── */

/**
 * Puts one email into "New owner email" for every selected row that is visible
 * (rows hidden by a filter are skipped) and not already Done / Delete / Trashed.
 * Tip: filter the "Folder path" column, select the visible rows, then run this.
 */
function fillOwnerForSelection() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  const sh = ss.getActiveSheet();
  if (sh.getName() !== SHEET_NAME) { ui.alert(`Select rows on the "${SHEET_NAME}" tab first.`); return; }

  const resp = ui.prompt('New owner email',
    'Email to put in "New owner email" for every selected, visible row\n' +
    '(rows that are Done, Delete or Trashed are left alone):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const email = resp.getResponseText().trim().toLowerCase();
  if (!EMAIL_RE.test(email)) { ui.alert('That doesn\'t look like an email address.'); return; }

  let count = 0;
  sh.getActiveRangeList().getRanges().forEach(rg => {
    const first = rg.getRow(), n = rg.getNumRows();
    const statuses = sh.getRange(first, COL.STATUS, n, 1).getValues();
    for (let k = 0; k < n; k++) {
      const r = first + k;
      if (r === 1) continue; // header
      if (sh.isRowHiddenByFilter(r) || sh.isRowHiddenByUser(r)) continue;
      const st = String(statuses[k][0]).trim();
      if (st === 'Done' || isDeleteStatus_(st)) continue;
      sh.getRange(r, COL.EMAIL).setValue(email);
      count++;
    }
  });
  notify_(`Filled ${count} row(s) with ${email}.`, 'Done', 8);
}

function buildNameLookup() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run "1. List everything I own" first.');

  let lk = ss.getSheetByName(LOOKUP_SHEET);
  if (!lk) {
    lk = ss.insertSheet(LOOKUP_SHEET);
    lk.getRange(1, 1, 1, 2).setValues([['Name (as shown in New owner email)', 'Email']]).setFontWeight('bold');
    lk.setFrozenRows(1);
  }
  const existing = new Set(
    lk.getRange(1, 1, lk.getLastRow(), 1).getValues().slice(1).map(r => String(r[0]).trim().toLowerCase())
  );

  const data = sh.getDataRange().getValues();
  const rich = sh.getRange(1, COL.EMAIL, data.length, 1).getRichTextValues();
  const newNames = [];
  for (let i = 1; i < data.length; i++) {
    const st = String(data[i][COL.STATUS - 1]).trim();
    if (st === 'Done' || isDeleteStatus_(st)) continue;
    const raw = String(data[i][COL.EMAIL - 1]).trim();
    if (!raw) continue;
    if (EMAIL_RE.test(extractEmail_(data[i][COL.EMAIL - 1], rich[i][0], null))) continue;
    const key = raw.toLowerCase();
    if (!existing.has(key)) { existing.add(key); newNames.push([raw, '']); }
  }
  if (newNames.length) lk.getRange(lk.getLastRow() + 1, 1, newNames.length, 2).setValues(newNames);
  lk.autoResizeColumns(1, 2);
  ss.setActiveSheet(lk);
  notify_(`${newNames.length} new name(s) added. Fill in the Email column, then run "2. Transfer ownership".`,
    'Lookup ready', 10);
}

function loadLookup_() {
  const lk = SpreadsheetApp.getActive().getSheetByName(LOOKUP_SHEET);
  const map = {};
  if (!lk || lk.getLastRow() < 2) return map;
  lk.getRange(2, 1, lk.getLastRow() - 1, 2).getValues().forEach(([name, email]) => {
    const n = String(name).trim().toLowerCase();
    const e = String(email).trim().toLowerCase();
    if (n && e) map[n] = e;
  });
  return map;
}

/** Email from a typed address, an @ chip with a mailto link, or a name in the lookup tab. */
function extractEmail_(value, rich, lookup) {
  if (rich) {
    const links = [rich.getLinkUrl()].concat(rich.getRuns().map(run => run.getLinkUrl()));
    for (const url of links) {
      if (url && /^mailto:/i.test(url)) {
        return decodeURIComponent(url.replace(/^mailto:/i, '').split('?')[0]).trim().toLowerCase();
      }
    }
  }
  const text = String(value).trim();
  const match = text.match(EMAIL_RE);
  if (match) return match[0].toLowerCase();
  const key = text.toLowerCase();
  if (lookup && lookup[key]) return lookup[key];
  return key;
}

/**
 * Shows a pop-up that stays until you click OK. If the script was run from the
 * Apps Script editor (where pop-ups can't appear), it falls back to a corner
 * notice and the execution log instead.
 */
function notify_(message, title) {
  title = title || 'Drive Transfer';
  console.log(title + ': ' + message);
  try {
    const ui = SpreadsheetApp.getUi();
    ui.alert(title, message, ui.ButtonSet.OK);
  } catch (e) {
    SpreadsheetApp.getActive().toast(message, title, 30);
  }
}

/**
 * Live progress box in the top-right of the tab (two columns right of the data),
 * updated while a step runs so you can see it's working.
 */
function progress_(sh, text) {
  const time = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm:ss');
  sh.getRange(1, HEADERS.length + 2)
    .setValue(text + '   (updated ' + time + ')')
    .setFontWeight('bold')
    .setBackground(text.startsWith('✅') ? '#d9ead3' : '#fff2cc');
  SpreadsheetApp.flush();
}

/**
 * Compares the tab against your Drive right now:
 * - counts every folder and file you currently own,
 * - adds any that are missing from the tab to the bottom (Notes: "Added by check"),
 * - reports duplicates, and rows you no longer own (already transferred / trashed).
 * Doesn't change any existing rows.
 */
function verifyListing() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) throw new Error('Run "1. List everything I own" first.');
  if (PropertiesService.getUserProperties().getProperty(PHASE_KEY)) {
    notify_('The listing hasn\'t finished yet. Run "1. List everything I own" until it says complete, then run this check.',
      'Listing not finished');
    return;
  }

  const ids = sh.getRange(2, COL.ID, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]));
  const inTab = new Set(ids);
  const duplicates = ids.length - inTab.size;
  const owned = new Set();
  const missing = [];
  const pathCache = {};
  const thisId = ss.getId();
  const start = Date.now();
  progress_(sh, '⏳ Checking the list against your Drive…');

  const passes = [[DriveApp.searchFolders(QUERY), true], [DriveApp.searchFiles(QUERY), false]];
  for (const [it, isFolder] of passes) {
    while (it.hasNext()) {
      if (Date.now() - start > TIME_LIMIT_MS) {
        if (missing.length) writeRows_(sh, missing);
        progress_(sh, '⏸ Check ran out of time before finishing.');
        notify_(`The check ran out of time after looking at ${owned.size} items` +
          (missing.length ? ` and added ${missing.length} missing ones` : '') +
          '. Your Drive is very large; run the check again to look further.', 'Check not finished');
        return;
      }
      const item = it.next();
      const id = item.getId();
      if (id === thisId) continue;
      owned.add(id);
      if (!inTab.has(id)) {
        const row = rowFor_(item, isFolder, pathCache);
        row[COL.NOTES - 1] = 'Added by check';
        missing.push(row);
        inTab.add(id);
      }
      if (owned.size % 200 === 0) progress_(sh, `⏳ Checking… ${owned.size} items looked at`);
    }
  }
  if (missing.length) writeRows_(sh, missing);

  let notOwned = 0;
  new Set(ids).forEach(id => { if (!owned.has(id)) notOwned++; });

  const summary =
    `Items you currently own in Drive: ${owned.size}\n` +
    `Missing from the tab: ${missing.length}` + (missing.length ? ' (now added at the bottom, Notes = "Added by check")' : '') + '\n' +
    `Rows you no longer own (already transferred or trashed): ${notOwned}\n` +
    `Duplicate rows: ${duplicates}`;
  progress_(sh, missing.length ? `✅ Check done: ${missing.length} missing item(s) added` : '✅ Check done: list is complete');
  notify_(summary, missing.length ? 'Check complete: some items were added' : 'Check complete: the list is complete');
}
