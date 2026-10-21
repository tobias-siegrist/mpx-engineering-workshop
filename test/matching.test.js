import assert from "node:assert/strict";
import test from "node:test";
import { scoreJob, rankJobs } from "../server/matching.js";
import { primaryJobs } from "../server/seed-data.js";
import { getCandidateById } from "../server/candidates.js";

function exampleJob(skills, workMode = "On-site") {
  return { location: "Bern", workMode, skills };
}

function exampleCandidate(skills) {
  return { location: "Zurich", skills };
}

test("Maya receives related credit while retaining three exact matches", () => {
  const result = scoreJob(primaryJobs[0], getCandidateById("candidate-001"));
  assert.equal(result.score, 90);
  assert.equal(result.matchedCount, 3);
  assert.deepEqual(result.skillBreakdown.map((item) => item.matched), [true, true, true, false]);
  assert.deepEqual(result.skillBreakdown.map((item) => item.credit), [1, 1, 1, 0.5]);
  assert.equal(result.locationFits, true);
});

test("exact skills retain full credit with case and whitespace normalization", () => {
  const result = scoreJob(exampleJob([" React "]), exampleCandidate([" REACT "]));
  assert.equal(result.score, 80);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.locationFits, false);
  assert.deepEqual(result.skillBreakdown, [
    { skill: " React ", matched: true, reason: "Exact skill", credit: 1 },
  ]);
});

test("specific skills earn half credit for direct broader requirements", () => {
  for (const [workMode, score, locationFits] of [["On-site", 40, false], ["Remote", 60, true]]) {
    const result = scoreJob(exampleJob(["Frontend development"], workMode), exampleCandidate(["React"]));
    assert.equal(result.score, score);
    assert.equal(result.locationFits, locationFits);
    assert.equal(result.matchedCount, 0);
    assert.deepEqual(result.skillBreakdown, [
      { skill: "Frontend development", matched: false, reason: "Related via React (50% credit)", credit: 0.5 },
    ]);
  }
});

test("unrelated, reverse, and sibling relationships receive no skill credit", () => {
  for (const [required, candidateSkill] of [
    ["Frontend development", "SQL"],
    ["React", "Frontend development"],
    ["TypeScript", "Python"],
  ]) {
    const result = scoreJob(exampleJob([required]), exampleCandidate([candidateSkill]));
    assert.equal(result.score, 0);
    assert.deepEqual(result.skillBreakdown, [
      { skill: required, matched: false, reason: "Not found", credit: 0 },
    ]);
  }
});

test("exact evidence takes precedence over related evidence", () => {
  const result = scoreJob(
    exampleJob(["Frontend development"]),
    exampleCandidate(["React", "Frontend development"]),
  );
  assert.equal(result.score, 80);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.skillBreakdown[0].reason, "Exact skill");
  assert.equal(result.skillBreakdown[0].credit, 1);
});

test("multiple related skills do not accumulate and evidence is stable across input order", () => {
  const job = exampleJob(["Data engineering"]);
  const first = scoreJob(job, exampleCandidate(["SQL", "Data pipelines"]));
  const reordered = scoreJob(job, exampleCandidate([" data PIPELINES ", " sql ", "SQL"]));
  assert.deepEqual(first, reordered);
  assert.deepEqual(first, scoreJob(job, exampleCandidate(["SQL", "Data pipelines"])));
  assert.equal(first.score, 40);
  assert.equal(first.skillBreakdown[0].reason, "Related via Data pipelines (50% credit)");

  const normalizedRequirement = scoreJob(exampleJob([" DATA engineering "]), exampleCandidate(["SQL"]));
  assert.equal(normalizedRequirement.score, 40);
  assert.equal(normalizedRequirement.skillBreakdown[0].reason, "Related via SQL (50% credit)");
});

test("a candidate skill can support both exact and broader requirements", () => {
  const result = scoreJob(exampleJob(["React", "Frontend development"]), exampleCandidate(["React"]));
  assert.equal(result.score, 60);
  assert.equal(result.matchedCount, 1);
  assert.equal(result.requiredCount, 2);
  assert.deepEqual(result.skillBreakdown.map((item) => item.credit), [1, 0.5]);
});

test("empty requirements receive only applicable location points", () => {
  for (const [workMode, score] of [["On-site", 0], ["Remote", 20]]) {
    const result = scoreJob(exampleJob([], workMode), exampleCandidate([]));
    assert.equal(result.score, score);
    assert.equal(result.matchedCount, 0);
    assert.equal(result.requiredCount, 0);
    assert.deepEqual(result.skillBreakdown, []);
  }
});

test("scores are rounded, bounded, and reconstructible from credit and location", () => {
  for (const skills of [[], ["React"], ["React", "SQL"], ["React", "SQL", "Python"]]) {
    for (const workMode of ["On-site", "Remote"]) {
      const result = scoreJob(exampleJob(["React", "SQL", "Python"], workMode), exampleCandidate(skills));
      const credit = result.skillBreakdown.reduce((sum, item) => sum + item.credit, 0);
      assert.equal(result.score, Math.round(80 * credit / result.requiredCount + (result.locationFits ? 20 : 0)));
      assert.ok(Number.isInteger(result.score) && result.score >= 0 && result.score <= 100);
    }
  }
  assert.equal(scoreJob(exampleJob(["React", "SQL", "Python"]), exampleCandidate(["React"])).score, 27);
  assert.equal(scoreJob(exampleJob(["React"], "Remote"), exampleCandidate(["React"])).score, 100);
});

test("equal scores retain title ordering and stable order for identical titles", () => {
  const job = exampleJob(["Frontend development"]);
  const jobs = [
    { ...job, id: "b", title: "Beta" },
    { ...job, id: "a1", title: "Alpha" },
    { ...job, id: "a2", title: "Alpha" },
  ];
  const ranked = rankJobs(jobs, exampleCandidate(["React"]));
  assert.deepEqual(ranked.map((item) => item.id), ["a1", "a2", "b"]);
  assert.deepEqual(jobs.map((item) => item.id), ["b", "a1", "a2"]);
});

test("remote roles count as a location fit and ranking is stable", () => {
  const candidate = getCandidateById("candidate-003");
  const ranked = rankJobs(primaryJobs, candidate);
  assert.equal(ranked[0].id, "job-103");
  assert.equal(ranked[0].match.locationFits, true);
});
