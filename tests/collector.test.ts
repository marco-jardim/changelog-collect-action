// SPDX-License-Identifier: GPL-3.0

import { ChangesetCollector, CollectOptions } from "../src/collector";
import { Octokit } from "@octokit/rest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(
  filename: string,
  additions = 10,
  deletions = 5,
  patch = "+added\n-removed"
) {
  return { filename, additions, deletions, patch };
}

function makeRawCommit(
  sha: string,
  message: string,
  files: ReturnType<typeof makeFile>[]
) {
  return {
    sha,
    html_url: `https://github.com/owner/repo/commit/${sha}`,
    commit: {
      message,
      author: {
        name: "Test User",
        email: "test@example.com",
        date: "2024-01-15T10:00:00Z",
      },
    },
    files,
  };
}

function buildOctokit(
  commits: ReturnType<typeof makeRawCommit>[],
  compareHtmlUrl = "https://github.com/owner/repo/compare/abc...def"
): Octokit {
  // Build a map sha → commitDetail for getCommit responses
  const commitMap = new Map(commits.map((c) => [c.sha, c]));

  return {
    repos: {
      compareCommits: jest.fn().mockResolvedValue({
        data: {
          html_url: compareHtmlUrl,
          commits: commits.map((c) => ({
            sha: c.sha,
            html_url: c.html_url,
            commit: c.commit,
          })),
        },
      }),
      getCommit: jest.fn().mockImplementation(({ ref }: { ref: string }) => {
        const detail = commitMap.get(ref);
        if (!detail) throw new Error(`Unknown ref: ${ref}`);
        return Promise.resolve({ data: detail });
      }),
    },
  } as unknown as Octokit;
}

const BASE_OPTIONS: CollectOptions = {
  owner: "owner",
  repo: "repo",
  from_sha: "aaaaaaa1111111111111111111111111111111111",
  to_sha: "bbbbbbb2222222222222222222222222222222222",
  exclude_patterns: ["package-lock.json", "dist/**"],
  max_diff_bytes: 500000,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangesetCollector.collect", () => {
  it("returns correct ChangesetV1 schema shape", async () => {
    const commit = makeRawCommit("abc1234def5678901234567890123456789012345", "feat: hello", [
      makeFile("src/index.ts"),
    ]);
    const octokit = buildOctokit([commit]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    expect(result.schema_version).toBe("1");
    expect(result).toHaveProperty("idempotency_key");
    expect(result).toHaveProperty("repo");
    expect(result).toHaveProperty("from_sha");
    expect(result).toHaveProperty("to_sha");
    expect(result).toHaveProperty("compare_url");
    expect(result).toHaveProperty("generated_at");
    expect(Array.isArray(result.commits)).toBe(true);
    expect(result).toHaveProperty("totals");
  });

  it("sets idempotency_key as owner/repo:from_sha:to_sha", async () => {
    const octokit = buildOctokit([]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    expect(result.idempotency_key).toBe(
      `${BASE_OPTIONS.owner}/${BASE_OPTIONS.repo}:${BASE_OPTIONS.from_sha}:${BASE_OPTIONS.to_sha}`
    );
  });

  it("sets compare_url from GitHub API response", async () => {
    const expectedUrl = "https://github.com/owner/repo/compare/aaaaaaa...bbbbbbb";
    const octokit = buildOctokit([], expectedUrl);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    expect(result.compare_url).toBe(expectedUrl);
  });

  it("short_sha is exactly 7 characters", async () => {
    const sha = "abc1234def5678901234567890123456789012345";
    const commit = makeRawCommit(sha, "fix: bug", [makeFile("src/fix.ts")]);
    const octokit = buildOctokit([commit]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    expect(result.commits[0].short_sha).toBe(sha.slice(0, 7));
    expect(result.commits[0].short_sha).toHaveLength(7);
  });

  it("filters out excluded files (package-lock.json, dist/**)", async () => {
    const commit = makeRawCommit("sha1234567890123456789012345678901234567890", "chore: update deps", [
      makeFile("package-lock.json", 100, 50),
      makeFile("dist/bundle.js", 200, 10),
      makeFile("src/index.ts", 5, 2),
    ]);
    const octokit = buildOctokit([commit]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    const filenames = result.commits[0].diff_summary.hunks.map((h) => h.filename);
    expect(filenames).not.toContain("package-lock.json");
    expect(filenames).not.toContain("dist/bundle.js");
    expect(filenames).toContain("src/index.ts");
  });

  it("calculates correct totals across multiple commits", async () => {
    const c1 = makeRawCommit("sha1111111111111111111111111111111111111111", "feat: A", [
      makeFile("src/a.ts", 10, 2),
      makeFile("src/b.ts", 5, 1),
    ]);
    const c2 = makeRawCommit("sha2222222222222222222222222222222222222222", "feat: B", [
      makeFile("src/c.ts", 20, 8),
    ]);
    const octokit = buildOctokit([c1, c2]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    expect(result.totals.commit_count).toBe(2);
    expect(result.totals.additions).toBe(35); // 10+5+20
    expect(result.totals.deletions).toBe(11); // 2+1+8
    // 3 unique files
    expect(result.totals.files_changed).toBe(3);
  });

  it("sets truncated: true when diff bytes exceed max_diff_bytes", async () => {
    // Create a patch that is definitely over 50 bytes
    const bigPatch = "+" + "x".repeat(100);
    const commit = makeRawCommit("sha3333333333333333333333333333333333333333", "feat: big", [
      makeFile("src/big.ts", 100, 0, bigPatch),
      makeFile("src/small.ts", 1, 0, "+tiny"),
    ]);
    const octokit = buildOctokit([commit]);
    const collector = new ChangesetCollector(octokit);
    // Set a very small budget (50 bytes)
    const result = await collector.collect({ ...BASE_OPTIONS, max_diff_bytes: 50 });

    // At least one hunk should have an empty patch due to truncation
    const truncatedHunks = result.commits[0].diff_summary.hunks.filter((h) => h.patch === "");
    expect(truncatedHunks.length).toBeGreaterThan(0);
    expect(result.commits[0].diff_summary.truncated).toBe(true);
  });

  it("handles empty commit comparison gracefully", async () => {
    const octokit = buildOctokit([]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    expect(result.commits).toHaveLength(0);
    expect(result.totals.commit_count).toBe(0);
    expect(result.totals.files_changed).toBe(0);
    expect(result.totals.additions).toBe(0);
    expect(result.totals.deletions).toBe(0);
  });

  it("counts unique files across commits (not sum of per-commit files)", async () => {
    // Same file modified in two different commits
    const c1 = makeRawCommit("sha4444444444444444444444444444444444444444", "fix: tweak", [
      makeFile("src/shared.ts", 3, 1),
    ]);
    const c2 = makeRawCommit("sha5555555555555555555555555555555555555555", "fix: more", [
      makeFile("src/shared.ts", 2, 0),
      makeFile("src/new.ts", 5, 0),
    ]);
    const octokit = buildOctokit([c1, c2]);
    const collector = new ChangesetCollector(octokit);
    const result = await collector.collect(BASE_OPTIONS);

    // shared.ts appears in both commits but should count as 1 unique file
    expect(result.totals.files_changed).toBe(2);
  });
});
