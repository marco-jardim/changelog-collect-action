// SPDX-License-Identifier: GPL-3.0

/**
 * Converts a glob pattern into a RegExp without any external dependencies.
 *
 * Supported syntax:
 *   `**`  — matches any sequence of characters including path separators
 *   `*`   — matches any sequence of characters excluding `/`
 *   `?`   — matches exactly one character excluding `/`
 *   All other regex special characters are escaped.
 */
function globToRegex(pattern: string): RegExp {
  let regexStr = "";
  let i = 0;

  while (i < pattern.length) {
    const ch = pattern[i];

    if (ch === "*") {
      // Peek ahead: `**` matches everything (including `/`)
      if (pattern[i + 1] === "*") {
        regexStr += ".*";
        i += 2;
        // Consume a trailing slash so `dist/**` matches `dist/foo` and `dist/foo/bar`
        if (pattern[i] === "/") {
          i += 1;
        }
      } else {
        // Single `*` — matches anything except `/`
        regexStr += "[^/]*";
        i += 1;
      }
    } else if (ch === "?") {
      regexStr += "[^/]";
      i += 1;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      // Escape regex special characters
      regexStr += `\\${ch}`;
      i += 1;
    } else {
      regexStr += ch;
      i += 1;
    }
  }

  return new RegExp(`^${regexStr}$`);
}

/**
 * Returns true if `filename` matches any of the provided glob `patterns`.
 *
 * Matching is performed against the full relative path supplied, e.g.
 * `dist/bundle.js` or `src/components/Button.tsx`.
 */
export function shouldExcludeFile(filename: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const trimmed = pattern.trim();
    if (trimmed.length === 0) continue;
    const regex = globToRegex(trimmed);
    if (regex.test(filename)) {
      return true;
    }
  }
  return false;
}
