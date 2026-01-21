# Claude Code Instructions

This document provides guidance for Claude Code sessions working on this repository.

## Changelog Fragments System

To avoid merge conflicts, this project uses **changelog fragments** instead of directly editing `CHANGELOG.md`.

### Adding a Changelog Entry

After making significant code changes, create a fragment file:

1. Create a `.md` file in the appropriate category:
   - `changelog/unreleased/features/` - New features
   - `changelog/unreleased/fixes/` - Bug fixes
   - `changelog/unreleased/improvements/` - UI/UX improvements

2. Name the file descriptively (e.g., `state-heatmap.md`)

3. Write the entry:
   ```markdown
   **Feature Name**: Brief description
   - Detail point 1
   - Detail point 2
   ```

### Compiling at Release Time

**Automatic (Recommended)**: When you create a GitHub Release, the changelog is compiled automatically via GitHub Actions. The workflow extracts the version from the release tag (e.g., `v1.8.0` → `1.8.0`), runs the compile script, and commits the updated `CHANGELOG.md`.

**Manual**: If needed, you can also run manually:
```bash
python changelog/compile.py 1.8.0
```

This compiles all fragments into `CHANGELOG.md` and deletes the fragment files.

### Important: Never Edit CHANGELOG.md Directly

Always use changelog fragments. Direct edits to `CHANGELOG.md` will cause merge conflicts when multiple PRs are open.

## Post-Change Checklist

After completing significant code changes, Claude should ask the user:

1. **Generate a PR?** - Create a pull request with summary and test plan
2. **Add changelog fragment?** - Create a fragment file for the changes
3. **Provide git tag commands?** - Give copy-paste commands for version tagging

Provide all commands without comments for easy copy-paste.

## Release Versioning Workflow

When making changes that warrant a new version release, follow this process:

### 1. Add Changelog Fragment

Create a fragment file instead of editing CHANGELOG.md directly:

```bash
echo '**Feature Name**: Description
- Detail 1
- Detail 2' > changelog/unreleased/features/my-feature.md
```

### 2. Create a Git Tag (Important Limitation)

**Claude cannot push git tags** due to authentication restrictions. Claude's git credentials only allow pushing to branches matching `claude/*`.

After the PR is merged, Claude should provide tag commands:

```bash
git tag -a vX.Y.Z <commit-hash> -m "Release vX.Y.Z - Summary"
git push origin vX.Y.Z
```

### 3. Why Tags Matter

The `/api/versions` endpoint reads git tags to populate the Release History in the Settings modal. Without a pushed tag, versions won't appear in the UI even if they're documented in the CHANGELOG.

## Version Number Guidelines

- **Major (X.0.0)**: Breaking changes or major new functionality
- **Minor (X.Y.0)**: New features, significant enhancements
- **Patch (X.Y.Z)**: Bug fixes, small improvements

## Periodic Tag Reminders

**Claude should periodically remind the user to push pending tags**, especially:
- At the end of a session where CHANGELOG was updated
- When a significant feature is completed
- When the user asks about releases or versions

### Reminder Format

When reminding the user, provide **copy-paste ready commands** with a changelog summary:

```
📦 **Pending Release Tag**

The following version is ready to be tagged and pushed:

**v1.6.0** - API Versioning with Changelog
- API Versioning with Changelog viewer in Settings
- New /api/api-versions and /api/changelog endpoints
- Enhanced version cards with feature lists and status badges

**Run these commands to publish the release:**

git tag -a v1.6.0 3c419bf -m "Release v1.6.0 - API Versioning with Changelog"
git push origin v1.6.0
```

### When to Suggest New Tags

Suggest a new version tag when:
- **Patch (X.Y.Z)**: Bug fixes, minor UI tweaks
- **Minor (X.Y.0)**: New features, significant enhancements
- **Major (X.0.0)**: Breaking changes, major rewrites

Always check CHANGELOG.md to see what the latest documented version is, and compare with `git tag -l` to identify unpushed versions.

## Commit Message Format

When updating the CHANGELOG for a new version, use a commit message like:

```
Release vX.Y.Z - Brief summary

- Feature 1
- Feature 2
- Bug fix
```

## API Versions vs Application Versions

This project has two distinct version concepts:

1. **API Versions** (`v1`, `v2-beta`): Defined in `backend/app.py` `API_VERSIONS` constant. These are endpoint versioning for the API.

2. **Application Versions** (`1.5.0`, `1.6.0`): Git tags representing releases. Shown in Release History UI.

Don't confuse these - adding a CHANGELOG entry for v1.6.0 doesn't create a new API version.
