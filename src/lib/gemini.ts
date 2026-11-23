import { GoogleGenAI, Type } from '@google/genai';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface MatchInsightInput {
  me: {
    firstName: string;
    academicYear: string;
    department: string;
    teaching: string[];
    learning: string[];
  };
  candidate: {
    firstName: string;
    academicYear: string;
    department: string;
    college: string;
    teaching: string[];
    learning: string[];
  };
  compatibilityScore: number;
  matchedPairs: { teacher: string; learner: string; skill: string }[];
}

export interface MatchInsightOutput {
  summary: string;
  whyCompatible: string[];
  learningPath: { step: string; focus: string; outcome: string }[];
  starterTopic: string;
}

export async function generateMatchInsight(input: MatchInsightInput): Promise<MatchInsightOutput> {
  const ai = getGeminiClient();

  const prompt = `
Analyze the peer-to-peer skill exchange potential between two engineering college students.
Do not invent personal contact information. Focus strictly on academic and technical collaboration.

Student A:
- Name: ${input.me.firstName}
- Year & Department: ${input.me.academicYear}, ${input.me.department}
- Can teach: ${input.me.teaching.join(', ') || 'General programming'}
- Wants to learn: ${input.me.learning.join(', ') || 'Full-stack development'}

Student B:
- Name: ${input.candidate.firstName}
- College: ${input.candidate.college}
- Year & Department: ${input.candidate.academicYear}, ${input.candidate.department}
- Can teach: ${input.candidate.teaching.join(', ') || 'Software engineering'}
- Wants to learn: ${input.candidate.learning.join(', ') || 'Cloud architecture'}

Deterministic Compatibility Score: ${input.compatibilityScore}%
Reciprocal Skill Pairs: ${JSON.stringify(input.matchedPairs)}

Return a concise, practical peer-learning plan with why they complement each other, a 3-step joint learning roadmap, and an engaging first session topic.
`.trim();

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are an academic peer-learning advisor for university engineering students. Be concrete, encouraging, and concise.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: 'Two-sentence overview of why this pairing works.' },
          whyCompatible: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 3 concise reasons based on skills and goals.',
          },
          learningPath: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                step: { type: Type.STRING },
                focus: { type: Type.STRING },
                outcome: { type: Type.STRING },
              },
            },
            description: '3 concrete peer-exchange sessions.',
          },
          starterTopic: {
            type: Type.STRING,
            description: 'A concrete 45-minute first session idea.',
          },
        },
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as Partial<MatchInsightOutput>;
  return {
    summary:
      parsed.summary ||
      `${input.me.firstName} and ${input.candidate.firstName} have complementary strengths across ${input.candidate.teaching[0] || 'engineering'} and ${input.me.teaching[0] || 'peer mentoring'}.`,
    whyCompatible: Array.isArray(parsed.whyCompatible) ? parsed.whyCompatible.slice(0, 3) : [],
    learningPath: Array.isArray(parsed.learningPath) ? parsed.learningPath.slice(0, 3) : [],
    starterTopic:
      parsed.starterTopic ||
      `60-minute hands-on swap: ${input.me.teaching[0] || 'Architecture'} for ${input.candidate.teaching[0] || 'Implementation'}`,
  };
}
