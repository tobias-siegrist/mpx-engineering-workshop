import { rankJobs } from "./matching.js";

export function createRecommendationCache() {
  return function getRecommendations(jobs, candidate) {
    // Derive each ranking from this request's profile and current catalog.
    return {
      scoredForCandidateId: candidate.id,
      jobs: rankJobs(jobs, candidate),
    };
  };
}
