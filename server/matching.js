import { broaderSkills } from "./skills.js";

function normalized(value) {
  return value.trim().toLowerCase();
}

export function scoreJob(job, candidate) {
  const candidateSkills = new Set(candidate.skills.map(normalized));
  const relatedSkills = Object.entries(broaderSkills)
    .filter(([skill]) => candidateSkills.has(normalized(skill)))
    .sort(([a], [b]) => normalized(a).localeCompare(normalized(b)));
  const skillBreakdown = job.skills.map((skill) => {
    if (candidateSkills.has(normalized(skill))) {
      return { skill, matched: true, reason: "Exact skill", credit: 1 };
    }

    const relatedSkill = relatedSkills.find(([, broader]) =>
      broader.some((label) => normalized(label) === normalized(skill))
    );
    if (relatedSkill) {
      return {
        skill,
        matched: false,
        reason: `Related via ${relatedSkill[0]} (50% credit)`,
        credit: 0.5,
      };
    }

    return { skill, matched: false, reason: "Not found", credit: 0 };
  });
  const matchedCount = skillBreakdown.filter((item) => item.matched).length;
  const totalCredit = skillBreakdown.reduce((sum, item) => sum + item.credit, 0);
  const skillScore = job.skills.length ? totalCredit / job.skills.length : 0;
  const locationFits = job.location === candidate.location || job.workMode === "Remote";
  const score = Math.round(skillScore * 80 + (locationFits ? 20 : 0));

  return {
    score,
    matchedCount,
    requiredCount: job.skills.length,
    locationFits,
    skillBreakdown,
  };
}

export function rankJobs(jobs, candidate) {
  return jobs
    .map((job) => ({ ...job, match: scoreJob(job, candidate) }))
    .sort((a, b) => b.match.score - a.match.score || a.title.localeCompare(b.title));
}
