import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// 1. Colleges
export const colleges = pgTable('colleges', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  domain: text('domain'),
  isVerified: boolean('is_verified').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 2. Departments
export const departments = pgTable('departments', {
  id: serial('id').primaryKey(),
  collegeId: integer('college_id')
    .references(() => colleges.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 3. Skills catalog
export const skills = pgTable(
  'skills',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    category: text('category').notNull(),
    description: text('description').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('skills_category_idx').on(table.category)]
);

// 4. Student Profiles (linked to Firebase Auth uid)
export const profiles = pgTable(
  'profiles',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull(),
    fullName: text('full_name').notNull(),
    username: text('username').notNull().unique(),
    avatarUrl: text('avatar_url').default('').notNull(),
    collegeId: integer('college_id').references(() => colleges.id),
    departmentId: integer('department_id').references(() => departments.id),
    academicYear: text('academic_year').default('3rd Year').notNull(),
    bio: text('bio').default('').notNull(),
    experienceLevel: text('experience_level').default('Intermediate').notNull(),
    preferredLanguages: jsonb('preferred_languages').$type<string[]>().default(['English', 'Bengali']).notNull(),
    availability: jsonb('availability')
      .$type<{ days: string[]; timeSlot: string; hoursPerWeek: number }>()
      .default({ days: ['Mon', 'Wed', 'Sat'], timeSlot: 'Evening (6 PM - 9 PM)', hoursPerWeek: 5 })
      .notNull(),
    githubUrl: text('github_url').default('').notNull(),
    linkedinUrl: text('linkedin_url').default('').notNull(),
    portfolioUrl: text('portfolio_url').default('').notNull(),
    role: text('role').default('student').notNull(), // 'student' | 'admin'
    isPublic: boolean('is_public').default(true).notNull(),
    isSuspended: boolean('is_suspended').default(false).notNull(),
    onboardingCompleted: boolean('onboarding_completed').default(false).notNull(),
    lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('profiles_college_idx').on(table.collegeId),
    index('profiles_uid_idx').on(table.uid),
  ]
);

// 5. User Teaching Skills
export const userTeachingSkills = pgTable(
  'user_teaching_skills',
  {
    id: serial('id').primaryKey(),
    profileId: integer('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    skillId: integer('skill_id')
      .references(() => skills.id, { onDelete: 'cascade' })
      .notNull(),
    level: text('level').default('Intermediate').notNull(), // Beginner | Intermediate | Advanced | Expert
    description: text('description').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_teaching_unique_idx').on(table.profileId, table.skillId)]
);

// 6. User Learning Skills
export const userLearningSkills = pgTable(
  'user_learning_skills',
  {
    id: serial('id').primaryKey(),
    profileId: integer('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    skillId: integer('skill_id')
      .references(() => skills.id, { onDelete: 'cascade' })
      .notNull(),
    targetLevel: text('target_level').default('Intermediate').notNull(),
    notes: text('notes').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('user_learning_unique_idx').on(table.profileId, table.skillId)]
);

// 7. Likes / Passes
export const likes = pgTable(
  'likes',
  {
    id: serial('id').primaryKey(),
    fromProfileId: integer('from_profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    toProfileId: integer('to_profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    action: text('action').notNull(), // 'like' | 'pass'
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('likes_from_to_unique_idx').on(table.fromProfileId, table.toProfileId)]
);

// 8. Matches
export const matches = pgTable(
  'matches',
  {
    id: serial('id').primaryKey(),
    user1Id: integer('user1_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    user2Id: integer('user2_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    compatibilityScore: integer('compatibility_score').default(80).notNull(),
    compatibilityBreakdown: jsonb('compatibility_breakdown')
      .$type<{
        reciprocalSkills: number;
        sharedInterests: number;
        learningGoals: number;
        experienceFit: number;
        languageFit: number;
        availabilityFit: number;
        matchedPairs: { teacher: string; learner: string; skill: string }[];
      }>()
      .notNull(),
    matchedAt: timestamp('matched_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('matches_pair_unique_idx').on(table.user1Id, table.user2Id)]
);

// 9. Conversations
export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  matchId: integer('match_id')
    .references(() => matches.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// 10. Conversation Members
export const conversationMembers = pgTable(
  'conversation_members',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    profileId: integer('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    lastReadAt: timestamp('last_read_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('conv_member_unique_idx').on(table.conversationId, table.profileId)]
);

// 11. Messages
export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: integer('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' })
      .notNull(),
    senderId: integer('sender_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    content: text('content').default('').notNull(),
    attachmentUrl: text('attachment_url'),
    attachmentName: text('attachment_name'),
    attachmentType: text('attachment_type'),
    attachmentSize: integer('attachment_size'),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('messages_conv_created_idx').on(table.conversationId, table.createdAt)]
);

// 12. Learning Sessions
export const learningSessions = pgTable(
  'learning_sessions',
  {
    id: serial('id').primaryKey(),
    matchId: integer('match_id')
      .references(() => matches.id, { onDelete: 'cascade' })
      .notNull(),
    hostId: integer('host_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    guestId: integer('guest_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    skillTopic: text('skill_topic').notNull(),
    scheduledAt: timestamp('scheduled_at').notNull(),
    durationMinutes: integer('duration_minutes').default(60).notNull(),
    status: text('status').default('scheduled').notNull(), // 'scheduled' | 'completed' | 'cancelled'
    notes: text('notes').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('learning_sessions_host_idx').on(table.hostId)]
);

// 13. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    profileId: integer('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(), // 'match' | 'message' | 'session' | 'project' | 'community'
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link').default('/').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('notifications_profile_idx').on(table.profileId, table.isRead)]
);

// 14. Communities
export const communities = pgTable('communities', {
  id: serial('id').primaryKey(),
  collegeId: integer('college_id').references(() => colleges.id, { onDelete: 'set null' }),
  departmentId: integer('department_id').references(() => departments.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 15. Community Members
export const communityMembers = pgTable(
  'community_members',
  {
    id: serial('id').primaryKey(),
    communityId: integer('community_id')
      .references(() => communities.id, { onDelete: 'cascade' })
      .notNull(),
    profileId: integer('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').default('member').notNull(),
    joinedAt: timestamp('joined_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('community_member_unique_idx').on(table.communityId, table.profileId)]
);

// 16. Community Posts
export const communityPosts = pgTable('community_posts', {
  id: serial('id').primaryKey(),
  communityId: integer('community_id')
    .references(() => communities.id, { onDelete: 'cascade' })
    .notNull(),
  authorId: integer('author_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  resourceUrl: text('resource_url').default('').notNull(),
  postType: text('post_type').default('discussion').notNull(), // 'discussion' | 'resource' | 'study_partner'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 17. Projects
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  collegeId: integer('college_id').references(() => colleges.id),
  title: text('title').notNull(),
  description: text('description').notNull(),
  requiredSkills: jsonb('required_skills').$type<string[]>().default([]).notNull(),
  status: text('status').default('recruiting').notNull(), // 'recruiting' | 'active' | 'completed'
  maxMembers: integer('max_members').default(4).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 18. Project Members / Applications
export const projectMembers = pgTable(
  'project_members',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    profileId: integer('profile_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    role: text('role').default('Contributor').notNull(),
    status: text('status').default('pending').notNull(), // 'pending' | 'accepted' | 'rejected'
    motivation: text('motivation').default('').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('project_member_unique_idx').on(table.projectId, table.profileId)]
);

// 19. Reports
export const reports = pgTable('reports', {
  id: serial('id').primaryKey(),
  reporterId: integer('reporter_id')
    .references(() => profiles.id, { onDelete: 'cascade' })
    .notNull(),
  targetProfileId: integer('target_profile_id').references(() => profiles.id, { onDelete: 'cascade' }),
  targetType: text('target_type').default('user').notNull(), // 'user' | 'post' | 'project' | 'message'
  targetId: integer('target_id'),
  reason: text('reason').notNull(),
  details: text('details').default('').notNull(),
  status: text('status').default('open').notNull(), // 'open' | 'reviewed' | 'resolved' | 'dismissed'
  reviewedBy: integer('reviewed_by').references(() => profiles.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 20. Blocks
export const blocks = pgTable(
  'blocks',
  {
    id: serial('id').primaryKey(),
    blockerId: integer('blocker_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    blockedId: integer('blocked_id')
      .references(() => profiles.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [uniqueIndex('blocks_pair_unique_idx').on(table.blockerId, table.blockedId)]
);

// Relations
export const collegesRelations = relations(colleges, ({ many }) => ({
  departments: many(departments),
  profiles: many(profiles),
}));

export const departmentsRelations = relations(departments, ({ one }) => ({
  college: one(colleges, { fields: [departments.collegeId], references: [colleges.id] }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  college: one(colleges, { fields: [profiles.collegeId], references: [colleges.id] }),
  department: one(departments, { fields: [profiles.departmentId], references: [departments.id] }),
  teachingSkills: many(userTeachingSkills),
  learningSkills: many(userLearningSkills),
}));

export const userTeachingSkillsRelations = relations(userTeachingSkills, ({ one }) => ({
  profile: one(profiles, { fields: [userTeachingSkills.profileId], references: [profiles.id] }),
  skill: one(skills, { fields: [userTeachingSkills.skillId], references: [skills.id] }),
}));

export const userLearningSkillsRelations = relations(userLearningSkills, ({ one }) => ({
  profile: one(profiles, { fields: [userLearningSkills.profileId], references: [profiles.id] }),
  skill: one(skills, { fields: [userLearningSkills.skillId], references: [skills.id] }),
}));
