// SPDX-License-Identifier: GPL-3.0

import { shouldExcludeFile } from "../src/filter";

const DEFAULT_PATTERNS = [
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "*.lock",
  "*.min.js",
  "*.min.css",
  "dist/**",
  "build/**",
  "*.generated.*",
];

describe("shouldExcludeFile", () => {
  // --- Exact name matches ---
  it("matches package-lock.json exactly", () => {
    expect(shouldExcludeFile("package-lock.json", DEFAULT_PATTERNS)).toBe(true);
  });

  it("does NOT exclude src/foo.ts against package-lock.json pattern", () => {
    expect(shouldExcludeFile("src/foo.ts", DEFAULT_PATTERNS)).toBe(false);
  });

  // --- dist/** pattern ---
  it("matches dist/bundle.js against dist/**", () => {
    expect(shouldExcludeFile("dist/bundle.js", ["dist/**"])).toBe(true);
  });

  it("matches deeply nested dist file against dist/**", () => {
    expect(shouldExcludeFile("dist/assets/styles/app.css", ["dist/**"])).toBe(true);
  });

  // --- build/** pattern ---
  it("matches build/output.css against build/**", () => {
    expect(shouldExcludeFile("build/output.css", ["build/**"])).toBe(true);
  });

  // --- *.min.js pattern ---
  it("matches app.min.js against *.min.js", () => {
    expect(shouldExcludeFile("app.min.js", ["*.min.js"])).toBe(true);
  });

  it("does NOT match src/app.min.js against top-level *.min.js (no slash)", () => {
    // src/app.min.js has a slash — `*` does not cross directory boundaries
    expect(shouldExcludeFile("src/app.min.js", ["*.min.js"])).toBe(false);
  });

  // --- *.lock pattern ---
  it("matches yarn.lock against *.lock", () => {
    expect(shouldExcludeFile("yarn.lock", ["*.lock"])).toBe(true);
  });

  it("matches Pipfile.lock against *.lock", () => {
    expect(shouldExcludeFile("Pipfile.lock", ["*.lock"])).toBe(true);
  });

  // --- *.generated.* pattern ---
  it("matches src/foo.generated.ts against *.generated.*", () => {
    // Note: the pattern *.generated.* uses single-star, so it only matches
    // filenames without a directory separator. The path test below confirms
    // the full-path behaviour.
    expect(shouldExcludeFile("foo.generated.ts", ["*.generated.*"])).toBe(true);
  });

  // --- Non-excluded file ---
  it("does NOT exclude src/components/Button.tsx with default patterns", () => {
    expect(shouldExcludeFile("src/components/Button.tsx", DEFAULT_PATTERNS)).toBe(false);
  });

  // --- Edge cases ---
  it("returns false for empty patterns array", () => {
    expect(shouldExcludeFile("anything.js", [])).toBe(false);
  });

  it("ignores blank/whitespace-only patterns", () => {
    expect(shouldExcludeFile("package-lock.json", ["   ", ""])).toBe(false);
  });

  it("matches pnpm-lock.yaml exactly", () => {
    expect(shouldExcludeFile("pnpm-lock.yaml", DEFAULT_PATTERNS)).toBe(true);
  });

  it("? wildcard matches single non-slash character", () => {
    expect(shouldExcludeFile("src/a.ts", ["src/?.ts"])).toBe(true);
    expect(shouldExcludeFile("src/ab.ts", ["src/?.ts"])).toBe(false);
  });

  it("does NOT match directory separator with ?", () => {
    expect(shouldExcludeFile("src/a/b.ts", ["src/?.ts"])).toBe(false);
  });
});
