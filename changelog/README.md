# Changelog Fragments

This directory contains changelog fragments that will be compiled into `CHANGELOG.md` at release time.

## Adding a Changelog Entry

1. Create a `.md` file in the appropriate subdirectory under `unreleased/`:
   - `features/` - New features and capabilities
   - `fixes/` - Bug fixes
   - `improvements/` - UI/UX improvements, refactoring, performance

2. Name the file descriptively (e.g., `state-heatmap.md`, `fix-login-bug.md`)

3. Write the entry in this format:
   ```markdown
   **Feature Name**: Brief description
   - Detail point 1
   - Detail point 2
   ```

## Compiling the Changelog

Run the compile script to merge all fragments into `CHANGELOG.md`:

```bash
python changelog/compile.py 1.8.0
```

This will:
- Add a new version section to `CHANGELOG.md`
- Include all fragments organized by category
- Delete the fragment files after compilation

## Example Fragment

File: `changelog/unreleased/features/dark-mode.md`
```markdown
**Dark Mode**: Added system-wide dark mode support
- Automatic detection of system preference
- Manual toggle in settings
- Persists across sessions
```
