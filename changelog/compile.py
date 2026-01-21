#!/usr/bin/env python3
"""
Compile changelog fragments into CHANGELOG.md

Usage:
    python changelog/compile.py <version>

Example:
    python changelog/compile.py 1.8.0
"""

import os
import sys
from datetime import date
from pathlib import Path

CHANGELOG_DIR = Path(__file__).parent
PROJECT_ROOT = CHANGELOG_DIR.parent
CHANGELOG_FILE = PROJECT_ROOT / "CHANGELOG.md"
UNRELEASED_DIR = CHANGELOG_DIR / "unreleased"

CATEGORIES = {
    "features": "New Features",
    "fixes": "Bug Fixes",
    "improvements": "UI/UX Improvements"
}

def read_fragments(category_dir: Path) -> list[str]:
    """Read all markdown fragments from a category directory."""
    fragments = []
    if category_dir.exists():
        for file in sorted(category_dir.glob("*.md")):
            content = file.read_text().strip()
            if content:
                fragments.append(content)
    return fragments

def compile_changelog(version: str) -> str:
    """Compile all fragments into a changelog section."""
    today = date.today().isoformat()

    sections = []
    for category_key, category_title in CATEGORIES.items():
        category_dir = UNRELEASED_DIR / category_key
        fragments = read_fragments(category_dir)

        if fragments:
            section = f"### {category_title}\n"
            for fragment in fragments:
                section += f"- {fragment}\n"
            sections.append(section)

    if not sections:
        print("No changelog fragments found in changelog/unreleased/")
        return ""

    version_section = f"## [{version}] - {today}\n\n"
    version_section += "\n".join(sections)

    return version_section

def update_changelog(new_section: str):
    """Insert new section at the top of CHANGELOG.md."""
    if not CHANGELOG_FILE.exists():
        print(f"Error: {CHANGELOG_FILE} not found")
        sys.exit(1)

    content = CHANGELOG_FILE.read_text()

    marker = "All notable changes to this project will be documented in this file."
    if marker in content:
        parts = content.split(marker, 1)
        new_content = parts[0] + marker + "\n\n" + new_section + "\n" + parts[1].lstrip()
    else:
        lines = content.split("\n")
        insert_index = 0
        for i, line in enumerate(lines):
            if line.startswith("## ["):
                insert_index = i
                break
        lines.insert(insert_index, new_section + "\n")
        new_content = "\n".join(lines)

    CHANGELOG_FILE.write_text(new_content)

def cleanup_fragments():
    """Delete all fragment files after compilation."""
    deleted = 0
    for category_key in CATEGORIES.keys():
        category_dir = UNRELEASED_DIR / category_key
        if category_dir.exists():
            for file in category_dir.glob("*.md"):
                file.unlink()
                deleted += 1
                print(f"  Deleted: {file.relative_to(PROJECT_ROOT)}")
    return deleted

def main():
    if len(sys.argv) != 2:
        print("Usage: python changelog/compile.py <version>")
        print("Example: python changelog/compile.py 1.8.0")
        sys.exit(1)

    version = sys.argv[1]
    if version.startswith("v"):
        version = version[1:]

    print(f"Compiling changelog for version {version}...")

    new_section = compile_changelog(version)
    if not new_section:
        sys.exit(1)

    print(f"\nNew changelog section:\n{'-' * 40}")
    print(new_section)
    print('-' * 40)

    update_changelog(new_section)
    print(f"\nUpdated {CHANGELOG_FILE.relative_to(PROJECT_ROOT)}")

    print("\nCleaning up fragments...")
    deleted = cleanup_fragments()
    print(f"Deleted {deleted} fragment file(s)")

    print(f"\nDone! Don't forget to commit and tag:")
    print(f"  git add CHANGELOG.md changelog/")
    print(f"  git commit -m \"Release v{version}\"")
    print(f"  git tag -a v{version} -m \"Release v{version}\"")

if __name__ == "__main__":
    main()
