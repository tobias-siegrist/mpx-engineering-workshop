import assert from "node:assert/strict";
import test from "node:test";
import { getCatalogSummary, getJobById, listJobs } from "../server/catalog.js";

test("catalog keeps one listing per canonical role and prefers the direct source", () => {
  const jobs = listJobs();
  const copies = jobs.filter((job) => job.canonicalId === "role-101");
  assert.equal(copies.length, 1);
  assert.equal(copies[0].id, "job-101");
  assert.equal(copies[0].source, "Direct");
  assert.equal(new Set(jobs.map((job) => job.canonicalId)).size, jobs.length);
  assert.deepEqual(getCatalogSummary(), { visibleListings: 7, uniqueRoles: 7, partnerListings: 1 });
});

test("catalog preserves source order and partner-only roles", () => {
  const expectedIds = ["job-101", "job-102", "job-103", "job-104", "job-105", "job-106", "partner-779"];
  assert.deepEqual(listJobs().map((job) => job.id), expectedIds);
  assert.deepEqual(listJobs().map((job) => job.id), expectedIds);
});

test("duplicate role remains unique under normalized query and combined filters", () => {
  const ids = (filters) => listJobs(filters).map((job) => job.id);
  assert.deepEqual(ids({ query: "  SENIOR PRODUCT ENGINEER  " }), ["job-101"]);
  assert.deepEqual(ids({ query: "React", category: "Engineering", location: "Zurich" }), ["job-101"]);
  assert.deepEqual(ids({ query: "React", category: "Data" }), []);
  assert.deepEqual(ids({ query: "React", location: "Bern" }), []);
  assert.deepEqual(ids({ location: "Bern" }), ["job-103", "job-104", "job-106"]);
});

test("catalog can filter by query, category, and location", () => {
  assert.equal(listJobs({ query: "Security" }).length, 1);
  assert.equal(listJobs({ category: "Data" }).length, 1);
  assert.equal(listJobs({ location: "Lausanne" }).some((job) => job.id === "job-103"), true);
  assert.equal(listJobs({ location: "Bern" }).some((job) => job.id === "job-106"), true);
  assert.equal(getJobById("job-102")?.title, "Data Platform Engineer");
});
