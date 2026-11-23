export interface SkillItem {
  skillId: number;
  name: string;
  category: string;
  level: string;
}

export interface StudentMatchCandidate {
  id: number;
  fullName: string;
  collegeId: number | null;
  departmentId: number | null;
  experienceLevel: string;
  preferredLanguages: string[];
  availability: { days: string[]; timeSlot: string; hoursPerWeek: number };
  teachingSkills: SkillItem[];
  learningSkills: SkillItem[];
}

export interface CompatibilityBreakdown {
  reciprocalSkills: number;
  sharedInterests: number;
  learningGoals: number;
  experienceFit: number;
  languageFit: number;
  availabilityFit: number;
  matchedPairs: { teacher: string; learner: string; skill: string }[];
}

const LEVEL_RANK: Record<string, number> = {
  Beginner: 1,
  Intermediate: 2,
  Advanced: 3,
  Expert: 4,
};

export function computeCompatibility(
  me: StudentMatchCandidate,
  other: StudentMatchCandidate
): { score: number; breakdown: CompatibilityBreakdown } {
  const myTeachIds = new Set(me.teachingSkills.map((s) => s.skillId));
  const myLearnIds = new Set(me.learningSkills.map((s) => s.skillId));
  const otherTeachIds = new Set(other.teachingSkills.map((s) => s.skillId));
  const otherLearnIds = new Set(other.learningSkills.map((s) => s.skillId));

  const matchedPairs: { teacher: string; learner: string; skill: string }[] = [];

  // 1. Reciprocal skill matches (max 45 pts)
  let meCanTeachOther = 0;
  for (const s of me.teachingSkills) {
    if (otherLearnIds.has(s.skillId)) {
      meCanTeachOther++;
      matchedPairs.push({ teacher: me.fullName, learner: other.fullName, skill: s.name });
    }
  }
  let otherCanTeachMe = 0;
  for (const s of other.teachingSkills) {
    if (myLearnIds.has(s.skillId)) {
      otherCanTeachMe++;
      matchedPairs.push({ teacher: other.fullName, learner: me.fullName, skill: s.name });
    }
  }

  let reciprocalSkills = 0;
  if (meCanTeachOther > 0 && otherCanTeachMe > 0) {
    reciprocalSkills = Math.min(45, 28 + (meCanTeachOther + otherCanTeachMe - 2) * 6);
  } else if (meCanTeachOther > 0 || otherCanTeachMe > 0) {
    reciprocalSkills = Math.min(26, 16 + (meCanTeachOther + otherCanTeachMe - 1) * 5);
  } else {
    reciprocalSkills = 8;
  }

  // 2. Shared interests / categories (max 15 pts)
  const myCategories = new Set([
    ...me.teachingSkills.map((s) => s.category),
    ...me.learningSkills.map((s) => s.category),
  ]);
  const otherCategories = new Set([
    ...other.teachingSkills.map((s) => s.category),
    ...other.learningSkills.map((s) => s.category),
  ]);
  let sharedCats = 0;
  myCategories.forEach((c) => {
    if (otherCategories.has(c)) sharedCats++;
  });
  const sharedInterests = Math.min(15, sharedCats * 5 + 3);

  // 3. Shared learning goals (max 12 pts)
  let sharedLearn = 0;
  myLearnIds.forEach((id) => {
    if (otherLearnIds.has(id)) sharedLearn++;
  });
  let sharedTeach = 0;
  myTeachIds.forEach((id) => {
    if (otherTeachIds.has(id)) sharedTeach++;
  });
  const learningGoals = Math.min(12, sharedLearn * 4 + sharedTeach * 2 + 2);

  // 4. Experience compatibility (max 10 pts)
  const rankDiff = Math.abs(
    (LEVEL_RANK[me.experienceLevel] || 2) - (LEVEL_RANK[other.experienceLevel] || 2)
  );
  const experienceFit = rankDiff === 0 ? 10 : rankDiff === 1 ? 8 : 5;

  // 5. Language compatibility (max 10 pts)
  const myLangs = new Set((me.preferredLanguages || []).map((l) => l.toLowerCase()));
  const sharedLangs = (other.preferredLanguages || []).filter((l) =>
    myLangs.has(l.toLowerCase())
  ).length;
  const languageFit = sharedLangs >= 2 ? 10 : sharedLangs === 1 ? 7 : 2;

  // 6. Availability overlap (max 8 pts)
  const myDays = new Set(me.availability?.days || []);
  const overlapDays = (other.availability?.days || []).filter((d) => myDays.has(d)).length;
  const sameSlot =
    me.availability?.timeSlot && other.availability?.timeSlot === me.availability.timeSlot;
  const availabilityFit = Math.min(8, overlapDays * 2 + (sameSlot ? 2 : 0));

  const rawScore =
    reciprocalSkills +
    sharedInterests +
    learningGoals +
    experienceFit +
    languageFit +
    availabilityFit;

  const score = Math.max(35, Math.min(99, rawScore));

  return {
    score,
    breakdown: {
      reciprocalSkills,
      sharedInterests,
      learningGoals,
      experienceFit,
      languageFit,
      availabilityFit,
      matchedPairs,
    },
  };
}
