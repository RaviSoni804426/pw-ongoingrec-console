# pw-ongoingrec-console

Review console for **PW OngoingRec**. Next.js 15 (App Router), TypeScript
strict, Tailwind, TanStack Query, wavesurfer.js, zod.

This is a review tool for **one authorised senior person**, not a multi-role QA
platform (scope decision, 14 August 2026). The whole flow is six steps:

```
Login → Select Centre → Select Counsellor → View Recordings
      → Play / Download → View Counsellor Summary
```

Two screens are the product — the **counsellor summary** and the **recording
review**. Everything else is navigation, and is deliberately thin.

---

## Screens

| Route | Screen | What it answers |
|---|---|---|
| `/login` | Sign in | — (PW SSO is a later item) |
| `/` | Centres | Which centre, which counsellor — with coverage per centre and agent state per person |
| `/counsellors/[id]` | **Counsellor summary** | How is this person doing: scores over time, weakest criteria, flags, coverage and its gap causes, date-grouped recordings |
| `/conversations/[id]` | **Recording review** | Waveform and transport, transcript synced to playback, AI scorecard with jump-to-evidence, flag rail, reason-gated download |
| `/conversations` | Recording search | Kept as a route, deliberately not in the navigation |
| `/enroll` | Enrollment | Create a counsellor, mint a one-time provisioning token |
| `/compliance` | Compliance | Access log with CSV export, legal holds, purge log |

### What was removed, and where its numbers went

The fleet-health, coverage and installation-detail screens were removed. None of
what they measured was dropped — it moved to where the reviewer will actually
see it:

- **Coverage per centre** is on the centre list. It is the only control that
  detects a counsellor disabling their microphone, so it is not optional; it
  just did not deserve a screen.
- **Coverage per counsellor**, with each gap's cause named, is on the counsellor
  summary.
- **Agent state** is a badge next to each counsellor. The reviewer's real
  question is never "is that laptop healthy" — it is "why are there no
  recordings from this person", and a dead agent is the answer.

---

## The AI score is advisory

The score is a proposal. The reviewer can override any criterion, and **that
override is the record**.

With no counsellor login and no dispute route, the reviewer is the only human in
the loop. BR-28 — no automated adverse action — is therefore not softened by the
simpler scope; it is carried entirely by that one person's judgement. Nothing in
this console takes an action off the back of a score.

### Phase 2, deliberately deferred

Counsellors cannot see their own scores, and there is no dispute route. This is
a reasonable MVP call but it is a deferral with a cost, not a free
simplification: BRD §16 argues that counsellors seeing their own scores is what
makes the system read as coaching rather than surveillance. It is recorded here
so it does not quietly disappear.

Also deferred with it: the audit queue and assignment, the sampling engine,
auditor calibration, and coaching plans. All of them assume a second reviewer or
a counsellor logging in, and neither exists yet.

---

## Running it locally

