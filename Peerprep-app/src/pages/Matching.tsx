import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, X } from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import './Matching.css';

interface LocationState {
    difficulty?: string;
    topic?: string;
    language?: string;
    requestId?: string;
    timeAvailableMinutes?: number;
    allowLowerDifficultyMatch?: boolean;
}

type MatchRequestStatus = 'PENDING' | 'MATCHED' | 'CANCELLED';

interface MatchRequest {
    id: string;
    userId: string | null;
    status: MatchRequestStatus;
    topic: string;
    difficulty: string;
    language: string;
    timeAvailableMinutes?: number;
    createdAt: string;
}

interface MatchInfo {
    partnerRequestId: string;
    partnerUserId: string | null;
    topic: string;
    language: string;
    requesterDifficulty: string;
    partnerDifficulty: string;
    matchingType: string;
}

interface MatchRequestResponse {
    matchRequest?: MatchRequest;
    match?: MatchInfo | null;
    message?: string;
    error?: string;
}

const getFakeUserIdFromSession = (): string | null => {
    try {
        const stored = window.sessionStorage.getItem('peerprep_fake_user_id');
        if (stored && stored.trim() !== '') {
            return stored.trim();
        }
    } catch (err) {
        console.error('Failed to read fake user id from sessionStorage', err);
    }
    return null;
};

