import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { WebSocketServer, WebSocket } from 'ws';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { createServer as createViteServer } from 'vite';

import { db } from './src/db/index.ts';
import {
  blocks,
  colleges,
  communities,
  communityMembers,
  communityPosts,
  conversationMembers,
  conversations,
  departments,
  learningSessions,
  likes,
  matches,
  messages,
  notifications,
  profiles,
  projectMembers,
  projects,
  reports,
  skills,
  userLearningSkills,
  userTeachingSkills,
} from './src/db/schema.ts';
import { ensureSeeded } from './src/db/seed.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { computeCompatibility } from './src/lib/matching.ts';
import { generateMatchInsight } from './src/lib/gemini.ts';
import { AuthRequest, getOrCreateProfile, rateLimit, requireAdmin, requireAuth } from './src/middleware/auth.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_ATTACHMENT_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

function sanitizeExternalUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    return '';
  }
  return '';
}

function toPublicProfile(
  p: typeof profiles.$inferSelect,
  collegeMap: Map<number, typeof colleges.$inferSelect>,
  deptMap: Map<number, typeof departments.$inferSelect>,
  teachList: { skillId: number; name: string; category: string; level: string; description: string }[],
  learnList: { skillId: number; name: string; category: string; level: string; notes: string }[]
) {
  const college = p.collegeId ? collegeMap.get(p.collegeId) : undefined;
  const dept = p.departmentId ? deptMap.get(p.departmentId) : undefined;
  return {
    id: p.id,
    fullName: p.fullName,
    username: p.username,
    avatarUrl: p.avatarUrl,
    collegeId: p.collegeId,
    collegeName: college?.name || 'Bankura Unnayani Institute of Engineering',
    collegeShortName: college?.shortName || 'BUIE',
    departmentId: p.departmentId,
    departmentName: dept?.name || 'Computer Science & Engineering',
    departmentCode: dept?.code || 'CSE',
    academicYear: p.academicYear,
    bio: p.bio,
    experienceLevel: p.experienceLevel,
    preferredLanguages: p.preferredLanguages,
    availability: p.availability,
    githubUrl: p.githubUrl,
    linkedinUrl: p.linkedinUrl,
    portfolioUrl: p.portfolioUrl,
    isPublic: p.isPublic,
    lastActiveAt: p.lastActiveAt,
    teachingSkills: teachList,
    learningSkills: learnList,
  };
}

async function loadCatalogMaps() {
  const [allColleges, allDepts, allSkills] = await Promise.all([
    db.select().from(colleges).orderBy(colleges.name),
    db.select().from(departments).orderBy(departments.name),
    db.select().from(skills).orderBy(skills.category, skills.name),
  ]);
  return {
    allColleges,
    allDepts,
    allSkills,
    collegeMap: new Map(allColleges.map((c) => [c.id, c])),
    deptMap: new Map(allDepts.map((d) => [d.id, d])),
    skillMap: new Map(allSkills.map((s) => [s.id, s])),
  };
}

async function loadProfileSkills(profileIds: number[]) {
  if (profileIds.length === 0) {
    return {
      teachByProfile: new Map<number, any[]>(),
      learnByProfile: new Map<number, any[]>(),
    };
  }
  const [teachRows, learnRows, allSkills] = await Promise.all([
    db.select().from(userTeachingSkills).where(inArray(userTeachingSkills.profileId, profileIds)),
    db.select().from(userLearningSkills).where(inArray(userLearningSkills.profileId, profileIds)),
    db.select().from(skills),
  ]);
  const skillMap = new Map(allSkills.map((s) => [s.id, s]));
  const teachByProfile = new Map<number, any[]>();
  const learnByProfile = new Map<number, any[]>();

  for (const row of teachRows) {
    const sk = skillMap.get(row.skillId);
    if (!sk) continue;
    const list = teachByProfile.get(row.profileId) || [];
    list.push({
      id: row.id,
      skillId: sk.id,
      name: sk.name,
      category: sk.category,
      level: row.level,
      description: row.description,
    });
    teachByProfile.set(row.profileId, list);
  }

  for (const row of learnRows) {
    const sk = skillMap.get(row.skillId);
    if (!sk) continue;
    const list = learnByProfile.get(row.profileId) || [];
    list.push({
      id: row.id,
      skillId: sk.id,
      name: sk.name,
      category: sk.category,
      level: row.targetLevel,
      notes: row.notes,
    });
    learnByProfile.set(row.profileId, list);
  }

  return { teachByProfile, learnByProfile };
}

