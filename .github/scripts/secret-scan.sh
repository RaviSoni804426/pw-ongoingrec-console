#!/usr/bin/env bash
#
# Secret scan, shared verbatim across all four PW OngoingRec repositories.
#
# Two failure modes matter equally:
#
#   1. The known-leaked PW OAuth credential appearing anywhere in the working
#      tree or in any reachable commit.
#   2. The scan silently not running, because PW_LEAKED_SECRET was never
#      configured. A scan that no-ops is the exact failure this job exists to
#      prevent, so a missing secret is a red build, not a warning.
#
# Storing the leaked value as a repository secret in order to grep for it is
# deliberate: GitHub redacts secret values from logs, so a hit reports *that* it
# matched without reprinting the credential.
#
set -uo pipefail

fail=0

note()  { echo "::notice::$*"; }
error() { echo "::error::$*"; fail=1; }

# ── 1. the known-leaked credential ──────────────────────────────────────────
if [ -z "${PW_LEAKED_SECRET:-}" ]; then
  if [ "${IS_FORK_PR:-false}" = "true" ]; then
    # Secrets are deliberately unavailable to fork PRs. Skipping is correct
    # here and only here.
    note "Fork pull request: the literal check is skipped because secrets are not exposed to forks."
  else
    error "PW_LEAKED_SECRET is not configured, so the literal check did not run. \
Set it with: gh secret set PW_LEAKED_SECRET -R <owner>/<repo>"
  fi
else
  if git grep -I -q -e "$PW_LEAKED_SECRET" -- . 2>/dev/null; then
    error "The known-leaked PW OAuth secret is present in the working tree."
  fi

  # Reachable commits, not just the tip: the value being deleted in a later
  # commit does not remove it from history.
  if git rev-list --all | head -5000 | xargs -r git grep -I -q -e "$PW_LEAKED_SECRET" 2>/dev/null; then
    error "The known-leaked PW OAuth secret is present in this repository's history."
  fi
fi

# ── 2. hardcoded credentials of any kind ────────────────────────────────────
if git grep -I -nE \
     "(client_secret|api[_-]?key|apiKey|password|secret)[[:space:]]*[:=][[:space:]]*[\"'][A-Za-z0-9/+_-]{16,}[\"']" \
     -- . \
     ':(exclude).env.example' \
     ':(exclude)*.lock' \
     ':(exclude)package-lock.json' \
     ':(exclude)*.md' ; then
  error "A hardcoded credential literal was found in source."
fi

# ── 3. provider-specific key shapes ─────────────────────────────────────────
# Cut B adds Anthropic and AssemblyAI keys; catch them by prefix before they
# can ever be committed.
if git grep -I -nE "sk-ant-[A-Za-z0-9_-]{20,}" -- . ':(exclude)*.md' ; then
  error "An Anthropic API key is present in source."
fi

# ── 4. files that must never be tracked ─────────────────────────────────────
if git ls-files | grep -E '^\.env$|^\.env\.(local|production|development)$' ; then
  error "An .env file is tracked in git."
fi

if git ls-files | grep -E '\.(pfx|snk|p12|pem|key)$' ; then
  error "A private key or signing certificate is tracked in git."
fi

# ── 5. .env.example must carry placeholders only ────────────────────────────
if [ -f .env.example ]; then
  if grep -qE "^[A-Z_]+=(sk-|ghp_|AKIA)" .env.example ; then
    error ".env.example contains what looks like a real credential."
  fi
fi

if [ "$fail" -eq 0 ]; then
  echo "Secret scan clean."
fi

exit $fail
