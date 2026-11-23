/**
 * Bulk-transfer ownership of Google Docs.
 *
 * Step 1 (menu → "1. List my Google Docs"):
 *   Lists every Google Doc you own into a tab called "Ownership Transfer".
 * Step 2: Type the new owner's email in column E ("New owner email") for each
 *   sheet you want to hand over. Leave it blank to skip that sheet.
 * Step 3 (menu → "2. Transfer ownership"):
 *   For each row with an email, gives that person edit access, then makes
 *   them the owner. Writes Done / Error to the Status column.
 *
 * Both steps stop safely before Apps Script's 6-minute limit. If you see
 * "run again to continue", just run the same menu item again and it picks up
 * where it left off. Rows already marked Done are skipped.
 */

const SHEET_NAME = 'Ownership Transfer';
const HEADERS = ['File name', 'File ID', 'URL', 'Last updated', 'New owner email', 'Status', 'Notes'];
const COL = { NAME: 1, ID: 2, URL: 3, UPDATED: 4, EMAIL: 5, STATUS: 6, NOTES: 7 };
const TIME_LIMIT_MS = 5 * 60 * 1000; // stop at 5 minutes to stay under the 6-minute cap
const TOKEN_KEY = 'LIST_CONTINUATION_TOKEN';
const LOOKUP_SHEET = 'Name lookup';
const EMAIL_RE = /[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+/;

/**
 * Collects every distinct name in column E that isn't an email (e.g. @ chips
 * showing a name) into a "Name lookup" tab. Fill in each person's email once
 * in column B there; the transfer then uses it for every matching row.
 * Safe to run again: names already in the lookup (and their emails) are kept.
 */
function buildNameLookup() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run "1. List my Google Docs" first.');

  let lk = ss.getSheetByName(LOOKUP_SHEET);
  if (!lk) {
    lk = ss.insertSheet(LOOKUP_SHEET);
    lk.getRange(1, 1, 1, 2).setValues([['Name (as shown in column E)', 'Email']]).setFontWeight('bold');
    lk.setFrozenRows(1);
  }
  const existing = new Set(
    lk.getRange(1, 1, lk.getLastRow(), 1).getValues().slice(1)
      .map(r => String(r[0]).trim().toLowerCase())
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
  ss.toast(`${newNames.length} new name(s) added. Fill in the Email column, then run "2. Transfer ownership".`, 'Lookup ready', 10);
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

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ownership Transfer')
    .addItem('1. List my Google Docs', 'listMyDocs')
    .addItem('2. Transfer ownership', 'transferOwnership')
    .addItem('3. Move docs marked "Delete" to Trash', 'trashMarkedFiles')
    .addSeparator()
    .addItem('Build name → email lookup (for @ chips)', 'buildNameLookup')
    .addSeparator()
    .addItem('Restart listing from scratch', 'resetListing')
    .addToUi();
}

/** Step 1: list every Google Doc you own (resumable for very large Drives). */
function listMyDocs() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getUserProperties();
  const token = props.getProperty(TOKEN_KEY);
  let sh = ss.getSheetByName(SHEET_NAME);

  let files;
  if (token) {
    files = DriveApp.continueFileIterator(token);
  } else {
    if (!sh) sh = ss.insertSheet(SHEET_NAME);
    sh.clear();
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    files = DriveApp.searchFiles(
      "mimeType = 'application/vnd.google-apps.document' and 'me' in owners and trashed = false"
    );
  }

  const thisId = ss.getId();
  const start = Date.now();
  const rows = [];

  while (files.hasNext()) {
    if (Date.now() - start > TIME_LIMIT_MS) {
      writeRows_(sh, rows);
      props.setProperty(TOKEN_KEY, files.getContinuationToken());
      ss.toast(`Listed ${sh.getLastRow() - 1} so far. Run "1. List my Google Docs" again to continue.`, 'Not finished yet', 10);
      return;
    }
    const f = files.next();
    if (f.getId() === thisId) continue; // skip this control sheet itself
    rows.push([f.getName(), f.getId(), f.getUrl(), f.getLastUpdated(), '', '', '']);
  }

  writeRows_(sh, rows);
  props.deleteProperty(TOKEN_KEY);
  sh.autoResizeColumns(1, HEADERS.length);
  ss.toast(`Done: ${sh.getLastRow() - 1} sheets listed. Now fill in column E.`, 'Listing complete', 10);
}

function writeRows_(sh, rows) {
  if (!rows.length) return;
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, HEADERS.length).setValues(rows);
}

function resetListing() {
  PropertiesService.getUserProperties().deleteProperty(TOKEN_KEY);
  listMyDocs();
}

