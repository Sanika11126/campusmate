# CampusMate

A student productivity dashboard: track assignments, practicals, exams and projects in one place.

## Features
- Dashboard: total / pending / completed counts, completion % with progress bar, overdue list, upcoming deadlines, subject summary, daily study tip
- Add, edit, complete, reopen and delete (with confirmation) tasks
- Search (title/subject), status filter, priority filter and sorting that all work together
- Deadline labels: overdue, due today, due soon (within 3 days), later. Completed tasks are never overdue
- Data saved in Local Storage; corrupted or missing data falls back to an empty list
- Light/dark theme (remembered), responsive layout, keyboard focus styles, text labels + icons (not colour alone)

## Technologies
HTML5, CSS3, vanilla JavaScript, browser Local Storage. No frameworks, no backend.

## Run locally
Download the folder and double-click `index.html`. (Optional: VS Code "Live Server" extension.)

## Deploy on GitHub Pages
1. Create a GitHub repository and upload `index.html`, `style.css`, `script.js`, `README.md`.
2. Repository **Settings → Pages → Source: Deploy from a branch → main / (root) → Save**.
3. After a minute the site is live at `https://<username>.github.io/<repo>/`.

## Manual test checklist
Add a task → edit it → mark complete → reopen → delete (confirm) · refresh and check data remains · add a task dated yesterday (overdue), today, and in 2 days · combine search + filter + sort · toggle theme and refresh · narrow the browser window to phone width · open DevTools console and check for errors.

## Customize
- Colours: edit the `:root` variables at the top of `style.css`
- Study tips: edit the `TIPS` array in `script.js`
- "Due soon" window: change `days <= 3` in `deadlineInfo()` in `script.js`
- New field (e.g. "type"): add an input in `index.html`, then read/save it in `handleFormSubmit()` and show it in `buildTaskCard()`

## How the code is organised (`script.js`)
Storage → date helpers → rendering → form → events. Every change calls `saveTasks()` then `render()`, so the UI and stored data stay in sync.
