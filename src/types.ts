// SPDX-License-Identifier: GPL-3.0

/**
 * Represents a single hunk (file-level diff) within a commit.
 */
export interface CommitHunk {
  filename: string;
  additions: number;
  deletions: number;
  patch?: string;
}

/**
 * Aggregated diff summary for a single commit.
 */
export interface CommitDiffSummary {
  files_changed: number;
  additions: number;
  deletions: number;
  hunks: CommitHunk[];
  truncated?: boolean;
}

/**
 * Full metadata + diff for a single commit in the range.
 */
export interface CommitEntry {
  sha: string;
  short_sha: string;
  message: string;
  author: string;
  author_email: string;
  timestamp: string;
  url: string;
  diff_summary: CommitDiffSummary;
}

/**
 * Aggregate totals across the full commit range.
 */
export interface Totals {
  commit_count: number;
  files_changed: number;
  additions: number;
  deletions: number;
}

/**
 * The top-level changeset document (schema v1).
 */
export interface ChangesetV1 {
  schema_version: "1";
  idempotency_key: string;
  repo: string;
  from_sha: string;
  to_sha: string;
  compare_url: string;
  generated_at: string;
  commits: CommitEntry[];
  totals: Totals;
}
