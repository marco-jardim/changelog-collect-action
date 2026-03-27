// SPDX-License-Identifier: GPL-3.0

import * as core from "@actions/core";
import { Octokit } from "@octokit/rest";
import * as fs from "fs";
import * as path from "path";
import { ChangesetCollector } from "./collector";

/**
 * Parses an `owner/repo` string and returns the two parts.
 * Throws if the format is invalid.
 */
function parseRepo(repoInput: string): { owner: string; repo: string } {
  const parts = repoInput.trim().split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error(`Invalid repo format "${repoInput}" — expected "owner/name"`);
  }
  return { owner: parts[0], repo: parts[1] };
}

async function run(): Promise<void> {
  try {
    // --- Read inputs ---
    const githubToken = core.getInput("github_token", { required: true });
    const fromSha = core.getInput("from_sha", { required: true });
    const toSha = core.getInput("to_sha", { required: true });
    const repoInput = core.getInput("repo", { required: true });
    const excludePatternsRaw = core.getInput("exclude_patterns");
    const maxDiffBytesRaw = core.getInput("max_diff_bytes");

    const { owner, repo } = parseRepo(repoInput);

    const excludePatterns = excludePatternsRaw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const maxDiffBytes = parseInt(maxDiffBytesRaw, 10);
    if (isNaN(maxDiffBytes) || maxDiffBytes <= 0) {
      throw new Error(`Invalid max_diff_bytes value: "${maxDiffBytesRaw}"`);
    }

    core.info(`Collecting changeset for ${owner}/${repo} [${fromSha.slice(0, 7)}..${toSha.slice(0, 7)}]`);
    core.info(`Exclude patterns: ${excludePatterns.join(", ")}`);
    core.info(`Max diff bytes: ${maxDiffBytes}`);

    // --- Build Octokit client ---
    const octokit = new Octokit({ auth: githubToken });

    // --- Collect changeset ---
    const collector = new ChangesetCollector(octokit);
    const changeset = await collector.collect({
      owner,
      repo,
      from_sha: fromSha,
      to_sha: toSha,
      exclude_patterns: excludePatterns,
      max_diff_bytes: maxDiffBytes,
    });

    // --- Write output file ---
    const outputPath = path.resolve("changeset.v1.json");
    fs.writeFileSync(outputPath, JSON.stringify(changeset, null, 2), "utf8");

    core.info(`Changeset written to: ${outputPath}`);
    core.info(`Commits: ${changeset.totals.commit_count}, Files changed: ${changeset.totals.files_changed}`);

    // --- Set action outputs ---
    core.setOutput("changeset_path", outputPath);
    core.setOutput("commit_count", String(changeset.totals.commit_count));
    core.setOutput("file_count", String(changeset.totals.files_changed));
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
