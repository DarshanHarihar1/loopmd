# IR versioning

`LOOP.md` carries a `version` field so the format can evolve without breaking files
authored against older (or newer) loopmd releases.

## How it works

- The current schema version is `CURRENT_IR_VERSION` (exported from `loopmd/sdk`).
- A file whose `version` **exceeds** what this loopmd supports is **rejected** with a
  clear upgrade message:

  ```
  LOOP.md declares version 2, but this loopmd supports up to 1
  hint: upgrade loopmd (`npm i -g loopmd@latest`) to use this file
  ```

- A file whose `version` is **older** is **migrated** up to the current version
  transparently on parse, via registered migration steps.

## Migrations

Each migration transforms raw frontmatter from version `N` to `N+1`. They are keyed
by from-version and applied in order, so a v1 file moving to a hypothetical v3 runs
the `1 → 2` then `2 → 3` steps. Existing files keep working across upgrades without
manual edits.

If you maintain loopmd, add a step when you change the IR shape; never mutate the
meaning of an existing version.

See [Authoring LOOP.md](./authoring-loop-md.md) for the `version` field in context.
