#!/usr/bin/env bash
# Copies the generated App/Theme/Tokens.swift into build/generated/ (git-ignored)
# so it can be compiled without editing the generated file.
# The generator emits `enum Type`, which Swift rejects as a member name
# ("would conflict with the 'foo.Type' expression"), and `Tokens.`Type`` still
# resolves to the metatype at use sites. The copy renames it to `TypeScale`.
# Once scripts/gen_tokens.ts emits `enum TypeScale` this is a plain copy.
set -euo pipefail
src="${SRCROOT}/App/Theme/Tokens.swift"
out="${SRCROOT}/build/generated/TokensCompiled.swift"
mkdir -p "$(dirname "$out")"
sed -E 's/^([[:space:]]*)enum Type \{/\1enum TypeScale {/' "$src" > "$out"
