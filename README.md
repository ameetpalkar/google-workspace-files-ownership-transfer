# Google Drive Ownership Transfer

Three Google Apps Scripts for transferring ownership of many Google Workspace files at once, without doing it file by file in the Share dialog.

Each script works the same way:

1. **It lists** everything you own (of one type) in a tab of a Google Sheet.
2. **You decide** who gets each item by typing their email next to it, or leaving it blank to keep it.
3. **It transfers** each item: it gives the person edit access, then makes them the owner. This does both of the manual steps in one go.
4. **Optionally, it trashes** any items you mark `Delete`.

| Script | Lists | Use it when |
| --- | --- | --- |
| [Sheets](#1-sheets-script) — `scripts/transfer_sheet_ownership.gs` | Google Sheets you own | You only need to hand over spreadsheets |
| [Docs](#2-docs-script) — `scripts/transfer_doc_ownership.gs` | Google Docs you own | You only need to hand over documents |
| [Drive](#3-drive-script) — `scripts/transfer_drive_ownership.gs` | **Everything** you own in My Drive: folders, Docs, Sheets, Slides, Forms, PDFs, Office files, images and more | You're handing over a whole Drive, or a mix of file types |

> **Everything going to one person?** A Workspace admin can move all of a user's files in one step with the Admin console's data transfer tool. These scripts are for when different files go to different people, or you want to leave some out.

---

## Contents

- [Before you start](#before-you-start)
- [Setup (all scripts)](#setup-all-scripts)
- [Tutorial: your first handover](#tutorial-your-first-handover)
- [How it works](#how-it-works)
- [1. Sheets script](#1-sheets-script)
- [2. Docs script](#2-docs-script)
- [3. Drive script](#3-drive-script)
- [Using @ people chips](#using--people-chips)
- [Rules and limitations](#rules-and-limitations)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Before you start

- You need a **Google Workspace (work or school) account**. New owners must be in the **same organization**.
- **Test on 2–3 rows first.** Once you've transferred something, only the new owner can transfer it back.
- Use a **separate, blank spreadsheet for each script.** The Sheets and Docs scripts both use a tab called `Ownership Transfer`, so putting both in one spreadsheet would overwrite your list.

## Setup (all scripts)

1. Create a new blank Google Sheet, for example *"Sheets ownership transfer"*.
2. Open **Extensions → Apps Script**.
3. Delete the sample code, paste in the full contents of the script you want, and click **Save**.
4. Go back to the sheet and **reload the page**. A new menu appears in the menu bar: **Ownership Transfer** for Sheets and Docs, **Drive Transfer** for Drive.
5. Run **1. List…** from that menu. Google will ask you to authorize the script. Approve it to let the script see and manage your Drive files and edit this spreadsheet. You only need to do this once per spreadsheet.

**Always run the steps from the menu in the sheet**, not from the Apps Script editor. Confirmation pop-ups and prompts can only appear in the sheet.

**Updating a script later:** paste the new code over the old code, save, and reload the sheet. Your list, emails and statuses stay as they are.

---

## Tutorial: your first handover

This tutorial uses the **Drive script** from start to finish, in a typical situation. The Sheets and Docs scripts work the same way, just with fewer columns. It takes about 15 minutes, plus waiting time.

**The situation:** you're moving to a new role. Here's what needs to happen:
- Your **Client Projects** folder, and everything in it, goes to **Priya** (`priya@yourcompany.com`).
- A few budget spreadsheets go to **Rahul** (`rahul@yourcompany.com`).
- Some old drafts should be deleted.
- Everything else stays with you.

*(Swap in your own folder names and colleagues' emails as you go.)*

### Step 1: Create the control spreadsheet
1. Go to [sheets.new](https://sheets.new) in your **work** account and name the spreadsheet **Drive handover**.
2. Open **Extensions → Apps Script**, delete the sample code, paste in all of `scripts/transfer_drive_ownership.gs`, and click **Save** (💾).
3. Close the Apps Script tab and **reload** the spreadsheet. After a few seconds, a **Drive Transfer** menu appears next to *Help*.

### Step 2: List everything you own
1. Click **Drive Transfer → 1. List everything I own**.
2. The first time, Google asks for permission. Click **Continue**, choose your work account, and click **Allow**. If you see "Google hasn't verified this app", click **Advanced → Go to … (unsafe)**. That's normal for a script you've just pasted in yourself.
3. If the menu item doesn't start after you approve, click it again.
4. A tab called **Drive Ownership Transfer** appears and starts filling with rows. The **K1** box shows progress:
   `⏳ Listing folders… 300 items so far (updated 10:02:15)` → `⏳ Listing files… 1,100 items so far`
5. When it's done, K1 turns green (`✅ Listing complete: 1,520 items`) and a pop-up tells you the total. Click **OK**.
   - If the pop-up says **Not finished yet**, click **1. List everything I own** again. It carries on from where it stopped.

### Step 3: Check nothing was missed (optional, recommended)
Click **Drive Transfer → Check the list is complete**. After a minute or two you get a summary like this:

```
Items you currently own in Drive: 1520
Missing from the tab: 0
Rows you no longer own (already transferred or trashed): 0
Duplicate rows: 0
```

If anything was missing, it's now been added at the bottom.

### Step 4: Do a test transfer
Before handing over everything, test with **one file**:
1. Press **Ctrl+F** (or **⌘+F** on Mac) and find an unimportant file inside *Client Projects*.
2. In that row, type `priya@yourcompany.com` in column **G** (*New owner email*).
3. Click **Drive Transfer → 2. Transfer ownership**.
4. Column **H** shows **Done**, and Notes (column **I**) says `Edit access added. Transferred …` with the date and time.
5. Open the file's URL (column E). In **Share**, Priya is now the *Owner* and you're an *Editor*. Ask Priya to check that she can see it.

### Step 5: Assign the Client Projects folder to Priya
1. Click cell **A1**, then **Data → Create a filter**.
2. Click the filter icon on **Folder path** (column C) and choose **Filter by condition → Text contains**, then enter `Client Projects`. You now see only the items inside that folder and its subfolders.
3. Select all visible rows: click the first row number, then **Shift+click** the last.
4. Click **Drive Transfer → Fill new owner for selected rows**, type `priya@yourcompany.com`, and click **OK**. A notice says how many rows were filled. Rows hidden by the filter aren't touched.
5. **Don't forget the folder itself.** It sits one level up, so the filter above doesn't show it. Clear the Folder path filter, filter **Type** (column B) to `Folder`, find **Client Projects**, and type Priya's email in its column G as well.

### Step 6: Assign Rahul's spreadsheets one by one
1. Clear the filters, or turn them off with **Data → Remove filter**.
2. Find each budget spreadsheet (**Ctrl+F** for "Budget") and type `rahul@yourcompany.com` in its column G.
   - Prefer chips? Type `@Rahul` and pick him from the list. If the chip shows his *name* rather than his email, see [Using @ people chips](#using--people-chips). In short: run **Build name → email lookup** and type his email once in the **Name lookup** tab.

### Step 7: Mark the old drafts for deletion
For each draft you want to get rid of, type `Delete` in column **H** (*Status*). Leave its email blank.

### Step 8: Run the transfer
1. Click **Drive Transfer → 2. Transfer ownership**.
2. Watch K1: `⏳ Transferring… 45 done, 0 errors (row 61)`.
3. After about 5 minutes you may get **Not finished yet**. Click **2. Transfer ownership** again. Rows already marked Done are skipped, so nothing is transferred twice. Repeat until you get **Transfer complete**.

### Step 9: Fix any errors
1. Filter **Status** (column H) to `Error` and read **Notes** (column I):
   - `Could not read an email from "rahul sharma"` → fill in his email in the **Name lookup** tab, or type it as plain text.
   - `Action not allowed` → see [Troubleshooting](#troubleshooting).
2. Fix the cause, then run **2. Transfer ownership** again. Only the Error rows (and any new ones) are tried.

### Step 10: Trash the drafts
1. Click **Drive Transfer → 3. Move items marked "Delete" to Trash**.
2. A pop-up lists what will be trashed, with a warning if any are folders. Check it carefully and click **OK**.
3. Those rows change to **Trashed**. If you change your mind, you can restore them from **Drive → Trash** within 30 days.

### Step 11: Final check
- Filter **Status** to see the totals: **Done** (handed over), **Trashed** and *blank* (still yours).
- Run **Check the list is complete** again. The "Rows you no longer own" number should equal your Done + Trashed count.
- Let Priya and Rahul know. If a transferred top-level folder like *Client Projects* shows up under **Shared with me**, they can right-click it and add it to their **My Drive**.

That's it: the handover is done, with a record in the spreadsheet of what went where. Keep the spreadsheet for reference.

> **Using the Sheets or Docs script instead?** Follow the same tutorial, but skip steps 3 and 5 (those features are only in the Drive script). The email column is **E** instead of G, Status is **F** instead of H, and Notes is **G** instead of I. Messages appear as small notices in the bottom-right corner rather than pop-ups.

---

## How it works

### Listing
The script uses Apps Script's built-in Drive service (`DriveApp`) to search for items where **you are the owner** and which **aren't in the Trash**:

| Script | Search |
| --- | --- |
| Sheets | `mimeType = 'application/vnd.google-apps.spreadsheet' and 'me' in owners and trashed = false` |
| Docs | `mimeType = 'application/vnd.google-apps.document' and 'me' in owners and trashed = false` |
| Drive | `'me' in owners and trashed = false`, run once for folders and once for files |

Each result is written as one row. The spreadsheet running the script is skipped, so it doesn't list itself.

### Transferring
For each row that has a new owner email and isn't already finished, the script:

1. Works out the email address (see [Using @ people chips](#using--people-chips)).
2. Checks it's a valid email and isn't your own.
3. Checks whether the person is **already an editor**. If not, it adds them as an editor (`addEditor`).
4. Makes them the **owner** (`setOwner`). You're automatically kept on as an editor.
5. Writes **Done** in Status, and a note saying whether edit access was added or they were already an editor, with a timestamp. If anything fails, it writes **Error** and Google's reason in Notes, and moves on to the next row.

### Status values
The **Status** column controls what happens to each row on the next run:

| Status | Transfer step | Trash step |
| --- | --- | --- |
| *(blank)* | Transferred if there's an email; skipped if not | Skipped |
| `Done` | Skipped (already transferred) | Skipped |
| `Error` | **Tried again** | Skipped |
| `Delete` (you type this) | Skipped, never transferred | **Moved to Trash** |
| `Trashed` | Skipped | Skipped |

So you can run any step as many times as you like, for example filling in more emails later and running **2. Transfer ownership** again.

### Time limits and resuming
Apps Script stops any run after 6 minutes. Each script stops itself after about **5 minutes** and tells you to run the same menu item again:
- **Listing** saves a bookmark (a Drive continuation token) so the next run carries on from the same place.
- **Transfer and trash** don't need a bookmark. Finished rows are already marked Done or Trashed, so the next run skips them.

Rough speeds: listing handles a few thousand items per run, and transferring handles about 100–150 items per run. Both depend on Google's speed at the time.

---

## 1. Sheets script

**File:** `scripts/transfer_sheet_ownership.gs`  **Menu:** Ownership Transfer  **Tab created:** `Ownership Transfer`

Lists every **Google Sheet** you own and transfers the ones you choose.

### Menu
| Menu item | What it does |
| --- | --- |
| **1. List my Google Sheets** | Clears the `Ownership Transfer` tab and lists every Google Sheet you own. If it reaches the time limit, run it again to continue. |
| **2. Transfer ownership** | Transfers every row that has an email and isn't Done, Delete or Trashed. |
| **3. Move sheets marked "Delete" to Trash** | Shows a confirmation pop-up with the list, then trashes every row whose Status is `Delete`. |
| **Build name → email lookup (for @ chips)** | Creates or updates a `Name lookup` tab. See [Using @ people chips](#using--people-chips). |
| **Restart listing from scratch** | Throws away a half-finished listing and starts again. |

### Columns
| Col | Header | Filled by | Notes |
| --- | --- | --- | --- |
| A | File name | Script | |
| B | File ID | Script | Used to find the file. Don't edit it. |
| C | URL | Script | Click to open the sheet |
| D | Last updated | Script | Handy for sorting out old files |
| **E** | **New owner email** | **You** | Email, @ chip, or blank to skip |
| **F** | **Status** | Script / you | Script writes Done / Error / Trashed. You type `Delete`. |
| G | Notes | Script | What happened, or the error reason |

### Steps
1. **Ownership Transfer → 1. List my Google Sheets.** A notice in the bottom-right corner says when it's complete, or that you need to run it again.
2. Fill in column E. Delete any rows you don't want, or just leave their email blank.
3. **2. Transfer ownership.** Watch column F fill with Done or Error.
4. Optional: type `Delete` in column F for sheets you want gone, then **3. Move sheets marked "Delete" to Trash**.

> ⚠️ **Don't run "1. List my Google Sheets" again once you've started filling in emails.** It clears the tab and rebuilds the list, and your emails and statuses are lost. The exception is when it told you to run it again to continue an unfinished listing. If you need sheets created since then, set up a fresh spreadsheet.

Notices in this script are small corner messages that disappear after about 10 seconds. To check whether a run has finished, see [Is it still running?](#is-it-still-running).

---

## 2. Docs script

**File:** `scripts/transfer_doc_ownership.gs`  **Menu:** Ownership Transfer  **Tab created:** `Ownership Transfer`

This works the same as the Sheets script, but lists **Google Docs** instead. The menu, columns, steps and warnings are the same:

| Menu item | What it does |
| --- | --- |
| **1. List my Google Docs** | Clears the tab and lists every Google Doc you own. Run it again to continue if it reaches the time limit. |
| **2. Transfer ownership** | Transfers every row with an email that isn't Done, Delete or Trashed. |
| **3. Move docs marked "Delete" to Trash** | Confirms, then trashes rows marked `Delete`. |
| **Build name → email lookup (for @ chips)** | See [Using @ people chips](#using--people-chips). |
| **Restart listing from scratch** | Starts the listing again. |

Columns are the same as the Sheets script: **E = New owner email, F = Status, G = Notes.**

> Use a **different spreadsheet** from the Sheets script. Both create a tab called `Ownership Transfer`.

---

## 3. Drive script

**File:** `scripts/transfer_drive_ownership.gs`  **Menu:** Drive Transfer  **Tab created:** `Drive Ownership Transfer`

Lists **everything you own in My Drive**, folders and files of every type, with the folder path of each item. It has extra tools for handing over whole folder trees.

### Menu
| Menu item | What it does |
| --- | --- |
| **1. List everything I own** | Lists all your **folders first, then all your files**. Run it again to continue if it reaches the time limit. If the listing already finished, it **asks before wiping** the tab. |
| **2. Transfer ownership** | Transfers every row with an email that isn't Done, Delete or Trashed. It works for files and folders. |
| **3. Move items marked "Delete" to Trash** | Confirms, then trashes rows marked `Delete`. It warns you if any of them are folders. |
| **Check the list is complete** | Compares the tab with your Drive. Anything missing is added at the bottom with Notes = "Added by check". It doesn't change existing rows. |
| **Fill new owner for selected rows** | Asks for one email and puts it in every **selected, visible** row. It skips rows hidden by a filter and rows that are Done, Delete or Trashed. |
| **Build name → email lookup (for @ chips)** | See [Using @ people chips](#using--people-chips). |
| **Restart listing from scratch** | Clears the tab and lists again from the start. |

### Columns
| Col | Header | Filled by | Notes |
| --- | --- | --- | --- |
| A | Name | Script | |
| B | Type | Script | `Folder`, `Google Doc`, `Google Sheet`, `Google Slides`, `Google Form`, `PDF`, `Word`, `Excel`, `PowerPoint`, `Image (png)`, … |
| C | Folder path | Script | Where the item sits, e.g. `My Drive / Projects / 2026` |
| D | ID | Script | Used to find the item. Don't edit it. |
| E | URL | Script | |
| F | Last updated | Script | |
| **G** | **New owner email** | **You** | Email, @ chip, or blank to skip |
| **H** | **Status** | Script / you | Script writes Done / Error / Trashed. You type `Delete`. |
| I | Notes | Script | What happened, or the error reason |
| K1 | *(progress box)* | Script | Live progress while a step runs |

### Steps
1. **Drive Transfer → 1. List everything I own.** Watch the progress box in **K1**.
2. **Drive Transfer → Check the list is complete.** This is optional, but a good way to confirm nothing was missed.
3. Assign new owners. The fastest way to do this by folder:
   1. Select the header row and choose **Data → Create a filter**.
   2. Filter **Folder path** (column C) to the folder you're handing over, for example *text contains* `My Drive / Projects`.
   3. Select the visible rows and run **Fill new owner for selected rows**, then type the email once.
   4. Also fill in the row for the **folder itself**: filter **Type** = `Folder` and find it by name.
4. **2. Transfer ownership.** Run it again until K1 says ✅.
5. Optional: type `Delete` in column H, then **3. Move items marked "Delete" to Trash**.

### Progress and messages
- **Box K1** updates while a step runs. It's yellow while working, for example `⏳ Listing files… 1,300 items so far (updated 18:04:12)`, and green when finished (`✅ Listing complete: 3,150 items`). If it reaches the time limit, it shows `⏸ Paused … run again`.
- **Pop-ups** at the end of each run stay until you click OK.

### Folders: how they behave
- **Ownership doesn't pass down to a folder's contents.** Transferring a folder transfers the folder only. Every file and subfolder has its own row and needs the new owner's email too. The Folder path filter and **Fill new owner for selected rows** make that quick.
- **The folder structure doesn't change.** Transferring doesn't move anything, so files stay in the same folders.
- **Give a folder and everything in it to the same person.** Otherwise the new owner gets a folder that still partly belongs to you, which can stop them moving or reorganizing it.
- **The new owner may see transferred top-level folders under "Shared with me".** They can add them to their My Drive. Test with one small folder to see how it looks in your organization.
- **Trashing a folder trashes everything inside it.** The confirmation pop-up warns you.

### What's not listed
- **Folders you don't own**, for example a colleague's folder shared with you. Your own files inside those folders *are* listed.
- **Items in shared drives.** These belong to the organization, not to you, so there's nothing to transfer.
- **Items already in Trash**, and items you've already transferred.

---

## Using @ people chips

In the email column you can type an email as plain text **or** use an `@` people chip. The script works out the email in this order:

1. **The link behind the chip.** If the chip contains a `mailto:` link, that email is used.
2. **The visible text.** If the cell shows an email address, including a chip set to display the email, that's used.
3. **The `Name lookup` tab.** If the cell shows only a name, for example "Vama Shah", the script looks that name up.

Chips usually show only a name, so in practice you'll often need the lookup:

1. Run **Build name → email lookup (for @ chips)**. A `Name lookup` tab is created, listing every name used in the email column once.
2. Type each person's **email in column B** of that tab. You only do this once per person, not once per file.
3. Run **2. Transfer ownership**. Every row with that name uses the email you entered, and earlier Error rows are retried.

Run the lookup builder again whenever you add new people. Names and emails already in the tab are kept. Names are matched without regard to capitals, but the spelling must be exact.

The script deliberately **doesn't** look names up in your company directory. Two people with similar names could mean a file goes to the wrong person, and you can't take back a transfer yourself.

---

## Rules and limitations

- **Same organization only.** Workspace doesn't allow ownership transfers to personal Gmail accounts or other domains.
- **Only to people, not groups.** A Google Group or shared mailbox can be given access to a file but can't own one.
- **You keep edit access** to everything you transfer. The new owner can remove you later.
- **New owners get Google's usual "shared with you" email** when edit access is added.
- **Transfers are immediate** within a Workspace organization. The new owner doesn't need to accept.
- **Admin policies still apply.** Sharing rules, restrictions between departments, or security labels can block a transfer. Those rows show `Error` with Google's reason.
- **Don't change the columns.** Don't delete, move or insert them, because the scripts find them by position. Sorting the whole table, filtering and deleting whole rows are all fine.
- **Don't edit the tab while a step is running.** Deleting rows mid-run can make results land on the wrong row.
- **Filtered-out rows are still processed** by Transfer and Trash. To skip a row, delete it or clear its email. (Only **Fill new owner for selected rows** ignores hidden rows.)

---

## Troubleshooting

| Message / Note | Meaning and fix |
| --- | --- |
| `Could not read an email from "…"` | The cell shows a name, not an email. Use **Build name → email lookup** and fill in the email, or type the email as plain text. |
| `Action not allowed` | Google blocked the transfer. Common causes: the new owner is outside your organization (check for a typo in the domain); the email is a group or shared mailbox; the person's account is suspended or can't use Drive; an admin sharing rule blocks it; or the file has a security label. Try transferring one file by hand (**Share → dropdown next to their name → Transfer ownership**) to see a clearer reason. If that's blocked too, ask your Workspace admin. |
| `That is your own email` | The email is your own address. Enter the new owner's email. |
| `Could not trash: …` | The item couldn't be moved to Trash. Its Status stays `Delete`, so it's tried again on the next run. |
| "Not finished yet" / ⏸ Paused | The run reached the time limit. Run the same menu item again. |
| "Listing is already complete" (Drive) | The tab already has a finished list. Click **Cancel** to keep it, or **OK** only if you want to wipe it and list again. |

### Is it still running?
- When a step is started from the menu, Google Sheets shows a **"Running script"** bar at the top of the sheet until it finishes.
- **Extensions → Apps Script → Executions** (left sidebar) lists every run. *Running* means it's still going. *Completed* in under about 5 minutes means it finished. *Completed* at about 5 minutes means it reached the time limit, so run it again. *Failed* means you can click it to see the error.
- In the Drive script, check the **K1** progress box.

---

## FAQ

**If I leave the email blank, is the file transferred?**
No. Rows with a blank email are skipped and left exactly as they are.

**Can I delete rows from the list?**
Yes. Only the rows left in the tab are processed. Just don't delete *columns*.

**Can I run the transfer in several batches?**
Yes. Fill in some emails, run the transfer, then fill in more later and run it again. Rows marked Done are skipped.

**What if the new owner is already an editor?**
The script skips adding edit access and goes straight to making them the owner. Notes says "Was already an editor".

**What if they only have view or comment access?**
They're upgraded to editor first, then made the owner.

**Does the folder structure survive?**
Yes. Nothing is moved; only the owner changes. See [Folders: how they behave](#folders-how-they-behave).

**How long does it take?**
Transfers take a few seconds each, about 100–150 per 5-minute run, so 200 files usually means 2–3 runs. Listing is faster.

**Can I undo a transfer?**
Not yourself. The new owner has to transfer it back to you. Trashed items can be restored from Drive's Trash for 30 days, after which Google deletes them permanently.
