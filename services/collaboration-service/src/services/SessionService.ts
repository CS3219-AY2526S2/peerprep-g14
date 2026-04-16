import { prisma } from '../index.js';

function questionServiceBaseUrl(): string {
    return (process.env.QUESTION_SERVICE_URL || 'http://question-service:3002').replace(/\/$/, '');
}

export interface SessionCreateParams {
    matchId: string;
    user1Id: string;
    user2Id: string;
    topic: string;
    difficulty: string;
    language: string;
}

export class SessionService {
    static async createSession(params: SessionCreateParams) {
        const { matchId, user1Id, user2Id, topic, difficulty, language } = params;

        // 1. check if session already exists (Idempotency)
        const existing = await prisma.session.findUnique({
            where: { id: matchId }
        });
        if (existing) {
            console.log(`[SessionService] Session ${matchId} already exists. Skipping creation.`);
            return existing;
        }

        // 2. select a question
        let questionId: string | null = null;
        console.log(`[SessionService] Selecting question for session ${matchId}: topic=${topic}, difficulty=${difficulty}`);

        try {
            const formattedTopic = topic.replace("-", "_");
            const qUrl = `${questionServiceBaseUrl()}/?difficulty=${difficulty}&topic=${formattedTopic}`;
            const qRes = await fetch(qUrl);
            if (qRes.ok) {
                const qList = await qRes.json();
                if (Array.isArray(qList) && qList.length > 0) {
                    const randomIndex = Math.floor(Math.random() * qList.length);
                    questionId = qList[randomIndex].id || qList[randomIndex]._id;
                }
            }

            // fallback 1: difficulty only
            if (!questionId) {
                const fbRes = await fetch(`${questionServiceBaseUrl()}/?difficulty=${difficulty}`);
                if (fbRes.ok) {
                    const fbList = await fbRes.json();
                    if (Array.isArray(fbList) && fbList.length > 0) {
                        const randomIndex = Math.floor(Math.random() * fbList.length);
                        questionId = fbList[randomIndex].id || fbList[randomIndex]._id;
                    }
                }
            }

            // fallback 2: any question
            if (!questionId) {
                const anyRes = await fetch(`${questionServiceBaseUrl()}/`);
                if (anyRes.ok) {
                    const anyList = await anyRes.json();
                    if (Array.isArray(anyList) && anyList.length > 0) {
                        const randomIndex = Math.floor(Math.random() * anyList.length);
                        questionId = anyList[randomIndex].id || anyList[randomIndex]._id;
                    }
                }
            }
        } catch (err) {
            console.error(`[SessionService] Failed to fetch question from question-service:`, err);
        }

        const finalQuestionId = questionId || 'fallback-question';

        // 3. create session
        try {
            const session = await prisma.session.create({
                data: {
                    id: matchId,
                    user1Id,
                    user2Id,
                    questionId: finalQuestionId,
                    language,
                }
            });
            console.log(`[SessionService] Created session ${matchId} with question ${finalQuestionId}`);
            return session;
        } catch (err: any) {
            // handle race condition if two events arrive simultaneously in the database
            if (err.code === 'P2002') {
                return prisma.session.findUnique({ where: { id: matchId } });
            }
            throw err;
        }
    }
}
