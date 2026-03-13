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
}

export const Matching: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState;

    const [secondsElapsed, setSecondsElapsed] = useState(0);

    useEffect(() => {
        // If accessed directly without required state, redirect to dashboard
        if (!state?.difficulty || !state?.topic || !state?.language) {
            navigate('/dashboard');
            return;
        }

        // Timer for display
        const timer = setInterval(() => {
            setSecondsElapsed((prev) => prev + 1);
        }, 1000);

        // Simulate finding a match after 5 seconds
        const matchTimer = setTimeout(() => {
            navigate('/workspace', { state });
        }, 5000);

        return () => {
            clearInterval(timer);
            clearTimeout(matchTimer);
        };
    }, [navigate, state]);

    const handleCancel = () => {
        navigate('/dashboard');
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

                    <Button
                        variant="ghost"
                        onClick={handleCancel}
                        className="mt-8"
                        leftIcon={<X className="h-4 w-4" />}
                    >
                        Cancel Search
                    </Button>
                </Card>
            </div>
        </div>
    );
};