async function isBlockedBetween(profileA: number, profileB: number): Promise<boolean> {
  const rows = await db
    .select()
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, profileA), eq(blocks.blockedId, profileB)),
        and(eq(blocks.blockerId, profileB), eq(blocks.blockedId, profileA))
      )
    )
    .limit(1);
  return rows.length > 0;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  const server = http.createServer(app);

  // WebSocket hub keyed by profileId
  const onlineClients = new Map<number, Set<WebSocket>>();

  function sendToProfile(profileId: number, payload: unknown) {
    const sockets = onlineClients.get(profileId);
    if (!sockets) return;
    const serialized = JSON.stringify(payload);
    for (const ws of sockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(serialized);
      }
    }
  }

  function broadcastPresence(profileId: number, online: boolean) {
    const serialized = JSON.stringify({ type: 'presence:update', profileId, online });
    for (const sockets of onlineClients.values()) {
      for (const ws of sockets) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(serialized);
        }
      }
    }
  }

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', async (ws, req) => {
    let authedProfileId: number | null = null;
    try {
      const reqUrl = new URL(req.url || '/ws', 'http://localhost');
      const token = reqUrl.searchParams.get('token');
      if (!token) {
        ws.close(4001, 'Missing auth token');
        return;
      }
      const decoded = await adminAuth.verifyIdToken(token);
      const profile = await getOrCreateProfile(decoded);
      if (profile.isSuspended) {
        ws.close(4003, 'Account suspended');
        return;
      }
      authedProfileId = profile.id;
      const set = onlineClients.get(authedProfileId) || new Set<WebSocket>();
      set.add(ws);
      onlineClients.set(authedProfileId, set);

      ws.send(
        JSON.stringify({
          type: 'connected',
          profileId: authedProfileId,
          onlineProfileIds: Array.from(onlineClients.keys()),
        })
      );
      broadcastPresence(authedProfileId, true);
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    ws.on('message', async (raw) => {
      if (!authedProfileId) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === 'typing:start' || msg.type === 'typing:stop') {
          const conversationId = Number(msg.conversationId);
          if (!conversationId) return;
          const members = await db
            .select()
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, conversationId));
          const isMember = members.some((m) => m.profileId === authedProfileId);
          if (!isMember) return;
          for (const m of members) {
            if (m.profileId !== authedProfileId) {
              sendToProfile(m.profileId, {
                type: msg.type,
                conversationId,
                profileId: authedProfileId,
              });
            }
          }
        } else if (
          msg.type === 'call:offer' ||
          msg.type === 'call:answer' ||
          msg.type === 'call:ice' ||
          msg.type === 'call:reject' ||
          msg.type === 'call:end'
        ) {
          const targetProfileId = Number(msg.targetProfileId);
          const matchId = Number(msg.matchId);
          if (!targetProfileId || !matchId) return;

          // Verify valid match and no block before forwarding WebRTC signaling
          const [u1, u2] =
            authedProfileId < targetProfileId
              ? [authedProfileId, targetProfileId]
              : [targetProfileId, authedProfileId];
          const [matchRow] = await db
            .select()
            .from(matches)
            .where(and(eq(matches.id, matchId), eq(matches.user1Id, u1), eq(matches.user2Id, u2)))
            .limit(1);
          if (!matchRow) return;
          if (await isBlockedBetween(authedProfileId, targetProfileId)) return;

          sendToProfile(targetProfileId, {
            ...msg,
            fromProfileId: authedProfileId,
          });
        }
      } catch {
        // Ignore malformed WS packets
      }
    });

    ws.on('close', () => {
      if (!authedProfileId) return;
      const set = onlineClients.get(authedProfileId);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          onlineClients.delete(authedProfileId);
          broadcastPresence(authedProfileId, false);
        }
      }
    });
  });

  // Public Landing Data (no PII/emails)
  app.get('/api/public/landing', async (_req, res) => {
    try {
      await ensureSeeded();
      const [allColleges, allDepts, allSkills, allProfiles, allMatches, allSessions] = await Promise.all([
        db.select().from(colleges),
        db.select().from(departments),
        db.select().from(skills),
        db.select().from(profiles).where(and(eq(profiles.isPublic, true), eq(profiles.isSuspended, false))),
        db.select().from(matches),
        db.select().from(learningSessions),
      ]);

      const collegeMap = new Map(allColleges.map((c) => [c.id, c]));
      const deptMap = new Map(allDepts.map((d) => [d.id, d]));
      const previewProfiles = allProfiles.slice(0, 4);
      const { teachByProfile, learnByProfile } = await loadProfileSkills(previewProfiles.map((p) => p.id));

      res.json({
        stats: {
          students: allProfiles.length,
          colleges: allColleges.length,
          skills: allSkills.length,
          matches: allMatches.length,
          sessions: allSessions.length,
        },
        featuredSkills: allSkills.slice(0, 12),
        colleges: allColleges,
        featuredStudents: previewProfiles.map((p) =>
          toPublicProfile(
            p,
            collegeMap,
            deptMap,
            teachByProfile.get(p.id) || [],
            learnByProfile.get(p.id) || []
          )
        ),
      });
    } catch (error) {
      console.error('Landing error:', error);
      res.status(500).json({ error: 'Failed to load landing data' });
    }
  });

  // Auth Sync & Bootstrap
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      await ensureSeeded();
      const profile = req.profile!;
      const { allColleges, allDepts, allSkills, collegeMap, deptMap } = await loadCatalogMaps();

      // Default new student to BUIE & CSE if unset so they have clean initial state
      let activeProfile = profile;
      if (!activeProfile.collegeId && allColleges.length > 0) {
        const buie = allColleges[0];
        const cse = allDepts.find((d) => d.collegeId === buie.id);
        const [updated] = await db
          .update(profiles)
          .set({
            collegeId: buie.id,
            departmentId: cse?.id || null,
          })
          .where(eq(profiles.id, activeProfile.id))
          .returning();
        activeProfile = updated;

        // Seed two realistic community welcome interests from BUIE ambassadors so preview users
        // can experience both one-way pending likes AND real mutual matches when liking back.
        const ambassadors = await db
          .select()
          .from(profiles)
          .where(inArray(profiles.uid, ['seed_buie_arjun', 'seed_buie_ananya']));
        for (const amb of ambassadors) {
          await db
            .insert(likes)
            .values({ fromProfileId: amb.id, toProfileId: activeProfile.id, action: 'like' })
            .onConflictDoNothing();
        }
      }

      const { teachByProfile, learnByProfile } = await loadProfileSkills([activeProfile.id]);

      res.json({
        profile: {
          ...toPublicProfile(
            activeProfile,
            collegeMap,
            deptMap,
            teachByProfile.get(activeProfile.id) || [],
            learnByProfile.get(activeProfile.id) || []
          ),
          email: activeProfile.email,
          role: activeProfile.role,
          onboardingCompleted: activeProfile.onboardingCompleted,
        },
        colleges: allColleges,
        departments: allDepts,
        skillsCatalog: allSkills,
      });
    } catch (error) {
      console.error('Auth sync failed:', error);
      res.status(500).json({ error: 'Failed to synchronize account' });
    }
  });

  // Update Profile (Module 3)
  app.put('/api/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const body = req.body || {};

      const fullName = typeof body.fullName === 'string' && body.fullName.trim() ? body.fullName.trim().slice(0, 80) : me.fullName;
      const username =
        typeof body.username === 'string' && body.username.trim()
          ? body.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)
          : me.username;

      if (username !== me.username) {
        const dup = await db
          .select()
          .from(profiles)
          .where(and(eq(profiles.username, username), ne(profiles.id, me.id)))
          .limit(1);
        if (dup.length > 0) {
          return res.status(409).json({ error: 'That username is already taken.' });
        }
      }

      let nextAvatarUrl = me.avatarUrl;
      if (typeof body.avatarUrl === 'string') {
        const rawAvatar = body.avatarUrl.trim();
        if (rawAvatar === '') {
          nextAvatarUrl = '';
        } else if (rawAvatar.startsWith('/src/assets/images/') && rawAvatar.length <= 300) {
          nextAvatarUrl = rawAvatar;
        } else if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(rawAvatar)) {
          if (rawAvatar.length > 1_400_000) {
            return res.status(400).json({ error: 'Profile photo is too large (max 1MB).' });
          }
          nextAvatarUrl = rawAvatar;
        } else {
          const safeUrl = sanitizeExternalUrl(rawAvatar);
          if (!safeUrl || safeUrl.length > 500) {
            return res.status(400).json({ error: 'Invalid profile photo URL or image format.' });
          }
          nextAvatarUrl = safeUrl;
        }
      }

      const [updated] = await db
        .update(profiles)
        .set({
          fullName,
          username,
          avatarUrl: nextAvatarUrl,
          collegeId: body.collegeId ? Number(body.collegeId) : me.collegeId,
          departmentId: body.departmentId ? Number(body.departmentId) : me.departmentId,
          academicYear: typeof body.academicYear === 'string' ? body.academicYear.slice(0, 30) : me.academicYear,
          bio: typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : me.bio,
          experienceLevel: typeof body.experienceLevel === 'string' ? body.experienceLevel : me.experienceLevel,
          preferredLanguages: Array.isArray(body.preferredLanguages)
            ? body.preferredLanguages.map(String).slice(0, 6)
            : me.preferredLanguages,
          availability: body.availability && typeof body.availability === 'object' ? body.availability : me.availability,
          githubUrl: sanitizeExternalUrl(body.githubUrl),
          linkedinUrl: sanitizeExternalUrl(body.linkedinUrl),
          portfolioUrl: sanitizeExternalUrl(body.portfolioUrl),
          isPublic: typeof body.isPublic === 'boolean' ? body.isPublic : me.isPublic,
          onboardingCompleted: typeof body.onboardingCompleted === 'boolean' ? body.onboardingCompleted : true,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, me.id))
        .returning();

      const { collegeMap, deptMap } = await loadCatalogMaps();
      const { teachByProfile, learnByProfile } = await loadProfileSkills([updated.id]);

      res.json({
        profile: {
          ...toPublicProfile(
            updated,
            collegeMap,
            deptMap,
            teachByProfile.get(updated.id) || [],
            learnByProfile.get(updated.id) || []
          ),
          email: updated.email,
          role: updated.role,
          onboardingCompleted: updated.onboardingCompleted,
        },
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Skill Management (Module 4)
  app.get('/api/skills', requireAuth, async (req: AuthRequest, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
      const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
      const all = await db.select().from(skills).orderBy(skills.category, skills.name);
      const filtered = all.filter((s) => {
        if (category && category !== 'All' && s.category !== category) return false;
        if (q && !s.name.toLowerCase().includes(q) && !s.category.toLowerCase().includes(q)) return false;
        return true;
      });
      res.json({ skills: filtered });
    } catch (error) {
      console.error('Skills fetch error:', error);
      res.status(500).json({ error: 'Failed to load skills' });
    }
  });

  app.post('/api/skills/teaching', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      let skillId = req.body.skillId ? Number(req.body.skillId) : 0;
      const customName = typeof req.body.customName === 'string' ? req.body.customName.trim().slice(0, 60) : '';
      const category = typeof req.body.category === 'string' ? req.body.category.trim() : 'Backend & Cloud';
      const level = typeof req.body.level === 'string' ? req.body.level : 'Intermediate';
      const description = typeof req.body.description === 'string' ? req.body.description.trim().slice(0, 240) : '';

      if (!skillId && customName) {
        const existing = await db.select().from(skills).where(eq(skills.name, customName)).limit(1);
        if (existing.length > 0) {
          skillId = existing[0].id;
        } else {
          const [created] = await db
            .insert(skills)
            .values({ name: customName, category, description: `${customName} peer skill` })
            .returning();
          skillId = created.id;
        }
      }
      if (!skillId) return res.status(400).json({ error: 'Select or enter a skill name.' });

      await db
        .insert(userTeachingSkills)
        .values({ profileId: me.id, skillId, level, description })
        .onConflictDoUpdate({
          target: [userTeachingSkills.profileId, userTeachingSkills.skillId],
          set: { level, description },
        });

      const { teachByProfile, learnByProfile } = await loadProfileSkills([me.id]);
      const allSkills = await db.select().from(skills).orderBy(skills.category, skills.name);
      res.json({
        teachingSkills: teachByProfile.get(me.id) || [],
        learningSkills: learnByProfile.get(me.id) || [],
        skillsCatalog: allSkills,
      });
    } catch (error) {
      console.error('Add teaching skill error:', error);
      res.status(500).json({ error: 'Failed to save teaching skill' });
    }
  });

  app.put('/api/skills/teaching/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const id = Number(req.params.id);
      await db
        .update(userTeachingSkills)
        .set({
          level: typeof req.body.level === 'string' ? req.body.level : 'Intermediate',
          description: typeof req.body.description === 'string' ? req.body.description.slice(0, 240) : '',
        })
        .where(and(eq(userTeachingSkills.id, id), eq(userTeachingSkills.profileId, me.id)));

      const { teachByProfile } = await loadProfileSkills([me.id]);
      res.json({ teachingSkills: teachByProfile.get(me.id) || [] });
    } catch (error) {
      console.error('Update teaching skill error:', error);
      res.status(500).json({ error: 'Failed to update teaching skill' });
    }
  });

  app.delete('/api/skills/teaching/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const id = Number(req.params.id);
      await db
        .delete(userTeachingSkills)
        .where(and(eq(userTeachingSkills.id, id), eq(userTeachingSkills.profileId, me.id)));
      const { teachByProfile } = await loadProfileSkills([me.id]);
      res.json({ teachingSkills: teachByProfile.get(me.id) || [] });
    } catch (error) {
      console.error('Delete teaching skill error:', error);
      res.status(500).json({ error: 'Failed to remove teaching skill' });
    }
  });

  app.post('/api/skills/learning', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      let skillId = req.body.skillId ? Number(req.body.skillId) : 0;
      const customName = typeof req.body.customName === 'string' ? req.body.customName.trim().slice(0, 60) : '';
      const category = typeof req.body.category === 'string' ? req.body.category.trim() : 'AI & Data Science';
      const targetLevel = typeof req.body.level === 'string' ? req.body.level : 'Intermediate';
      const notes = typeof req.body.notes === 'string' ? req.body.notes.trim().slice(0, 240) : '';

      if (!skillId && customName) {
        const existing = await db.select().from(skills).where(eq(skills.name, customName)).limit(1);
        if (existing.length > 0) {
          skillId = existing[0].id;
        } else {
          const [created] = await db
            .insert(skills)
            .values({ name: customName, category, description: `${customName} peer skill` })
            .returning();
          skillId = created.id;
        }
      }
      if (!skillId) return res.status(400).json({ error: 'Select or enter a skill name.' });

      await db
        .insert(userLearningSkills)
        .values({ profileId: me.id, skillId, targetLevel, notes })
        .onConflictDoUpdate({
          target: [userLearningSkills.profileId, userLearningSkills.skillId],
          set: { targetLevel, notes },
        });

      const { teachByProfile, learnByProfile } = await loadProfileSkills([me.id]);
      const allSkills = await db.select().from(skills).orderBy(skills.category, skills.name);
      res.json({
        teachingSkills: teachByProfile.get(me.id) || [],
        learningSkills: learnByProfile.get(me.id) || [],
        skillsCatalog: allSkills,
      });
    } catch (error) {
      console.error('Add learning skill error:', error);
      res.status(500).json({ error: 'Failed to save learning interest' });
    }
  });

  app.put('/api/skills/learning/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const id = Number(req.params.id);
      await db
        .update(userLearningSkills)
        .set({
          targetLevel: typeof req.body.level === 'string' ? req.body.level : 'Intermediate',
          notes: typeof req.body.notes === 'string' ? req.body.notes.slice(0, 240) : '',
        })
        .where(and(eq(userLearningSkills.id, id), eq(userLearningSkills.profileId, me.id)));

      const { learnByProfile } = await loadProfileSkills([me.id]);
      res.json({ learningSkills: learnByProfile.get(me.id) || [] });
    } catch (error) {
      console.error('Update learning skill error:', error);
      res.status(500).json({ error: 'Failed to update learning interest' });
    }
  });

  app.delete('/api/skills/learning/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const id = Number(req.params.id);
      await db
        .delete(userLearningSkills)
        .where(and(eq(userLearningSkills.id, id), eq(userLearningSkills.profileId, me.id)));
      const { learnByProfile } = await loadProfileSkills([me.id]);
      res.json({ learningSkills: learnByProfile.get(me.id) || [] });
    } catch (error) {
      console.error('Delete learning skill error:', error);
      res.status(500).json({ error: 'Failed to remove learning interest' });
    }
  });

  // Discovery & Swipe Matching (Module 5)
  app.get('/api/discover', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const collegeFilter = req.query.collegeId ? Number(req.query.collegeId) : null;
      const categoryFilter = typeof req.query.category === 'string' ? req.query.category : '';

      const [myLikes, myBlocks, blockedMe, myMatches, allCandidates] = await Promise.all([
        db.select().from(likes).where(eq(likes.fromProfileId, me.id)),
        db.select().from(blocks).where(eq(blocks.blockerId, me.id)),
        db.select().from(blocks).where(eq(blocks.blockedId, me.id)),
        db.select().from(matches).where(or(eq(matches.user1Id, me.id), eq(matches.user2Id, me.id))),
        db
          .select()
          .from(profiles)
          .where(and(ne(profiles.id, me.id), eq(profiles.isPublic, true), eq(profiles.isSuspended, false))),
      ]);

      const excludedIds = new Set<number>([me.id]);
      const passedTargetIds = new Set<number>();
      myLikes.forEach((l) => {
        excludedIds.add(l.toProfileId);
        if (l.action === 'pass') passedTargetIds.add(l.toProfileId);
      });
      myBlocks.forEach((b) => {
        excludedIds.add(b.blockedId);
        passedTargetIds.delete(b.blockedId);
      });
      blockedMe.forEach((b) => {
        excludedIds.add(b.blockerId);
        passedTargetIds.delete(b.blockerId);
      });
      myMatches.forEach((m) => {
        const partnerId = m.user1Id === me.id ? m.user2Id : m.user1Id;
        excludedIds.add(partnerId);
        passedTargetIds.delete(partnerId);
      });

      const eligible = allCandidates.filter((c) => {
        if (excludedIds.has(c.id)) return false;
        if (collegeFilter && c.collegeId !== collegeFilter) return false;
        return true;
      });

      const passedCandidatesMatchingCollege = allCandidates.filter((c) => {
        if (!passedTargetIds.has(c.id)) return false;
        if (collegeFilter && c.collegeId !== collegeFilter) return false;
        return true;
      });

      const { collegeMap, deptMap } = await loadCatalogMaps();
      const { teachByProfile, learnByProfile } = await loadProfileSkills([
        me.id,
        ...eligible.map((c) => c.id),
        ...passedCandidatesMatchingCollege.map((c) => c.id),
      ]);

      const meCandidate = {
        id: me.id,
        fullName: me.fullName,
        collegeId: me.collegeId,
        departmentId: me.departmentId,
        experienceLevel: me.experienceLevel,
        preferredLanguages: me.preferredLanguages || [],
        availability: me.availability,
        teachingSkills: teachByProfile.get(me.id) || [],
        learningSkills: learnByProfile.get(me.id) || [],
      };

      let cards = eligible.map((c) => {
        const teach = teachByProfile.get(c.id) || [];
        const learn = learnByProfile.get(c.id) || [];
        const { score, breakdown } = computeCompatibility(meCandidate, {
          id: c.id,
          fullName: c.fullName,
          collegeId: c.collegeId,
          departmentId: c.departmentId,
          experienceLevel: c.experienceLevel,
          preferredLanguages: c.preferredLanguages || [],
          availability: c.availability,
          teachingSkills: teach,
          learningSkills: learn,
        });
        return {
          ...toPublicProfile(c, collegeMap, deptMap, teach, learn),
          compatibilityScore: score,
          compatibilityBreakdown: breakdown,
          isOnline: onlineClients.has(c.id),
        };
      });

      let passedInFilterCount = passedCandidatesMatchingCollege.length;
      if (categoryFilter && categoryFilter !== 'All') {
        cards = cards.filter(
          (c) =>
            c.teachingSkills.some((s: any) => s.category === categoryFilter) ||
            c.learningSkills.some((s: any) => s.category === categoryFilter)
        );
        passedInFilterCount = passedCandidatesMatchingCollege.filter((c) => {
          const teach = teachByProfile.get(c.id) || [];
          const learn = learnByProfile.get(c.id) || [];
          return (
            teach.some((s: any) => s.category === categoryFilter) ||
            learn.some((s: any) => s.category === categoryFilter)
          );
        }).length;
      }

      cards.sort((a, b) => b.compatibilityScore - a.compatibilityScore || a.id - b.id);

      const canUndo = myLikes.some((l) => l.action === 'pass');
      res.json({ candidates: cards, canUndo, passedInFilterCount });
    } catch (error) {
      console.error('Discover error:', error);
      res.status(500).json({ error: 'Failed to load discovery candidates' });
    }
  });

  app.post('/api/discover/reset-passes', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const collegeFilter = req.body?.collegeId ? Number(req.body.collegeId) : null;
      const categoryFilter = typeof req.body?.category === 'string' ? req.body.category : '';

      const myPasses = await db
        .select()
        .from(likes)
        .where(and(eq(likes.fromProfileId, me.id), eq(likes.action, 'pass')));

      if (myPasses.length === 0) {
        return res.json({ ok: true, resetCount: 0 });
      }

      const targetIds = myPasses.map((p) => p.toProfileId);
      let idsToClear = targetIds;

      if (collegeFilter || (categoryFilter && categoryFilter !== 'All')) {
        const targetProfiles = await db
          .select()
          .from(profiles)
          .where(inArray(profiles.id, targetIds));
        const { teachByProfile, learnByProfile } = await loadProfileSkills(targetIds);

        idsToClear = targetProfiles
          .filter((p) => {
            if (collegeFilter && p.collegeId !== collegeFilter) return false;
            if (categoryFilter && categoryFilter !== 'All') {
              const teach = teachByProfile.get(p.id) || [];
              const learn = learnByProfile.get(p.id) || [];
              return (
                teach.some((s: any) => s.category === categoryFilter) ||
                learn.some((s: any) => s.category === categoryFilter)
              );
            }
            return true;
          })
          .map((p) => p.id);
      }

      if (idsToClear.length > 0) {
        await db
          .delete(likes)
          .where(
            and(
              eq(likes.fromProfileId, me.id),
              eq(likes.action, 'pass'),
              inArray(likes.toProfileId, idsToClear)
            )
          );
      }

      res.json({ ok: true, resetCount: idsToClear.length });
    } catch (error) {
      console.error('Reset passes error:', error);
      res.status(500).json({ error: 'Failed to reset passed students' });
    }
  });

  app.post('/api/discover/action', requireAuth, rateLimit('discover_action', 120, 60_000), async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const targetId = Number(req.body.targetProfileId);
      const action = req.body.action === 'like' ? 'like' : req.body.action === 'pass' ? 'pass' : null;
      if (!targetId || !action || targetId === me.id) {
        return res.status(400).json({ error: 'Invalid discovery action' });
      }

      if (await isBlockedBetween(me.id, targetId)) {
        return res.status(403).json({ error: 'Cannot interact with a blocked profile' });
      }

      const [target] = await db.select().from(profiles).where(eq(profiles.id, targetId)).limit(1);
      if (!target || target.isSuspended) {
        return res.status(404).json({ error: 'Student profile not found' });
      }

      // Prevent duplicate like/pass mutation overwriting existing match
      await db
        .insert(likes)
        .values({ fromProfileId: me.id, toProfileId: targetId, action })
        .onConflictDoUpdate({
          target: [likes.fromProfileId, likes.toProfileId],
          set: { action },
        });

      let matched = false;
      let matchRecord: any = null;

      if (action === 'like') {
        let reciprocal = await db
          .select()
          .from(likes)
          .where(and(eq(likes.fromProfileId, targetId), eq(likes.toProfileId, me.id), eq(likes.action, 'like')))
          .limit(1);

        // Seeded preview peers have no interactive human session to swipe back manually,
        // so liking a seeded preview student completes the mutual connection flow.
        if (reciprocal.length === 0 && target.uid.startsWith('seed_')) {
          await db
            .insert(likes)
            .values({ fromProfileId: targetId, toProfileId: me.id, action: 'like' })
            .onConflictDoUpdate({
              target: [likes.fromProfileId, likes.toProfileId],
              set: { action: 'like' },
            });
          reciprocal = await db
            .select()
            .from(likes)
            .where(and(eq(likes.fromProfileId, targetId), eq(likes.toProfileId, me.id), eq(likes.action, 'like')))
            .limit(1);
        }

        if (reciprocal.length > 0) {
          const [u1, u2] = me.id < targetId ? [me.id, targetId] : [targetId, me.id];
          const existingMatch = await db
            .select()
            .from(matches)
            .where(and(eq(matches.user1Id, u1), eq(matches.user2Id, u2)))
            .limit(1);

          if (existingMatch.length === 0) {
            const { teachByProfile, learnByProfile } = await loadProfileSkills([me.id, targetId]);
            const { score, breakdown } = computeCompatibility(
              {
                id: me.id,
                fullName: me.fullName,
                collegeId: me.collegeId,
                departmentId: me.departmentId,
                experienceLevel: me.experienceLevel,
                preferredLanguages: me.preferredLanguages || [],
                availability: me.availability,
                teachingSkills: teachByProfile.get(me.id) || [],
                learningSkills: learnByProfile.get(me.id) || [],
              },
              {
                id: target.id,
                fullName: target.fullName,
                collegeId: target.collegeId,
                departmentId: target.departmentId,
                experienceLevel: target.experienceLevel,
                preferredLanguages: target.preferredLanguages || [],
                availability: target.availability,
                teachingSkills: teachByProfile.get(target.id) || [],
                learningSkills: learnByProfile.get(target.id) || [],
              }
            );

            const [newMatch] = await db
              .insert(matches)
              .values({
                user1Id: u1,
                user2Id: u2,
                compatibilityScore: score,
                compatibilityBreakdown: breakdown,
              })
              .returning();

            const [conv] = await db
              .insert(conversations)
              .values({ matchId: newMatch.id })
              .returning();

            await db.insert(conversationMembers).values([
              { conversationId: conv.id, profileId: me.id },
              { conversationId: conv.id, profileId: targetId },
            ]);

            await db.insert(notifications).values([
              {
                profileId: me.id,
                type: 'match',
                title: `New match with ${target.fullName}`,
                body: `You and ${target.fullName} have a ${score}% skill compatibility match. Start chatting!`,
                link: '/matches',
              },
              {
                profileId: targetId,
                type: 'match',
                title: `New match with ${me.fullName}`,
                body: `You and ${me.fullName} matched at ${score}% compatibility.`,
                link: '/matches',
              },
            ]);

            matched = true;
            matchRecord = { matchId: newMatch.id, conversationId: conv.id, compatibilityScore: score };
            sendToProfile(me.id, { type: 'match:created', match: matchRecord, partnerName: target.fullName });
            sendToProfile(targetId, { type: 'match:created', match: matchRecord, partnerName: me.fullName });
          } else {
            matched = true;
            const [conv] = await db
              .select()
              .from(conversations)
              .where(eq(conversations.matchId, existingMatch[0].id))
              .limit(1);
            matchRecord = {
              matchId: existingMatch[0].id,
              conversationId: conv?.id,
              compatibilityScore: existingMatch[0].compatibilityScore,
            };
          }
        } else {
          // Real student user: pending until they reciprocate
          await db.insert(notifications).values({
            profileId: targetId,
            type: 'match',
            title: `${me.fullName} wants to connect`,
            body: `${me.fullName} liked your profile on SkillBridge. Open Matches to accept or pass.`,
            link: '/matches',
          });
        }
      }

      res.json({
        ok: true,
        matched,
        pending: action === 'like' && !matched,
        match: matchRecord,
      });
    } catch (error) {
      console.error('Discover action error:', error);
      res.status(500).json({ error: 'Failed to process swipe action' });
    }
  });

  app.post('/api/discover/undo', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const lastPasses = await db
        .select()
        .from(likes)
        .where(and(eq(likes.fromProfileId, me.id), eq(likes.action, 'pass')))
        .orderBy(desc(likes.createdAt))
        .limit(1);

      if (lastPasses.length === 0) {
        return res.status(404).json({ error: 'No recent pass action available to undo.' });
      }
      await db.delete(likes).where(eq(likes.id, lastPasses[0].id));
      res.json({ ok: true, restoredProfileId: lastPasses[0].toProfileId });
    } catch (error) {
      console.error('Undo error:', error);
      res.status(500).json({ error: 'Failed to undo last action' });
    }
  });

  // Match Management (Module 6)
  app.get('/api/matches', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const [myMatches, outgoingLikes, incomingLikes, myBlocks, blockedMe] = await Promise.all([
        db
          .select()
          .from(matches)
          .where(or(eq(matches.user1Id, me.id), eq(matches.user2Id, me.id)))
          .orderBy(desc(matches.matchedAt)),
        db
          .select()
          .from(likes)
          .where(and(eq(likes.fromProfileId, me.id), eq(likes.action, 'like'))),
        db
          .select()
          .from(likes)
          .where(and(eq(likes.toProfileId, me.id), eq(likes.action, 'like'))),
        db.select().from(blocks).where(eq(blocks.blockerId, me.id)),
        db.select().from(blocks).where(eq(blocks.blockedId, me.id)),
      ]);

      const blockedIds = new Set<number>();
      myBlocks.forEach((b) => blockedIds.add(b.blockedId));
      blockedMe.forEach((b) => blockedIds.add(b.blockerId));

      const matchedPartnerIds = new Set<number>();
      myMatches.forEach((m) => matchedPartnerIds.add(m.user1Id === me.id ? m.user2Id : m.user1Id));

      // Also exclude targets I already passed on from incoming requests
      const myPasses = await db
        .select()
        .from(likes)
        .where(and(eq(likes.fromProfileId, me.id), eq(likes.action, 'pass')));
      const passedByMeIds = new Set(myPasses.map((p) => p.toProfileId));

      const pendingIncoming = incomingLikes.filter(
        (l) => !matchedPartnerIds.has(l.fromProfileId) && !blockedIds.has(l.fromProfileId) && !passedByMeIds.has(l.fromProfileId)
      );
      const pendingSent = outgoingLikes.filter(
        (l) => !matchedPartnerIds.has(l.toProfileId) && !blockedIds.has(l.toProfileId)
      );

      const allRelatedIds = Array.from(
        new Set([
          me.id,
          ...matchedPartnerIds,
          ...pendingIncoming.map((l) => l.fromProfileId),
          ...pendingSent.map((l) => l.toProfileId),
        ])
      );
      const matchIds = myMatches.map((m) => m.id);

      const [partnerRows, convRows, { collegeMap, deptMap }, { teachByProfile, learnByProfile }] =
        await Promise.all([
          allRelatedIds.length ? db.select().from(profiles).where(inArray(profiles.id, allRelatedIds)) : Promise.resolve([]),
          matchIds.length ? db.select().from(conversations).where(inArray(conversations.matchId, matchIds)) : Promise.resolve([]),
          loadCatalogMaps(),
          loadProfileSkills(allRelatedIds),
        ]);

      const partnerMap = new Map(partnerRows.map((p) => [p.id, p]));
      const convByMatch = new Map(convRows.map((c) => [c.matchId, c.id]));

      const meCandidate = {
        id: me.id,
        fullName: me.fullName,
        collegeId: me.collegeId,
        departmentId: me.departmentId,
        experienceLevel: me.experienceLevel,
        preferredLanguages: me.preferredLanguages || [],
        availability: me.availability,
        teachingSkills: teachByProfile.get(me.id) || [],
        learningSkills: learnByProfile.get(me.id) || [],
      };

      const enriched = myMatches
        .map((m) => {
          const partnerId = m.user1Id === me.id ? m.user2Id : m.user1Id;
          const partner = partnerMap.get(partnerId);
          if (!partner || partner.isSuspended || blockedIds.has(partner.id)) return null;
          return {
            id: m.id,
            conversationId: convByMatch.get(m.id) || null,
            compatibilityScore: m.compatibilityScore,
            compatibilityBreakdown: m.compatibilityBreakdown,
            matchedAt: m.matchedAt,
            partner: {
              ...toPublicProfile(
                partner,
                collegeMap,
                deptMap,
                teachByProfile.get(partner.id) || [],
                learnByProfile.get(partner.id) || []
              ),
              isOnline: onlineClients.has(partner.id),
            },
          };
        })
        .filter(Boolean);

      const mapPending = (targetId: number, requestedAt: Date) => {
        const partner = partnerMap.get(targetId);
        if (!partner || partner.isSuspended) return null;
        const teach = teachByProfile.get(partner.id) || [];
        const learn = learnByProfile.get(partner.id) || [];
        const { score } = computeCompatibility(meCandidate, {
          id: partner.id,
          fullName: partner.fullName,
          collegeId: partner.collegeId,
          departmentId: partner.departmentId,
          experienceLevel: partner.experienceLevel,
          preferredLanguages: partner.preferredLanguages || [],
          availability: partner.availability,
          teachingSkills: teach,
          learningSkills: learn,
        });
        return {
          profile: {
            ...toPublicProfile(partner, collegeMap, deptMap, teach, learn),
            isOnline: onlineClients.has(partner.id),
          },
          compatibilityScore: score,
          requestedAt,
        };
      };

      const incomingRequests = pendingIncoming
        .map((l) => mapPending(l.fromProfileId, l.createdAt))
        .filter(Boolean);
      const sentRequests = pendingSent
        .map((l) => mapPending(l.toProfileId, l.createdAt))
        .filter(Boolean);

      res.json({ matches: enriched, incomingRequests, sentRequests });
    } catch (error) {
      console.error('Matches fetch error:', error);
      res.status(500).json({ error: 'Failed to load matches' });
    }
  });

  app.delete('/api/matches/request/:profileId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const targetId = Number(req.params.profileId);
      await db
        .delete(likes)
        .where(and(eq(likes.fromProfileId, me.id), eq(likes.toProfileId, targetId), eq(likes.action, 'like')));
      res.json({ ok: true });
    } catch (error) {
      console.error('Cancel request error:', error);
      res.status(500).json({ error: 'Failed to cancel connection request' });
    }
  });

  app.delete('/api/matches/:matchId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const matchId = Number(req.params.matchId);
      const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!m || (m.user1Id !== me.id && m.user2Id !== me.id)) {
        return res.status(404).json({ error: 'Match not found' });
      }
      await db.delete(matches).where(eq(matches.id, matchId));
      await db
        .delete(likes)
        .where(
          or(
            and(eq(likes.fromProfileId, m.user1Id), eq(likes.toProfileId, m.user2Id)),
            and(eq(likes.fromProfileId, m.user2Id), eq(likes.toProfileId, m.user1Id))
          )
        );
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete match error:', error);
      res.status(500).json({ error: 'Failed to remove connection' });
    }
  });

  // Real-time Chat (Module 7)
  app.get('/api/conversations', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const myMemberships = await db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.profileId, me.id));

      if (myMemberships.length === 0) return res.json({ conversations: [] });
      const convIds = myMemberships.map((m) => m.conversationId);

      const [convRows, allMembers, recentMsgs] = await Promise.all([
        db.select().from(conversations).where(inArray(conversations.id, convIds)).orderBy(desc(conversations.updatedAt)),
        db.select().from(conversationMembers).where(inArray(conversationMembers.conversationId, convIds)),
        db.select().from(messages).where(inArray(messages.conversationId, convIds)).orderBy(desc(messages.createdAt)),
      ]);

      const partnerIds = Array.from(
        new Set(allMembers.filter((m) => m.profileId !== me.id).map((m) => m.profileId))
      );
      const [partnerRows, { collegeMap, deptMap }, { teachByProfile, learnByProfile }] = await Promise.all([
        partnerIds.length ? db.select().from(profiles).where(inArray(profiles.id, partnerIds)) : Promise.resolve([]),
        loadCatalogMaps(),
        loadProfileSkills(partnerIds),
      ]);
      const partnerMap = new Map(partnerRows.map((p) => [p.id, p]));

      const list = convRows.map((conv) => {
        const otherMember = allMembers.find((m) => m.conversationId === conv.id && m.profileId !== me.id);
        const partner = otherMember ? partnerMap.get(otherMember.profileId) : undefined;
        const convMsgs = recentMsgs.filter((msg) => msg.conversationId === conv.id);
        const lastMessage = convMsgs[0] || null;
        const unreadCount = convMsgs.filter((msg) => msg.senderId !== me.id && !msg.isRead).length;

        return {
          id: conv.id,
          matchId: conv.matchId,
          updatedAt: conv.updatedAt,
          unreadCount,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content || (lastMessage.attachmentName ? `Attachment: ${lastMessage.attachmentName}` : ''),
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          partner: partner
            ? {
                ...toPublicProfile(
                  partner,
                  collegeMap,
                  deptMap,
                  teachByProfile.get(partner.id) || [],
                  learnByProfile.get(partner.id) || []
                ),
                isOnline: onlineClients.has(partner.id),
              }
            : null,
        };
      });

      res.json({ conversations: list.filter((c) => c.partner !== null) });
    } catch (error) {
      console.error('Conversations fetch error:', error);
      res.status(500).json({ error: 'Failed to load conversations' });
    }
  });

  app.get('/api/conversations/:id/messages', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const convId = Number(req.params.id);
      const members = await db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, convId));

      if (!members.some((m) => m.profileId === me.id)) {
        return res.status(403).json({ error: 'Access denied to this conversation' });
      }
      const partnerMember = members.find((m) => m.profileId !== me.id);
      if (partnerMember && (await isBlockedBetween(me.id, partnerMember.profileId))) {
        return res.status(403).json({ error: 'Conversation blocked' });
      }

      const rows = await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, convId))
        .orderBy(messages.createdAt);

      res.json({ messages: rows });
    } catch (error) {
      console.error('Messages fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.post('/api/conversations/:id/read', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const convId = Number(req.params.id);
      const members = await db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, convId));
      if (!members.some((m) => m.profileId === me.id)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await db
        .update(messages)
        .set({ isRead: true })
        .where(and(eq(messages.conversationId, convId), ne(messages.senderId, me.id), eq(messages.isRead, false)));

      for (const m of members) {
        if (m.profileId !== me.id) {
          sendToProfile(m.profileId, { type: 'message:read', conversationId: convId, readerId: me.id });
        }
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Read receipt error:', error);
      res.status(500).json({ error: 'Failed to mark messages as read' });
    }
  });

  app.post(
    '/api/conversations/:id/messages',
    requireAuth,
    rateLimit('send_message', 60, 60_000),
    async (req: AuthRequest, res) => {
      try {
        const me = req.profile!;
        const convId = Number(req.params.id);
        const members = await db
          .select()
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, convId));

        if (!members.some((m) => m.profileId === me.id)) {
          return res.status(403).json({ error: 'Only matched conversation members can send messages.' });
        }
        const partnerMember = members.find((m) => m.profileId !== me.id);
        if (partnerMember && (await isBlockedBetween(me.id, partnerMember.profileId))) {
          return res.status(403).json({ error: 'Cannot message a blocked user.' });
        }

        const content = typeof req.body.content === 'string' ? req.body.content.trim().slice(0, 4000) : '';
        let attachmentUrl: string | null = null;
        let attachmentName: string | null = null;
        let attachmentType: string | null = null;
        let attachmentSize: number | null = null;

        if (req.body.attachmentDataUrl) {
          const dataUrl = String(req.body.attachmentDataUrl);
          const mime = String(req.body.attachmentType || '');
          if (!ALLOWED_ATTACHMENT_MIMES.has(mime)) {
            return res.status(400).json({ error: 'Unsupported file type. Allowed: PNG, JPG, WEBP, GIF, PDF, TXT.' });
          }
          if (!dataUrl.startsWith(`data:${mime};base64,`) || dataUrl.length > 2_800_000) {
            return res.status(400).json({ error: 'Invalid or oversized file attachment (max 2MB).' });
          }
          attachmentUrl = dataUrl;
          attachmentName = String(req.body.attachmentName || 'attachment').slice(0, 120);
          attachmentType = mime;
          attachmentSize = Number(req.body.attachmentSize) || Math.floor(dataUrl.length * 0.75);
        }

        if (!content && !attachmentUrl) {
          return res.status(400).json({ error: 'Message content or attachment is required.' });
        }

        const [created] = await db
          .insert(messages)
          .values({
            conversationId: convId,
            senderId: me.id,
            content,
            attachmentUrl,
            attachmentName,
            attachmentType,
            attachmentSize,
          })
          .returning();

        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, convId));

        if (partnerMember) {
          await db.insert(notifications).values({
            profileId: partnerMember.profileId,
            type: 'message',
            title: `New message from ${me.fullName}`,
            body: content ? content.slice(0, 80) : `Sent ${attachmentName}`,
            link: `/chat?conv=${convId}`,
          });
          sendToProfile(partnerMember.profileId, { type: 'message:new', conversationId: convId, message: created });
        }
        sendToProfile(me.id, { type: 'message:new', conversationId: convId, message: created });

        res.json({ message: created });
      } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Failed to send message' });
      }
    }
  );

  // AI Skill Matching Insights (Module 10)
  app.post(
    '/api/ai/match-insights',
    requireAuth,
    rateLimit('ai_insights', 15, 60_000),
    async (req: AuthRequest, res) => {
      try {
        const me = req.profile!;
        const candidateId = Number(req.body.candidateId);
        if (!candidateId) return res.status(400).json({ error: 'candidateId is required' });

        const [candidate] = await db.select().from(profiles).where(eq(profiles.id, candidateId)).limit(1);
        if (!candidate || candidate.isSuspended) {
          return res.status(404).json({ error: 'Candidate not found' });
        }

        const [{ collegeMap, deptMap }, { teachByProfile, learnByProfile }] = await Promise.all([
          loadCatalogMaps(),
          loadProfileSkills([me.id, candidate.id]),
        ]);

        const myTeach = teachByProfile.get(me.id) || [];
        const myLearn = learnByProfile.get(me.id) || [];
        const candTeach = teachByProfile.get(candidate.id) || [];
        const candLearn = learnByProfile.get(candidate.id) || [];

        const { score, breakdown } = computeCompatibility(
          {
            id: me.id,
            fullName: me.fullName,
            collegeId: me.collegeId,
            departmentId: me.departmentId,
            experienceLevel: me.experienceLevel,
            preferredLanguages: me.preferredLanguages || [],
            availability: me.availability,
            teachingSkills: myTeach,
            learningSkills: myLearn,
          },
          {
            id: candidate.id,
            fullName: candidate.fullName,
            collegeId: candidate.collegeId,
            departmentId: candidate.departmentId,
            experienceLevel: candidate.experienceLevel,
            preferredLanguages: candidate.preferredLanguages || [],
            availability: candidate.availability,
            teachingSkills: candTeach,
            learningSkills: candLearn,
          }
        );

        const insight = await generateMatchInsight({
          me: {
            firstName: me.fullName.split(' ')[0],
            academicYear: me.academicYear,
            department: (me.departmentId ? deptMap.get(me.departmentId)?.name : '') || 'Engineering',
            teaching: myTeach.map((s: any) => s.name),
            learning: myLearn.map((s: any) => s.name),
          },
          candidate: {
            firstName: candidate.fullName.split(' ')[0],
            academicYear: candidate.academicYear,
            department: (candidate.departmentId ? deptMap.get(candidate.departmentId)?.name : '') || 'Engineering',
            college: (candidate.collegeId ? collegeMap.get(candidate.collegeId)?.shortName : '') || 'BUIE',
            teaching: candTeach.map((s: any) => s.name),
            learning: candLearn.map((s: any) => s.name),
          },
          compatibilityScore: score,
          matchedPairs: breakdown.matchedPairs,
        });

        res.json({ insight, compatibilityScore: score, breakdown });
      } catch (error: any) {
        console.error('AI insight error:', error);
        res.status(502).json({
          error: error?.message || 'Gemini AI advisor could not generate insights right now.',
        });
      }
    }
  );

  // Learning Dashboard & Sessions (Module 9)
  app.get('/api/learning/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const [mySessions, myMatches, { teachByProfile, learnByProfile }] = await Promise.all([
        db
          .select()
          .from(learningSessions)
          .where(or(eq(learningSessions.hostId, me.id), eq(learningSessions.guestId, me.id)))
          .orderBy(learningSessions.scheduledAt),
        db
          .select()
          .from(matches)
          .where(or(eq(matches.user1Id, me.id), eq(matches.user2Id, me.id))),
        loadProfileSkills([me.id]),
      ]);

      const partnerIds = Array.from(
        new Set([
          ...myMatches.map((m) => (m.user1Id === me.id ? m.user2Id : m.user1Id)),
          ...mySessions.map((s) => (s.hostId === me.id ? s.guestId : s.hostId)),
        ])
      );
      const partnerRows = partnerIds.length
        ? await db.select().from(profiles).where(inArray(profiles.id, partnerIds))
        : [];
      const partnerNameMap = new Map(partnerRows.map((p) => [p.id, { id: p.id, fullName: p.fullName, avatarUrl: p.avatarUrl }]));

      const now = Date.now();
      const upcomingSessions = mySessions
        .filter((s) => s.status === 'scheduled' && new Date(s.scheduledAt).getTime() >= now - 3600_000)
        .map((s) => ({
          ...s,
          partner: partnerNameMap.get(s.hostId === me.id ? s.guestId : s.hostId) || null,
          isHost: s.hostId === me.id,
        }));
      const completedSessions = mySessions
        .filter((s) => s.status === 'completed')
        .map((s) => ({
          ...s,
          partner: partnerNameMap.get(s.hostId === me.id ? s.guestId : s.hostId) || null,
          isHost: s.hostId === me.id,
        }));

      res.json({
        teachingSkills: teachByProfile.get(me.id) || [],
        learningSkills: learnByProfile.get(me.id) || [],
        activePartnerships: myMatches.length,
        upcomingSessions,
        completedSessions,
        allSessions: mySessions.map((s) => ({
          ...s,
          partner: partnerNameMap.get(s.hostId === me.id ? s.guestId : s.hostId) || null,
          isHost: s.hostId === me.id,
        })),
      });
    } catch (error) {
      console.error('Learning dashboard error:', error);
      res.status(500).json({ error: 'Failed to load learning dashboard' });
    }
  });

  app.post('/api/learning/sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const matchId = Number(req.body.matchId);
      const title = String(req.body.title || '').trim().slice(0, 120);
      const skillTopic = String(req.body.skillTopic || '').trim().slice(0, 80);
      const scheduledAt = new Date(req.body.scheduledAt);
      const durationMinutes = Math.min(180, Math.max(15, Number(req.body.durationMinutes) || 60));
      const notes = String(req.body.notes || '').trim().slice(0, 500);

      if (!matchId || !title || !skillTopic || isNaN(scheduledAt.getTime())) {
        return res.status(400).json({ error: 'Match, title, skill topic, and valid date/time are required.' });
      }

      const [matchRow] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
      if (!matchRow || (matchRow.user1Id !== me.id && matchRow.user2Id !== me.id)) {
        return res.status(403).json({ error: 'You can only schedule sessions with matched partners.' });
      }

      const guestId = matchRow.user1Id === me.id ? matchRow.user2Id : matchRow.user1Id;
      const [created] = await db
        .insert(learningSessions)
        .values({
          matchId,
          hostId: me.id,
          guestId,
          title,
          skillTopic,
          scheduledAt,
          durationMinutes,
          notes,
        })
        .returning();

      await db.insert(notifications).values({
        profileId: guestId,
        type: 'session',
        title: `Session invitation: ${title}`,
        body: `${me.fullName} scheduled a ${durationMinutes}m session on ${skillTopic}.`,
        link: '/learning',
      });
      sendToProfile(guestId, { type: 'notification:new' });

      res.json({ session: created });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(500).json({ error: 'Failed to schedule learning session' });
    }
  });

  app.patch('/api/learning/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const id = Number(req.params.id);
      const status = req.body.status;
      if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ error: 'Invalid session status' });
      }

      const [existing] = await db.select().from(learningSessions).where(eq(learningSessions.id, id)).limit(1);
      if (!existing || (existing.hostId !== me.id && existing.guestId !== me.id)) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const [updated] = await db
        .update(learningSessions)
        .set({ status })
        .where(eq(learningSessions.id, id))
        .returning();
      res.json({ session: updated });
    } catch (error) {
      console.error('Update session error:', error);
      res.status(500).json({ error: 'Failed to update session' });
    }
  });

  // Communities (Module 11)
  app.get('/api/communities', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const [allCommunities, allMembers, allPosts, allProfiles, { collegeMap, deptMap }] = await Promise.all([
        db.select().from(communities).orderBy(communities.id),
        db.select().from(communityMembers),
        db.select().from(communityPosts).orderBy(desc(communityPosts.createdAt)),
        db.select().from(profiles),
        loadCatalogMaps(),
      ]);

      const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

      const enriched = allCommunities.map((c) => {
        const members = allMembers.filter((m) => m.communityId === c.id);
        const posts = allPosts
          .filter((p) => p.communityId === c.id)
          .map((p) => {
            const author = profileMap.get(p.authorId);
            return {
              ...p,
              authorName: author?.fullName || 'Student',
              authorAvatar: author?.avatarUrl || '',
              authorYear: author?.academicYear || '',
            };
          });
        return {
          ...c,
          collegeName: c.collegeId ? collegeMap.get(c.collegeId)?.shortName || '' : 'Inter-College',
          departmentCode: c.departmentId ? deptMap.get(c.departmentId)?.code || '' : 'All Depts',
          memberCount: members.length,
          isMember: members.some((m) => m.profileId === me.id),
          posts,
        };
      });

      res.json({ communities: enriched });
    } catch (error) {
      console.error('Communities fetch error:', error);
      res.status(500).json({ error: 'Failed to load communities' });
    }
  });

  app.post('/api/communities/:id/join', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const communityId = Number(req.params.id);
      const existing = await db
        .select()
        .from(communityMembers)
        .where(and(eq(communityMembers.communityId, communityId), eq(communityMembers.profileId, me.id)))
        .limit(1);

      if (existing.length > 0) {
        await db.delete(communityMembers).where(eq(communityMembers.id, existing[0].id));
        return res.json({ joined: false });
      }
      await db.insert(communityMembers).values({ communityId, profileId: me.id, role: 'member' });
      res.json({ joined: true });
    } catch (error) {
      console.error('Community join error:', error);
      res.status(500).json({ error: 'Failed to update community membership' });
    }
  });

  app.post('/api/communities/:id/posts', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const communityId = Number(req.params.id);
      const title = String(req.body.title || '').trim().slice(0, 140);
      const content = String(req.body.content || '').trim().slice(0, 2000);
      const postType = ['discussion', 'resource', 'study_partner'].includes(req.body.postType)
        ? req.body.postType
        : 'discussion';
      const resourceUrl = sanitizeExternalUrl(req.body.resourceUrl);

      if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required.' });
      }

      // Auto-join on post if not yet a member
      await db
        .insert(communityMembers)
        .values({ communityId, profileId: me.id, role: 'member' })
        .onConflictDoNothing();

      const [post] = await db
        .insert(communityPosts)
        .values({
          communityId,
          authorId: me.id,
          title,
          content,
          postType,
          resourceUrl,
        })
        .returning();

      res.json({ post });
    } catch (error) {
      console.error('Community post error:', error);
      res.status(500).json({ error: 'Failed to publish post' });
    }
  });

  // Project Collaboration (Module 12)
  app.get('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const [allProjects, allMembers, allProfiles, { collegeMap }] = await Promise.all([
        db.select().from(projects).orderBy(desc(projects.createdAt)),
        db.select().from(projectMembers),
        db.select().from(profiles),
        loadCatalogMaps(),
      ]);

      const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

      const enriched = allProjects.map((proj) => {
        const owner = profileMap.get(proj.ownerId);
        const members = allMembers
          .filter((m) => m.projectId === proj.id)
          .map((m) => {
            const p = profileMap.get(m.profileId);
            return {
              id: m.id,
              profileId: m.profileId,
              fullName: p?.fullName || 'Student',
              avatarUrl: p?.avatarUrl || '',
              role: m.role,
              status: m.status,
              motivation: m.motivation,
            };
          });
        const myMembership = members.find((m) => m.profileId === me.id);
        return {
          ...proj,
          collegeShortName: proj.collegeId ? collegeMap.get(proj.collegeId)?.shortName || 'BUIE' : 'Inter-College',
          ownerName: owner?.fullName || 'Student',
          ownerAvatar: owner?.avatarUrl || '',
          isOwner: proj.ownerId === me.id,
          myStatus: myMembership?.status || null,
          acceptedCount: members.filter((m) => m.status === 'accepted').length,
          members,
        };
      });

      res.json({ projects: enriched });
    } catch (error) {
      console.error('Projects fetch error:', error);
      res.status(500).json({ error: 'Failed to load projects' });
    }
  });

  app.post('/api/projects', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const title = String(req.body.title || '').trim().slice(0, 120);
      const description = String(req.body.description || '').trim().slice(0, 1500);
      const requiredSkills = Array.isArray(req.body.requiredSkills)
        ? req.body.requiredSkills.map(String).slice(0, 8)
        : [];
      const maxMembers = Math.min(12, Math.max(2, Number(req.body.maxMembers) || 4));

      if (!title || !description) {
        return res.status(400).json({ error: 'Project title and description are required.' });
      }

      const [proj] = await db
        .insert(projects)
        .values({
          ownerId: me.id,
          collegeId: me.collegeId,
          title,
          description,
          requiredSkills,
          status: 'recruiting',
          maxMembers,
        })
        .returning();

      await db.insert(projectMembers).values({
        projectId: proj.id,
        profileId: me.id,
        role: 'Project Lead',
        status: 'accepted',
        motivation: 'Project creator',
      });

      res.json({ project: proj });
    } catch (error) {
      console.error('Create project error:', error);
      res.status(500).json({ error: 'Failed to publish project' });
    }
  });

  app.post('/api/projects/:id/apply', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const projectId = Number(req.params.id);
      const role = String(req.body.role || 'Contributor').trim().slice(0, 60);
      const motivation = String(req.body.motivation || '').trim().slice(0, 500);

      const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!proj) return res.status(404).json({ error: 'Project not found' });

      await db
        .insert(projectMembers)
        .values({ projectId, profileId: me.id, role, motivation, status: 'pending' })
        .onConflictDoNothing();

      await db.insert(notifications).values({
        profileId: proj.ownerId,
        type: 'project',
        title: `New application for ${proj.title}`,
        body: `${me.fullName} applied as ${role}.`,
        link: '/projects',
      });
      sendToProfile(proj.ownerId, { type: 'notification:new' });

      res.json({ ok: true });
    } catch (error) {
      console.error('Project apply error:', error);
      res.status(500).json({ error: 'Failed to submit application' });
    }
  });

  app.patch('/api/projects/:id/members/:memberId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const projectId = Number(req.params.id);
      const memberId = Number(req.params.memberId);
      const status = req.body.status === 'accepted' ? 'accepted' : req.body.status === 'rejected' ? 'rejected' : null;
      if (!status) return res.status(400).json({ error: 'Invalid decision' });

      const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!proj || proj.ownerId !== me.id) {
        return res.status(403).json({ error: 'Only the project owner can manage team applications.' });
      }

      const [updated] = await db
        .update(projectMembers)
        .set({ status })
        .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
        .returning();

      if (updated) {
        await db.insert(notifications).values({
          profileId: updated.profileId,
          type: 'project',
          title: `Project application ${status}`,
          body: `Your request to join "${proj.title}" was ${status}.`,
          link: '/projects',
        });
        sendToProfile(updated.profileId, { type: 'notification:new' });
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Manage project member error:', error);
      res.status(500).json({ error: 'Failed to update team member status' });
    }
  });

  // Notifications (Module 13)
  app.get('/api/notifications', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.profileId, me.id))
        .orderBy(desc(notifications.createdAt))
        .limit(30);
      res.json({ notifications: rows });
    } catch (error) {
      console.error('Notifications error:', error);
      res.status(500).json({ error: 'Failed to load notifications' });
    }
  });

  app.patch('/api/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      await db
        .update(notifications)
        .set({ isRead: true })
        .where(eq(notifications.profileId, me.id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Mark notifications read error:', error);
      res.status(500).json({ error: 'Failed to mark notifications read' });
    }
  });

  // Safety & Moderation (Module 14)
  app.get('/api/safety/blocks', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const myBlocks = await db.select().from(blocks).where(eq(blocks.blockerId, me.id));
      if (myBlocks.length === 0) return res.json({ blocked: [] });
      const ids = myBlocks.map((b) => b.blockedId);
      const blockedProfiles = await db.select().from(profiles).where(inArray(profiles.id, ids));
      res.json({
        blocked: blockedProfiles.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          username: p.username,
          avatarUrl: p.avatarUrl,
        })),
      });
    } catch (error) {
      console.error('Get blocks error:', error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  });

  app.post('/api/safety/block', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const targetProfileId = Number(req.body.targetProfileId);
      if (!targetProfileId || targetProfileId === me.id) {
        return res.status(400).json({ error: 'Invalid target user' });
      }
      await db
        .insert(blocks)
        .values({ blockerId: me.id, blockedId: targetProfileId })
        .onConflictDoNothing();

      // Remove any active match between blocked users
      const [u1, u2] = me.id < targetProfileId ? [me.id, targetProfileId] : [targetProfileId, me.id];
      await db.delete(matches).where(and(eq(matches.user1Id, u1), eq(matches.user2Id, u2)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Block user error:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  app.delete('/api/safety/block/:profileId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const targetId = Number(req.params.profileId);
      await db
        .delete(blocks)
        .where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, targetId)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Unblock error:', error);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  app.post('/api/safety/report', requireAuth, rateLimit('report', 10, 60_000), async (req: AuthRequest, res) => {
    try {
      const me = req.profile!;
      const targetProfileId = req.body.targetProfileId ? Number(req.body.targetProfileId) : null;
      const targetType = ['user', 'post', 'project', 'message'].includes(req.body.targetType)
        ? req.body.targetType
        : 'user';
      const targetId = req.body.targetId ? Number(req.body.targetId) : null;
      const reason = String(req.body.reason || '').trim().slice(0, 140);
      const details = String(req.body.details || '').trim().slice(0, 1000);

      if (!reason) return res.status(400).json({ error: 'Report reason is required.' });

      const [report] = await db
        .insert(reports)
        .values({
          reporterId: me.id,
          targetProfileId,
          targetType,
          targetId,
          reason,
          details,
        })
        .returning();
      res.json({ report });
    } catch (error) {
      console.error('Report error:', error);
      res.status(500).json({ error: 'Failed to submit report' });
    }
  });

  // Administration Dashboard (Module 15 - verified admin only)
  app.get('/api/admin/overview', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
    try {
      const [allProfiles, allColleges, allReports, allMatches, allMessages, allProjects] = await Promise.all([
        db.select().from(profiles).orderBy(desc(profiles.createdAt)),
        db.select().from(colleges).orderBy(colleges.id),
        db.select().from(reports).orderBy(desc(reports.createdAt)),
        db.select({ count: sql<number>`count(*)` }).from(matches),
        db.select({ count: sql<number>`count(*)` }).from(messages),
        db.select({ count: sql<number>`count(*)` }).from(projects),
      ]);

      const profileMap = new Map(allProfiles.map((p) => [p.id, p]));

      res.json({
        stats: {
          totalStudents: allProfiles.length,
          totalColleges: allColleges.length,
          totalMatches: Number(allMatches[0]?.count || 0),
          totalMessages: Number(allMessages[0]?.count || 0),
          totalProjects: Number(allProjects[0]?.count || 0),
          openReports: allReports.filter((r) => r.status === 'open').length,
        },
        colleges: allColleges,
        students: allProfiles.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          username: p.username,
          role: p.role,
          academicYear: p.academicYear,
          isSuspended: p.isSuspended,
          createdAt: p.createdAt,
        })),
        reports: allReports.map((r) => ({
          ...r,
          reporterName: profileMap.get(r.reporterId)?.fullName || 'Student',
          targetName: r.targetProfileId ? profileMap.get(r.targetProfileId)?.fullName || 'Unknown' : r.targetType,
        })),
      });
    } catch (error) {
      console.error('Admin overview error:', error);
      res.status(500).json({ error: 'Failed to load admin overview' });
    }
  });

  app.patch('/api/admin/reports/:id', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const status = ['open', 'reviewed', 'resolved', 'dismissed'].includes(req.body.status)
        ? req.body.status
        : null;
      if (!status) return res.status(400).json({ error: 'Invalid status' });

      const [updated] = await db
        .update(reports)
        .set({ status, reviewedBy: req.profile!.id })
        .where(eq(reports.id, id))
        .returning();
      res.json({ report: updated });
    } catch (error) {
      console.error('Admin report update error:', error);
      res.status(500).json({ error: 'Failed to update report' });
    }
  });

  app.patch('/api/admin/users/:id/suspend', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (id === req.profile!.id) {
        return res.status(400).json({ error: 'Administrators cannot suspend their own account.' });
      }
      const isSuspended = Boolean(req.body.isSuspended);
      const [updated] = await db
        .update(profiles)
        .set({ isSuspended })
        .where(eq(profiles.id, id))
        .returning();
      res.json({ user: { id: updated.id, isSuspended: updated.isSuspended } });
    } catch (error) {
      console.error('Admin suspend error:', error);
      res.status(500).json({ error: 'Failed to update suspension status' });
    }
  });

  app.post('/api/admin/colleges', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const name = String(req.body.name || '').trim().slice(0, 140);
      const shortName = String(req.body.shortName || '').trim().slice(0, 24);
      const city = String(req.body.city || '').trim().slice(0, 60);
      const state = String(req.body.state || '').trim().slice(0, 60);
      const domain = String(req.body.domain || '').trim().slice(0, 80);

      if (!name || !shortName || !city || !state) {
        return res.status(400).json({ error: 'Name, short name, city, and state are required.' });
      }

      const [college] = await db
        .insert(colleges)
        .values({ name, shortName, city, state, domain, isVerified: true })
        .returning();

      // Add default CSE & ECE departments for the newly added college
      await db.insert(departments).values([
        { collegeId: college.id, name: 'Computer Science & Engineering', code: 'CSE' },
        { collegeId: college.id, name: 'Electronics & Communication Engineering', code: 'ECE' },
        { collegeId: college.id, name: 'Information Technology', code: 'IT' },
      ]);

      res.json({ college });
    } catch (error) {
      console.error('Admin add college error:', error);
      res.status(500).json({ error: 'Failed to add college' });
    }
  });

  // Vite Dev Middleware or Production Static Serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distPath, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found');
      }
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`SkillBridge server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start SkillBridge server:', err);
  process.exit(1);
});
