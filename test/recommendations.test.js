import test from "node:test";
import assert from "node:assert/strict";
import { createRecommendationCache } from "../server/recommendations.js";
import { listJobs } from "../server/catalog.js";
import { candidates } from "../server/seed-data.js";
import { rankJobs } from "../server/matching.js";

for (const order of [[0, 1, 0, 2], [1, 0, 1, 2]]) {
  test(`recommendations isolate profiles in request order ${order.join(" → ")}`, () => {
    const getRecommendations = createRecommendationCache();
    const jobs = listJobs();
    for (const index of order) {
      const candidate = candidates[index];
      const result = getRecommendations(jobs, candidate);
      assert.equal(result.scoredForCandidateId, candidate.id);
      assert.deepEqual(result.jobs, rankJobs(jobs, candidate));
    }
  });
}

test("recommendations reflect changed candidate and catalog inputs", () => {
  const getRecommendations = createRecommendationCache();
  const jobs = listJobs();
  const candidate = candidates[0];
  getRecommendations(jobs, candidate);
  const changedCandidate = { ...candidate, skills: [], location: "Elsewhere" };
  assert.deepEqual(getRecommendations(jobs, changedCandidate).jobs, rankJobs(jobs, changedCandidate));
  const changedJobs = jobs.slice(1);
  assert.deepEqual(getRecommendations(changedJobs, candidate).jobs, rankJobs(changedJobs, candidate));
  assert.deepEqual(getRecommendations([], candidate).jobs, []);
});