The console is a thin client over
[`pw-ongoingrec-backend`](https://github.com/RaviSoni804426/pw-ongoingrec-backend);
start that first, with its docker-compose services and seed data.

```bash
# in pw-ongoingrec-backend
docker compose up -d
npm run seed        # org tree + 2 days of real Ogg/Opus segments
npm run derive      # segments → conversations
npm run reconcile   # coverage days + gap attribution
npm run start:dev

# here
cp .env.example .env.local
npm install
npm run dev         # http://localhost:3001
```

The backend's seed prints three logins, one per role — sign in as each to see
RBAC actually narrowing what is visible:

| Account | Role | Sees |
|---|---|---|
| `admin@pw.local` | `SUPER_ADMIN` | Everything |
| `rajesh.head@pw.local` | `CENTRE_HEAD` | Both centres |
| `priya.manager@pw.local` | `MANAGER` | Only their own team's counsellors |

---

## Tests

```bash
npm run test:e2e      # Playwright
npm run test:e2e:ui   # interactive
```

**There are no network mocks.** The suite runs against a real backend with real
seeded audio, because a console that renders correctly against a stub proves
nothing about whether coverage is being reported truthfully. It covers:

- login, bad-credential rejection, and the unauthenticated redirect;
- fleet health showing a genuinely unhealthy installation from the seed;
- org explorer → counsellor → conversation drill-down;
- conversation list pagination;
- the player streaming real audio and seeking;
- download refusing to submit without a typed reason;
- the coverage grid, including the mock-CRM caveat banner;
- **RBAC**: a `MANAGER` gets `404` for another team's conversation by direct URL,
  and the UI surfaces the refusal rather than rendering the record;
- playback writing an `AccessLog` row that then appears in the compliance view;
- enrollment minting a one-time provisioning token.

### CI, and how the end-to-end job reaches the backend

`lint-and-build` runs on every push. The Playwright job stands up MongoDB,
Redis, MinIO and the backend, then runs the suite against the whole stack.

The backend lives in a **separate private repository**, so the job needs some
way to reach it. Two options were on the table:

| | Approach | Verdict |
|---|---|---|
| (a) | A fine-grained PAT with `Contents: Read` on `pw-ongoingrec-backend`, stored as `BACKEND_REPO_TOKEN`, used by `actions/checkout` | Rejected |
| (b) | The backend's own CI publishes a container image to GHCR; this job pulls `ghcr.io/<owner>/pw-ongoingrec-backend:main` | **Chosen** |

**Why (b).** `GITHUB_TOKEN` can already read packages within the same account,
so there is no cross-repo credential to create, store, or rotate — and no PAT
expiry to silently break the suite months from now. It also means the console is
tested against **the same artifact that would deploy**, rather than against a
source checkout that happens to build on a runner.

The cost was a Dockerfile in the backend, which is ~20 lines and was worth
having regardless. That is the only reason (a) looked simpler at first.

**The job fails red when the image is missing on `main`.** A permanently-skipping
test is a test that does not exist. The single exception is a pull request from a
fork, which genuinely cannot read GHCR packages; there it skips with a notice.

**One-time setup.** A GHCR package published from one repository is not
readable by another repository's `GITHUB_TOKEN` until access is granted. Once,
at:

```
github.com/users/<owner>/packages/container/pw-ongoingrec-backend/settings
  -> Manage Actions access -> Add repository -> pw-ongoingrec-console (Read)
```

The alternative is making the package public, which would expose the compiled
backend — not appropriate for a private product. Granting read to one
repository keeps it private and needs no rotating credential.

If the image has never been published at all, push `pw-ongoingrec-backend` to
`main` once and its CI will publish it.

---

## Notes on how it is built

### Responses are parsed, not cast

Every API response goes through a zod schema in [`src/lib/schemas.ts`](src/lib/schemas.ts).
A backend shape change fails loudly at the boundary instead of surfacing as an
empty cell in a coverage grid — which would read as "100% healthy".

### Timestamps

Everything on the wire is UTC. `<Timestamp>` renders in the **centre's**
timezone (not the viewer's) with the exact UTC value on hover: a manager in
Delhi reviewing a Kota centre must see Kota's clock, or every coverage
discussion becomes an argument about which day it was.

### Playback is opt-in

Fetching the stream URL *is* the audit event — the backend writes the
`AccessLog` row before minting the URL. So the player does not load audio until
someone explicitly asks, and prefetching would log playback that never happened.

### Coverage tells the truth about the mock CRM

Cut A ships `MockCrmAdapter`, which returns no walk-ins, so coverage percentages
are structurally zero. The coverage screen says so in a banner rather than
presenting a meaningless 0% as a real measurement. Captured conversations and
gap-cause attribution beneath it *are* real.

`none` (grey) is a distinct RAG band from `bad` (red): no CRM walk-ins logged
means there was nothing to cover, which is a data gap, not a recording failure.
Painting it red would train people to ignore red.

---

## One role

There is one console role, `ADMIN`. The RBAC *mechanism* is untouched —
`scoped-repository.ts` and `scope.service.ts` still narrow every query by centre
and counsellor, and an account carrying `scopeCentreIds` is restricted to those
centres. Only the role set collapsed.

That is deliberate: ripping out tested authorisation code to remove a dropdown
would be a bad trade, and the second role will arrive eventually. The seed
creates one unrestricted account and one restricted to a single centre, so the
filter every query depends on is exercised by a real login rather than only by
its unit tests.

---

## Known gaps in Cut A

- No transcript, scoring, audit workflow, disputes or coaching surfaces — Cut B.
- The counsellor-facing "My performance" view does not exist; Cut A is
  admin-only.
- Full-text search over conversations is not implemented (no transcripts yet).
- The access-log CSV export covers the current page rather than the full
  filtered result set.