/** Step 2: add each new owner as editor, then transfer ownership. */
function transferOwnership() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run "1. List my Google Docs" first.');

  const data = sh.getDataRange().getValues();
  const richEmails = sh.getRange(1, COL.EMAIL, data.length, 1).getRichTextValues();
  const lookup = loadLookup_();
  const me = Session.getActiveUser().getEmail().toLowerCase();
  const start = Date.now();
  let done = 0, failed = 0;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = extractEmail_(row[COL.EMAIL - 1], richEmails[i][0], lookup);
    const status = String(row[COL.STATUS - 1]).trim();
    if (!email || status === 'Done' || isDeleteStatus_(status)) continue;

    if (Date.now() - start > TIME_LIMIT_MS) {
      ss.toast(`${done} transferred, ${failed} errors so far. Run "2. Transfer ownership" again to continue.`, 'Not finished yet', 10);
      return;
    }

    const r = i + 1;
    try {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        throw new Error('Could not read an email from "' + email + '". Run "Build name → email lookup" ' +
          'and fill in this person\'s email there, or type the email as plain text.');
      }
      if (email === me) throw new Error('That is your own email');

      const file = DriveApp.getFileById(row[COL.ID - 1]);
      // step A: give edit access, unless they already have it
      const alreadyEditor = file.getEditors().some(u => u.getEmail().toLowerCase() === email);
      if (!alreadyEditor) file.addEditor(email);
      file.setOwner(email);  // step B: make them owner (you stay on as an editor)

      const note = (alreadyEditor ? 'Was already an editor. ' : 'Edit access added. ') +
        'Transferred ' + new Date().toLocaleString();
      sh.getRange(r, COL.STATUS, 1, 2).setValues([['Done', note]]);
      done++;
    } catch (e) {
      sh.getRange(r, COL.STATUS, 1, 2).setValues([['Error', e.message]]);
      failed++;
    }
    if ((done + failed) % 20 === 0) SpreadsheetApp.flush(); // show progress as it goes
  }

  ss.toast(`Finished: ${done} transferred, ${failed} errors (see Notes column).`, 'Transfer complete', 10);
}

/** True for rows marked for deletion ("Delete") or already trashed ("Trashed"). */
function isDeleteStatus_(status) {
  const s = String(status).trim().toLowerCase();
  return s === 'delete' || s === 'trashed';
}

/**
 * Step 3: moves every sheet whose Status (column F) is "Delete" to Trash.
 * Asks for confirmation first. Trashed files can be restored from Drive's
 * Trash for 30 days. Rows become "Trashed" and are skipped on later runs.
 */
function trashMarkedFiles() {
  const ss = SpreadsheetApp.getActive();
  const ui = SpreadsheetApp.getUi();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Run "1. List my Google Docs" first.');

  const data = sh.getDataRange().getValues();
  const targets = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL.STATUS - 1]).trim().toLowerCase() === 'delete') targets.push(i);
  }
  if (!targets.length) {
    ui.alert('No rows have "Delete" in the Status column.');
    return;
  }

  const preview = targets.slice(0, 10).map(i => '• ' + data[i][COL.NAME - 1]).join('\n') +
    (targets.length > 10 ? `\n…and ${targets.length - 10} more` : '');
  const ok = ui.alert(
    `Move ${targets.length} doc(s) to Trash?`,
    preview + '\n\nThey can be restored from Drive → Trash for 30 days.',
    ui.ButtonSet.OK_CANCEL
  );
  if (ok !== ui.Button.OK) return;

  const start = Date.now();
  let done = 0, failed = 0;
  for (const i of targets) {
    if (Date.now() - start > TIME_LIMIT_MS) {
      ss.toast(`${done} trashed so far. Run "3. Move docs marked Delete to Trash" again to continue.`, 'Not finished yet', 10);
      return;
    }
    const r = i + 1;
    try {
      DriveApp.getFileById(data[i][COL.ID - 1]).setTrashed(true);
      sh.getRange(r, COL.STATUS, 1, 2).setValues([['Trashed', 'Moved to Trash ' + new Date().toLocaleString()]]);
      done++;
    } catch (e) {
      // Keep "Delete" so it's retried next run; explain in Notes.
      sh.getRange(r, COL.NOTES).setValue('Could not trash: ' + e.message);
      failed++;
    }
  }
  ss.toast(`Finished: ${done} moved to Trash, ${failed} errors (see Notes column).`, 'Trash complete', 10);
}

/**
 * Gets the email from column E, whether it's typed as plain text or added as
 * an @ people chip (which may display the person's name instead of the email).
 */
function extractEmail_(value, rich, lookup) {
  // 1. People chips usually carry a mailto: link behind the displayed name.
  if (rich) {
    const links = [rich.getLinkUrl()].concat(rich.getRuns().map(run => run.getLinkUrl()));
    for (const url of links) {
      if (url && /^mailto:/i.test(url)) {
        return decodeURIComponent(url.replace(/^mailto:/i, '').split('?')[0]).trim().toLowerCase();
      }
    }
  }
  // 2. Otherwise pull an email out of the visible text (plain text, or a chip set to show email).
  const text = String(value).trim();
  const match = text.match(EMAIL_RE);
  if (match) return match[0].toLowerCase();
  // 3. A name (e.g. a chip showing "Vama Shah"): use the Name lookup tab.
  const key = text.toLowerCase();
  if (lookup && lookup[key]) return lookup[key];
  return key;
}
