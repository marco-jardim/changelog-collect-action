// SPDX-License-Identifier: GPL-3.0

import { Octokit } from "@octokit/rest";
import { shouldExcludeFile } from "./filter";
import type { ChangesetV1, CommitEntry, CommitDiffSummary, CommitHunk, Totals } from "./types";

export interface CollectOptions {
  owner: string;
  repo: string;
  from_sha: string;
  to_sha: string;
  exclude_patterns: string[];
  max_diff_bytes: number;
}

/**
 * Collects a structured `ChangesetV1` document for the given commit range.
 *
 * Fetches the comparison list from GitHub, then hydrates each commit with its
 * per-file diff, applies exclusion filters, enforces a byte-budget on patch
 * content, and assembles the final schema-v1 document.
 */
export class ChangesetCollector {
  private readonly octokit: Octokit;

  constructor(octokit: Octokit) {
    this.octokit = octokit;
  }

  async collect(options: CollectOptions): Promise<ChangesetV1> {
    const { owner, repo, from_sha, to_sha, exclude_patterns, max_diff_bytes } = options;

    // Step 1 — fetch comparison to get the commit list + compare_url
    const comparison = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base: from_sha,
      head: to_sha,
    });

    const compareUrl: string = comparison.data.html_url ?? "";
    const rawCommits = comparison.data.commits ?? [];

    let totalDiffBytes = 0;
    const commitEntries: CommitEntry[] = [];
    const uniqueFiles = new Set<string>();

    // Step 2 — hydrate each commit with its full diff
    for (const rawCommit of rawCommits) {
      const commitDetail = await this.octokit.repos.getCommit({
        owner,
        repo,
        ref: rawCommit.sha,
      });

      const data = commitDetail.data;
      const rawFiles = data.files ?? [];

      const hunks: CommitHunk[] = [];
      let commitAdditions = 0;
      let commitDeletions = 0;
      let commitTruncated = false;

      for (const file of rawFiles) {
        const filename: string = file.filename ?? "";

        // Apply exclusion filter
        if (shouldExcludeFile(filename, exclude_patterns)) {
          continue;
        }

        uniqueFiles.add(filename);

        const additions = file.additions ?? 0;
        const deletions = file.deletions ?? 0;
        commitAdditions += additions;
        commitDeletions += deletions;

        // Enforce byte budget on patch content
        let patch: string | undefined = file.patch;
        if (patch !== undefined) {
          const patchBytes = Buffer.byteLength(patch, "utf8");
          if (totalDiffBytes + patchBytes > max_diff_bytes) {
            patch = "";
            commitTruncated = true;
          } else {
            totalDiffBytes += patchBytes;
          }
        }

        hunks.push({
          filename,
          additions,
          deletions,
          patch,
        });
      }

      const diffSummary: CommitDiffSummary = {
        files_changed: hunks.length,
        additions: commitAdditions,
        deletions: commitDeletions,
        hunks,
        ...(commitTruncated ? { truncated: true } : {}),
      };

      const commit = rawCommit.commit;
      const author = commit.author;

      const entry: CommitEntry = {
        sha: rawCommit.sha,
        short_sha: rawCommit.sha.slice(0, 7),
        message: commit.message ?? "",
        author: author?.name ?? "",
        author_email: author?.email ?? "",
        timestamp: author?.date ?? "",
        url: rawCommit.html_url ?? "",
        diff_summary: diffSummary,
      };

      commitEntries.push(entry);
    }

    // Step 3 — compute aggregate totals
    const totals: Totals = {
      commit_count: commitEntries.length,
      files_changed: uniqueFiles.size,
      additions: commitEntries.reduce((sum, c) => sum + c.diff_summary.additions, 0),
      deletions: commitEntries.reduce((sum, c) => sum + c.diff_summary.deletions, 0),
    };

    const changeset: ChangesetV1 = {
      schema_version: "1",
      idempotency_key: `${owner}/${repo}:${from_sha}:${to_sha}`,
      repo: `${owner}/${repo}`,
      from_sha,
      to_sha,
      compare_url: compareUrl,
      generated_at: new Date().toISOString(),
      commits: commitEntries,
      totals,
    };

    return changeset;
  }
}
