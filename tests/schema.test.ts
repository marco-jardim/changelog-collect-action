// SPDX-License-Identifier: GPL-3.0

import type { ChangesetV1, CommitEntry, Totals } from "../src/types";

// ---------------------------------------------------------------------------
// Validation helper — lightweight structural check (no external schema lib)
// ---------------------------------------------------------------------------

function validateChangesetV1(obj: unknown): ChangesetV1 {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("Changeset must be a non-null object");
  }

  const doc = obj as Record<string, unknown>;

  // schema_version
  if (doc["schema_version"] !== "1") {
    throw new Error(`schema_version must be "1", got: ${String(doc["schema_version"])}`);
  }

  // Required string fields
  const requiredStrings: Array<keyof ChangesetV1> = [
    "idempotency_key",
    "repo",
    "from_sha",
    "to_sha",
    "compare_url",
    "generated_at",
  ];
  for (const field of requiredStrings) {
    if (typeof doc[field] !== "string" || (doc[field] as string).length === 0) {
      throw new Error(`Missing or empty required field: ${field}`);
    }
  }

  // commits array
  if (!Array.isArray(doc["commits"])) {
    throw new Error("commits must be an array");
  }

  // totals
  const totals = doc["totals"] as Record<string, unknown> | undefined;
  if (typeof totals !== "object" || totals === null) {
    throw new Error("totals must be an object");
  }
  const totalFields: Array<keyof Totals> = ["commit_count", "files_changed", "additions", "deletions"];
  for (const field of totalFields) {
    if (typeof totals[field] !== "number") {
      throw new Error(`totals.${field} must be a number`);
    }
  }

  return doc as unknown as ChangesetV1;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeValidChangeset(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    schema_version: "1",
    idempotency_key: "owner/repo:aaaaaaa:bbbbbbb",
    repo: "owner/repo",
    from_sha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    to_sha: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    compare_url: "https://github.com/owner/repo/compare/aaaaaaa...bbbbbbb",
    generated_at: "2024-01-15T10:00:00.000Z",
    commits: [] as CommitEntry[],
    totals: {
      commit_count: 0,
      files_changed: 0,
      additions: 0,
      deletions: 0,
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ChangesetV1 schema validation", () => {
  it("valid ChangesetV1 passes validation without errors", () => {
    const doc = makeValidChangeset();
    expect(() => validateChangesetV1(doc)).not.toThrow();
  });

  it("empty commits array is valid", () => {
    const doc = makeValidChangeset({ commits: [] });
    const result = validateChangesetV1(doc);
    expect(result.commits).toHaveLength(0);
  });

  it("wrong schema_version throws an error", () => {
    const doc = makeValidChangeset({ schema_version: "2" });
    expect(() => validateChangesetV1(doc)).toThrow(/schema_version/);
  });

  it("missing required field (repo) throws an error", () => {
    const doc = makeValidChangeset();
    delete doc["repo"];
    expect(() => validateChangesetV1(doc)).toThrow(/repo/);
  });

  it("missing required field (from_sha) throws an error", () => {
    const doc = makeValidChangeset();
    delete doc["from_sha"];
    expect(() => validateChangesetV1(doc)).toThrow(/from_sha/);
  });

  it("missing required field (to_sha) throws an error", () => {
    const doc = makeValidChangeset();
    delete doc["to_sha"];
    expect(() => validateChangesetV1(doc)).toThrow(/to_sha/);
  });

  it("missing totals field throws an error", () => {
    const doc = makeValidChangeset();
    delete doc["totals"];
    expect(() => validateChangesetV1(doc)).toThrow(/totals/);
  });

  it("commits with multiple entries passes validation", () => {
    const commit: CommitEntry = {
      sha: "abc1234def5678901234567890123456789012345",
      short_sha: "abc1234",
      message: "feat: add feature",
      author: "Dev User",
      author_email: "dev@example.com",
      timestamp: "2024-01-15T10:00:00Z",
      url: "https://github.com/owner/repo/commit/abc1234",
      diff_summary: {
        files_changed: 1,
        additions: 10,
        deletions: 2,
        hunks: [
          {
            filename: "src/feature.ts",
            additions: 10,
            deletions: 2,
            patch: "+new line",
          },
        ],
      },
    };
    const doc = makeValidChangeset({
      commits: [commit],
      totals: { commit_count: 1, files_changed: 1, additions: 10, deletions: 2 },
    });
    const result = validateChangesetV1(doc);
    expect(result.commits).toHaveLength(1);
    expect(result.totals.commit_count).toBe(1);
  });
});