export const Matching: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState;

    const [secondsElapsed, setSecondsElapsed] = useState(0);
    const [requestInfo, setRequestInfo] = useState<MatchRequest | null>(null);
    const [isLoadingRequest, setIsLoadingRequest] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [requestError, setRequestError] = useState<string | null>(null);

    const attemptMatch = async () => {
        try {
            const response = await fetch('http://localhost:3002/matching/attempt', {
                method: 'POST',
            });

            if (!response.ok) {
                console.error('Match attempt failed with status:', response.status);
            }
        } catch (err) {
            console.error('Failed to reach matching service for match attempt:', err);
            // Do not override existing requestError here to keep this non-blocking.
        }
    };

    const loadRequestStatus = async () => {
        if (!state?.requestId) {
            return;
        }

        setIsLoadingRequest(true);
        setRequestError(null);

        try {
            const response = await fetch(
                `http://localhost:3002/matching/requests/${state.requestId}`,
            );
            const text = await response.text();
            let data: MatchRequestResponse | null = null;

            try {
                data = JSON.parse(text) as MatchRequestResponse;
            } catch {
                console.error('Non-JSON response from matching service (status):', text);
            }

            if (!response.ok) {
                console.error('Failed to load match request status:', response.status, data || text);
                setRequestError(
                    (data && (data.message || data.error)) ||
                        'Failed to load match request status.',
                );
                return;
            }

            if (data?.matchRequest) {
                setRequestInfo(data.matchRequest);

                if (data.matchRequest.status === 'MATCHED') {
                    navigate('/workspace', {
                        state: {
                            difficulty:
                                data.match?.requesterDifficulty ?? data.matchRequest.difficulty,
                            topic: data.match?.topic ?? data.matchRequest.topic,
                            language: data.match?.language ?? data.matchRequest.language,
                            matchRequestId: data.matchRequest.id,
                            match: data.match ?? null,
                        },
                    });
                    return;
                }

                if (data.matchRequest.status === 'CANCELLED') {
                    navigate('/dashboard');
                    return;
                }
            }
        } catch (err) {
            console.error('Failed to reach matching service for status:', err);
            setRequestError('Unable to reach matching service for status. Please try again.');
        } finally {
            setIsLoadingRequest(false);
        }
    };

    useEffect(() => {
        // If accessed directly without required state, redirect to dashboard
        if (!state?.difficulty || !state?.topic || !state?.language || !state?.requestId) {
            navigate('/dashboard');
            return;
        }

        // Timer for display
        const timer = setInterval(() => {
            setSecondsElapsed((prev: number) => prev + 1);
        }, 1000);

        const poller = setInterval(() => {
            void (async () => {
                await attemptMatch();
                await loadRequestStatus();
            })();
        }, 2000);

        void (async () => {
            await attemptMatch();
            await loadRequestStatus();
        })();

        return () => {
            clearInterval(timer);
            clearInterval(poller);
        };
    }, [navigate, state]);

    const handleCancel = async () => {
        if (!state?.requestId) {
            navigate('/dashboard');
            return;
        }

        const fakeUserId = getFakeUserIdFromSession();
        if (!fakeUserId) {
            setRequestError(
                'Unable to determine test user id for cancellation. Please return to the dashboard and try again.',
            );
            return;
        }

        setIsCancelling(true);
        setRequestError(null);

        try {
            const response = await fetch(
                `http://localhost:3002/matching/requests/${state.requestId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'x-user-id': fakeUserId,
                    },
                },
            );

            const text = await response.text();
            let data: MatchRequestResponse | null = null;

            try {
                data = JSON.parse(text) as MatchRequestResponse;
            } catch {
                console.error('Non-JSON response from matching service (cancel):', text);
            }

            if (!response.ok) {
                console.error('Cancel match request failed:', response.status, data || text);
                setRequestError(
                    (data && (data.message || data.error)) ||
                        'Failed to cancel match request.',
                );
                return;
            }

            if (data?.matchRequest) {
                setRequestInfo(data.matchRequest);
            }

            navigate('/dashboard');
        } catch (err) {
            console.error('Failed to reach matching service for cancellation:', err);
            setRequestError('Unable to reach matching service for cancellation. Please try again.');
        } finally {
            setIsCancelling(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="matching-layout animate-fade-in">
            <div className="matching-container">
                <Card glow className="text-center p-8">
                    <div className="matching-visuals">
                        <div className="pulse-circle">
                            <Users className="h-10 w-10 text-accent-primary" />
                        </div>
                        <div className="pulse-ring ring-1"></div>
                        <div className="pulse-ring ring-2"></div>
                    </div>

                    <h1 className="matching-title mt-8">Finding a Peer...</h1>

                    <div className="matching-details mt-4">
                        <div className="detail-item">
                            <span className="detail-label">Difficulty:</span>
                            <span className="detail-value tag">{state?.difficulty || 'Any'}</span>
                        </div>
                        <div className="detail-item mt-2">
                            <span className="detail-label">Topic:</span>
                            <span className="detail-value tag">{state?.topic || 'Any'}</span>
                        </div>
                        <div className="detail-item mt-2">
                            <span className="detail-label">Language:</span>
                            <span className="detail-value tag">{state?.language || 'Any'}</span>
                        </div>
                        {state?.timeAvailableMinutes && (
                            <div className="detail-item mt-2">
                                <span className="detail-label">Time Available:</span>
                                <span className="detail-value tag">{state.timeAvailableMinutes} minutes</span>
                            </div>
                        )}
                    </div>

                    <div className="matching-timer mt-8">
                        <span className="timer-text font-mono">{formatTime(secondsElapsed)}</span>
                        <p className="timer-subtext">Estimated wait time: 00:30</p>
                    </div>

                    {requestInfo && (
                        <div className="mt-6 text-left text-sm">
                            <p className="mb-1">
                                <span className="font-semibold">Request ID:</span>{' '}
                                <span className="font-mono break-all">{requestInfo.id}</span>
                            </p>
                            <p className="mb-1">
                                <span className="font-semibold">User:</span>{' '}
                                <span className="font-mono break-all">
                                    {requestInfo.userId ?? '(none)'}
                                </span>
                            </p>
                            <p className="mb-1">
                                <span className="font-semibold">Status:</span>{' '}
                                <span className="tag">{requestInfo.status}</span>
                            </p>
                        </div>
                    )}

                    {isLoadingRequest && (
                        <p className="mt-4 text-xs opacity-60">Loading request status…</p>
                    )}

                    {requestError && (
                        <p className="mt-4 text-xs text-red-500">{requestError}</p>
                    )}

                    <Button
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={isCancelling}
                        className="mt-8"
                        leftIcon={<X className="h-4 w-4" />}
                    >
                        {isCancelling ? 'Cancelling...' : 'Cancel Search'}
                    </Button>
                </Card>
            </div>
        </div>
    );
};
