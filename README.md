# AI College Timetable Management System

A full-stack web app with Admin / Teacher / Student logins that lets you fill a manual
**Teacher → Subject → Section → Periods/Week** table, auto-generate a conflict-free
timetable from it, edit it by clicking cells to move/swap, lock cells you don't want
touched on re-generate, and export everything to Excel.

**Stack:** React + TypeScript + Tailwind (frontend) · Node.js + Express (backend) ·
PostgreSQL + Prisma (database) · JWT (auth)

---

## 1. What you need installed on your computer

- **Node.js** v18 or later — https://nodejs.org
- **PostgreSQL** v14 or later — https://www.postgresql.org/download/
  (Or use a free hosted Postgres like [Neon](https://neon.tech) or
  [Supabase](https://supabase.com) if you don't want to install it locally —
  either way you just need a connection URL.)

Check they're installed:
```bash
node -v
psql --version
```

---

## 2. Create the database

If using local PostgreSQL:
```bash
psql -U postgres
CREATE DATABASE timetable_db;
\q
```
If using Neon/Supabase, just copy the connection string they give you — skip this step.

---

## 3. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Open `.env` and set:
```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/timetable_db?schema=public"
JWT_SECRET="pick-any-long-random-string"
PORT=5000
```

Create the tables and load sample data:
```bash
npx prisma migrate dev --name init
npm run seed
```

Start the API:
```bash
npm run dev
```
It runs at **http://localhost:5000**. Visit http://localhost:5000/api/health — you
should see `{"status":"ok"}`.

---

## 4. Frontend setup

Open a **second terminal**:
```bash
cd frontend
npm install
npm run dev
```
It runs at **http://localhost:5173** and automatically talks to the backend.

---

## 5. Log in

Open http://localhost:5173 in your browser. Seeded demo accounts
(password for all: `password123`):

| Role    | Email                  |
|---------|------------------------|
| Admin   | admin@college.edu      |
| Teacher | kumar@college.edu      |
| Student | student@college.edu    |

---

## 6. How to use it (as Admin)

1. **Master Data** — add your real Departments, Sections, Subjects, Teachers, Classrooms,
   Working Days, and Periods (sample data is already seeded so you can see the format).
2. **Teacher-Subject Assignment Table** — this is your manual sheet. For every
   class you'd normally write down by hand, add one row: pick the Teacher, the Subject,
   the Section, and how many Periods/Week it needs. Export this table to Excel any time.
3. **Generate Timetable** — click the button. The scheduler randomly places every
   subject into a free slot with no teacher/section double-booking, keeps lab
   subjects in consecutive periods, and respects each teacher's max-periods-per-day.
   If something can't be placed (e.g. not enough free slots), it's listed as an
   unresolved item instead of silently producing a broken timetable.
4. **View & Edit Timetables** — pick a section or teacher to see their grid.
   Click a filled cell to select it, then:
   - click another filled cell to **swap** them,
   - click an empty cell to **move** it there,
   - use the **Lock** button to freeze a cell so future re-generation never
     touches it (useful once you're happy with part of the schedule),
   - **Export Excel** or use your browser's print button for a paper copy.
5. Add teacher/student login accounts via `POST /api/auth/register` (admin-only) —
   or just add more entries to `prisma/seed.js` and re-run `npm run seed`.

Teachers and students log in and just see their own timetable (teacher: fixed to
their profile; student: picks Department → Year → Section, or is locked to one
if their account is linked to a section).

---

## 7. Project structure

```
backend/
  prisma/schema.prisma     -> database tables
  prisma/seed.js           -> sample data + demo logins
  src/routes/*.js          -> REST API (auth, departments, sections, subjects,
                               teachers, classrooms, settings, assignments,
                               timetable, export)
  src/scheduler/generate.js -> the randomized conflict-free scheduling engine
  src/server.js             -> app entry point

frontend/
  src/pages/*.tsx           -> Login, Dashboard, Masters, Assignments,
                               GenerateTimetable, TimetableView (admin edit),
                               TeacherView, StudentView
  src/components/*.tsx      -> Sidebar, TimetableGrid (the visual grid)
  src/context/AuthContext.tsx -> login/session handling
```

---

## 8. Notes on the scheduling engine

- It fills the manual Assignment Table's required `periodsPerWeek` for each
  Teacher+Subject+Section combo into random free slots.
- Lab subjects are placed as **consecutive period pairs** where possible.
- A slot is only used if the teacher isn't already busy there, the section isn't
  already busy there, and the teacher hasn't hit their daily period cap.
- Locked cells are treated as permanently occupied and are never regenerated.
- If it can't legally place all required periods for something, it reports that
  as an unresolved item on the Generate page rather than creating a clash —
  you then either add more working days/periods, reduce that subject's load,
  or place the remaining periods manually in **View & Edit**.

---

## 9. Deploying online (so it works from any device, not just your laptop)

The code is already set up for this — `frontend/src/api.ts` reads a `VITE_API_URL`
environment variable if present, and the backend reads a `FRONTEND_URL` variable
to allow it through CORS. Locally, ignore both; they only matter for deployment.

### Step A — Cloud database (Neon, free)
1. Go to https://neon.tech, sign up, create a project.
2. Copy the connection string it gives you (looks like
   `postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require`).
3. Keep it — you'll paste it into Render in Step B.

### Step B — Backend (Render, free)
1. Push this project to a GitHub repo (or upload it) — Render deploys from Git.
2. On https://render.com → New → Web Service → connect your repo, set:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
3. Under Environment, add:
   - `DATABASE_URL` = the Neon connection string from Step A
   - `JWT_SECRET` = any long random string
   - `FRONTEND_URL` = leave blank for now, you'll fill it in after Step C
4. Deploy. Once live, open Render's **Shell** tab for this service and run:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```
   (this creates the tables and demo logins on the cloud database)
5. Copy the URL Render gives you, e.g. `https://timetable-backend.onrender.com`.

### Step C — Frontend (Vercel, free)
1. On https://vercel.com → New Project → same GitHub repo, set:
   - Root directory: `frontend`
   - Build command: `npm run build`
   - Output directory: `dist`
2. Add an environment variable:
   - `VITE_API_URL` = `https://timetable-backend.onrender.com/api` (your Render URL + `/api`)
3. Deploy. Vercel gives you a URL like `https://your-timetable.vercel.app` —
   this is the link you share with teachers/students, works on any device.

### Step D — close the loop
Go back to Render → your backend's environment variables → set
`FRONTEND_URL` = `https://your-timetable.vercel.app` (your Vercel URL, no trailing
slash) → save (it will redeploy). This makes CORS only accept requests from your
real site.

That's it — the same app, same code, now reachable from any phone or computer
via one URL instead of `localhost`.


## 10. Updating an existing deployment (new features added)

If you already deployed this and are pulling in updates (like per-section
off-days, or edit buttons), you need to apply the new database schema once.
On your own computer, with `.env` pointed at your **live** database:
```bash
cd backend
npx prisma db push
```
This adds any new tables/columns without touching your existing data. Then
push your code changes to GitHub as usual — Render and Vercel redeploy
automatically on the new commit.

## 11. This update: labs with multiple teachers, last-period subjects, cleaner views

**New capabilities:**
- **Lab co-teachers** — on the Assignment page, any Lab subject now shows a
  "+ Add co-teacher" option, so 2-3 teachers can be scheduled together for the
  same lab session. All of them are checked for conflicts and marked busy
  together whenever the generator places that session.
- **"Always last period" subjects** — mark a subject (e.g. Library, Sports) on
  the Subjects tab with the new checkbox, and the generator will only ever
  place it in the single last teaching period of the day, never anywhere else.
- **Labs never span lunch** — this was already guaranteed by how consecutive
  periods are detected (a lunch period breaks the adjacency), confirmed and
  hardened in this update.
- **Student timetable** now shows only the subject name — no teacher shown.
- **Teacher timetable** now clearly shows the class as "DEPT SECTION (Yr N)"
  instead of just the section letter.

**Database migration required** — this update added new columns
(`Subject.alwaysLastPeriod`, `Assignment.coTeacherIds`,
`TimetableEntry.coTeacherIds`). On your computer, with `.env` pointed at your
live database:
```bash
cd backend
npx prisma@5.18.0 db push
```
(use whichever exact Prisma version you've been using locally so it matches
this project's schema format). Existing data is preserved; this only adds the
new columns.

## 12. This update: simpler teacher setup, safer deletes, PDF export

**Teachers no longer ask for Max/Day or Max/Week** — since subjects are
already arranged per teacher on the Assignment page, this manual capacity
input was redundant. The backend now applies a generous automatic cap
(8/day, 40/week) behind the scenes so the generator still avoids literally
overloading one person, without asking you to manage numbers.

**Deleting something that's "in use" now offers a real fix.** Departments,
Sections, Subjects, Teachers, Classrooms, Working Days, and Periods will
still warn you if other data depends on them — but now the warning tells you
exactly what's using it, and offers to delete/unlink those dependents too
(assignments, generated periods, day-off exceptions, room bookings) instead
of leaving you stuck. Department deletion stays a hard block by design —
cascading a whole department is too destructive to auto-confirm; move or
delete its teachers/sections first.

**PDF export added everywhere Excel export already existed** — student,
teacher, and admin timetable views all now have a "Download/Export PDF"
button alongside Excel. Student PDF/Excel exports show subject only (no
teacher name), matching the student timetable view.

**Database migration required** — no new columns this time, so:
```bash
cd backend
npx prisma@5.18.0 db push
```
only needs to run if you haven't already applied the previous update's
migration. If you have, you can skip straight to pushing the code.

**New dependency** — `pdfkit` was added to `backend/package.json`. Render
will install it automatically on the next deploy; no manual step needed
beyond pushing the updated `package.json`.
