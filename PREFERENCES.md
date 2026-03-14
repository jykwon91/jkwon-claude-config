# Managing Global Preferences

Global preferences are stored in `global-preferences.md` and automatically synced to every registered project's `CLAUDE.md` on push.

## Adding a New Preference

Open `global-preferences.md` and add your preference under the relevant section:

```markdown
## Global Software Engineering Preferences
- Prefer simple, minimal solutions. Avoid over-engineering.
- Your new preference here
```

Push to main — the GitHub Action will sync it to all registered projects automatically. Developers get it on their next `git pull`.

## Adding a New Category

If your preference doesn't fit an existing section, add a new one:

```markdown
## Global Testing Preferences
- Test behavior, not implementation.
- Your preference here
```

There are no restrictions on categories — just use a clear heading that describes the type of preference.

## How It Works

The sync workflow injects the full contents of `global-preferences.md` into each project's `CLAUDE.md` between these markers:

```
<!-- BEGIN GLOBAL PREFERENCES -->
...
<!-- END GLOBAL PREFERENCES -->
```

Project-specific content in `CLAUDE.md` is never modified. Only the content between the markers is updated on each sync.
