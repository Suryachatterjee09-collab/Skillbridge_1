export interface College {
  id: number;
  name: string;
  shortName: string;
  city: string;
  state: string;
  domain?: string | null;
  isVerified: boolean;
}

export interface Department {
  id: number;
  collegeId: number;
  name: string;
  code: string;
}

export interface SkillCatalogItem {
  id: number;
  name: string;
  category: string;
  description: string;
}

export interface UserSkill {
  id: number;
  skillId: number;
  name: string;
  category: string;
  level: string;
  description?: string;
  notes?: string;
}

export interface Availability {
  days: string[];
  timeSlot: string;
  hoursPerWeek: number;
}

export interface PublicProfile {
  id: number;
  fullName: string;
  username: string;
  avatarUrl: string;
  collegeId: number | null;
  collegeName: string;
  collegeShortName: string;
  departmentId: number | null;
  departmentName: string;
  departmentCode: string;
  academicYear: string;
  bio: string;
  experienceLevel: string;
  preferredLanguages: string[];
  availability: Availability;
  githubUrl: string;
  linkedinUrl: string;
  portfolioUrl: string;
  isPublic: boolean;
  lastActiveAt: string;
  teachingSkills: UserSkill[];
  learningSkills: UserSkill[];
  isOnline?: boolean;
}

export interface MyProfile extends PublicProfile {
  email: string;
  role: 'student' | 'admin';
  onboardingCompleted: boolean;
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

export interface DiscoveryCandidate extends PublicProfile {
  compatibilityScore: number;
  compatibilityBreakdown: CompatibilityBreakdown;
}

export interface MatchItem {
  id: number;
  conversationId: number | null;
  compatibilityScore: number;
  compatibilityBreakdown: CompatibilityBreakdown;
  matchedAt: string;
  partner: PublicProfile;
}

export interface PendingConnectionItem {
  profile: PublicProfile;
  compatibilityScore: number;
  requestedAt: string;
}

export interface ChatMessage {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface ConversationSummary {
  id: number;
  matchId: number;
  updatedAt: string;
  unreadCount: number;
  lastMessage: {
    id: number;
    content: string;
    senderId: number;
    createdAt: string;
  } | null;
  partner: PublicProfile;
}

export interface LearningSessionItem {
  id: number;
  matchId: number;
  hostId: number;
  guestId: number;
  title: string;
  skillTopic: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string;
  isHost: boolean;
  partner: { id: number; fullName: string; avatarUrl: string } | null;
}

export interface NotificationItem {
  id: number;
  profileId: number;
  type: string;
  title: string;
  body: string;
  link: string;
  isRead: boolean;
  createdAt: string;
}

export interface CommunityPostItem {
  id: number;
  communityId: number;
  authorId: number;
  title: string;
  content: string;
  resourceUrl: string;
  postType: 'discussion' | 'resource' | 'study_partner';
  createdAt: string;
  authorName: string;
  authorAvatar: string;
  authorYear: string;
}

export interface CommunityItem {
  id: number;
  collegeId: number | null;
  departmentId: number | null;
  name: string;
  slug: string;
  description: string;
  collegeName: string;
  departmentCode: string;
  memberCount: number;
  isMember: boolean;
  posts: CommunityPostItem[];
}

export interface ProjectMemberItem {
  id: number;
  profileId: number;
  fullName: string;
  avatarUrl: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected';
  motivation: string;
}

export interface ProjectItem {
  id: number;
  ownerId: number;
  collegeId: number | null;
  title: string;
  description: string;
  requiredSkills: string[];
  status: 'recruiting' | 'active' | 'completed';
  maxMembers: number;
  createdAt: string;
  collegeShortName: string;
  ownerName: string;
  ownerAvatar: string;
  isOwner: boolean;
  myStatus: 'pending' | 'accepted' | 'rejected' | null;
  acceptedCount: number;
  members: ProjectMemberItem[];
}

export interface MatchInsight {
  summary: string;
  whyCompatible: string[];
  learningPath: { step: string; focus: string; outcome: string }[];
  starterTopic: string;
}

export interface IncomingCallState {
  fromProfileId: number;
  fromName: string;
  fromAvatar: string;
  matchId: number;
  mode: 'audio' | 'video';
  offer: RTCSessionDescriptionInit;
}

export interface ActiveCallState {
  partnerId: number;
  partnerName: string;
  partnerAvatar: string;
  matchId: number;
  mode: 'audio' | 'video';
  direction: 'outgoing' | 'incoming';
  incomingOffer?: RTCSessionDescriptionInit;
}
