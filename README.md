# pw-ongoingrec-console

Admin web console for **PW OngoingRec — Cut A**. Next.js 15 (App Router),
TypeScript strict, Tailwind, TanStack Query, wavesurfer.js, zod.

The single most important thing this console does in Cut A is **make bad
coverage obvious** — if a counsellor is not being recorded, that has to be
visible without anyone going looking for it.

---

## Screens

| Route | Screen | What it answers |
|---|---|---|
| `/login` | Sign in | — (PW SSO replaces this in Cut B) |
| `/` | Fleet health | Which agents are alive, faulted or backlogged |
| `/installations/[id]` | Installation detail | Heartbeat timeline, capture gaps, device history, commands |
| `/coverage` | Coverage | Centre × day RAG grid, per-counsellor rows, gap causes, unknown-gap worklist |
| `/centres` | Org explorer | Centre → team → counsellor, scoped to your role |
| `/counsellors/[id]` | Counsellor detail | Date-grouped conversations, 30-day coverage trend, gap markers |
| `/conversations` | Conversation list | Server-paginated, filterable |
| `/conversations/[id]` | Player | Waveform, 0.5–2× transport, ±10s, keyboard shortcuts, segment markers, reason-gated download |
| `/enroll` | Enrollment | Create a counsellor, mint a one-time provisioning token |
| `/compliance` | Compliance | Access log with CSV export, legal holds, purge log |

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

If the backend image has never been published, push `pw-ongoingrec-backend` to
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

## Known gaps in Cut A

- No transcript, scoring, audit workflow, disputes or coaching surfaces — Cut B.
- The counsellor-facing "My performance" view does not exist; Cut A is
  admin-only.
- Full-text search over conversations is not implemented (no transcripts yet).
- The access-log CSV export covers the current page rather than the full
  filtered result set.
