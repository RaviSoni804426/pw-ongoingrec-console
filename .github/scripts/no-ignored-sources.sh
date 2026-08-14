#!/usr/bin/env bash
#
# Fails if a source file that exists in the working tree is excluded by
# .gitignore — which means it is not in the repository, and CI is building
# something different from what the author sees.
#
# This has happened twice. A global ~/.gitignore_global carrying an unanchored
# `coverage/` — intended for test-coverage output — also matched the backend's
# src/coverage/ module and the console's src/app/(app)/coverage/ route. Both
# worked perfectly on the machine that wrote them and were simply absent in CI.
# The console's coverage screen returned a 404 in Playwright while the file sat
# happily on disk.
#
# The failure mode is nasty because nothing looks wrong: `git status` is clean,
# the app runs locally, and the file is right there. Only a fresh clone reveals
# it, which is what CI is.
set -euo pipefail

error() { echo "::error::$*"; }
note() { echo "$*"; }

# Directories that hold hand-written source. Build output, dependencies and
# genuine coverage reports are supposed to be ignored and are not scanned.
ROOTS=()
for candidate in src app lib e2e test tests scripts public docs .github; do
  [ -d "$candidate" ] && ROOTS+=("$candidate")
done

if [ ${#ROOTS[@]} -eq 0 ]; then
  note "No source directories to check."
  exit 0
fi

EXTENSIONS=(
  '*.ts' '*.tsx' '*.js' '*.jsx' '*.mjs' '*.cjs'
  '*.cs' '*.csproj' '*.sln' '*.wxs' '*.wxl'
  '*.css' '*.scss' '*.json' '*.yml' '*.yaml'
  '*.md' '*.sh' '*.py'
  '*.png' '*.svg' '*.ico'
)

find_args=()
for ext in "${EXTENSIONS[@]}"; do
  find_args+=(-name "$ext" -o)
done
unset 'find_args[${#find_args[@]}-1]'

ignored=""
while IFS= read -r file; do
  # `git check-ignore` is the authority: it accounts for the repo .gitignore,
  # the global one, and .git/info/exclude together.
  if git check-ignore -q "$file" 2>/dev/null; then
    ignored+="  $file"$'\n'
  fi
done < <(
  find "${ROOTS[@]}" -type f \( "${find_args[@]}" \) \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/.next/*' \
    -not -path '*/bin/*' \
    -not -path '*/obj/*' \
    2>/dev/null
)

if [ -n "$ignored" ]; then
  error "These source files exist locally but are excluded by .gitignore, so they are not in the repository:"
  printf '%s' "$ignored"
  error "CI is building a different tree from the one you are looking at."
  error "Fix by adding a negation to this repo's .gitignore, for example: !src/app/**/coverage/**"
  exit 1
fi

note "No source files are being silently excluded."
