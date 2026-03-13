import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Target, Play, User as UserIcon, LogOut } from 'lucide-react';
import { Card } from '../components/Card';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [difficulty, setDifficulty] = useState('');
    const [topic, setTopic] = useState('');
    const [language, setLanguage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleStartMatching = async () => {
        if (!difficulty || !topic || !language || isSubmitting) {
            return;
        }

        setIsSubmitting(true);
        setErrorMessage(null);

        try {
            const response = await fetch('/api/matching/requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    difficulty,
                    topic,
                    language,
                }),
            });

            const text = await response.text();
            let data: any = null;

            try {
                data = JSON.parse(text);
            } catch {
                console.error('Non-JSON response from matching service:', text);
            }

            if (!response.ok) {
                console.error('Match request failed:', response.status, data || text);
                const firstError = data?.errors?.[0]?.message as string | undefined;
                setErrorMessage(firstError || data?.message || 'Failed to submit match request.');
                return;
            }

            const requestId = data?.matchRequest?.id as string | undefined;

            navigate('/matching', { state: { difficulty, topic, language, requestId } });
        } catch (err) {
            console.error('Failed to reach matching service:', err);
            setErrorMessage('Unable to reach matching service. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const difficultyOptions = [
        { value: '', label: 'Select Difficulty' },
        { value: 'easy', label: 'Easy' },
        { value: 'medium', label: 'Medium' },
        { value: 'hard', label: 'Hard' },
    ];

    const topicOptions = [
        { value: '', label: 'Select a Topic' },
        { value: 'arrays', label: 'Arrays & Hashing' },
        { value: 'two-pointers', label: 'Two Pointers' },
        { value: 'sliding-window', label: 'Sliding Window' },
        { value: 'stack', label: 'Stack' },
        { value: 'binary-search', label: 'Binary Search' },
        { value: 'linked-list', label: 'Linked List' },
        { value: 'trees', label: 'Trees' },
        { value: 'graphs', label: 'Graphs' },
        { value: 'dp', label: 'Dynamic Programming' },
    ];

    const languageOptions = [
        { value: '', label: 'Select Language' },
        { value: 'java', label: 'Java' },
        { value: 'python', label: 'Python' },
        { value: 'cpp', label: 'C++' },
    ];

    return (
        <div className="dashboard-layout animate-fade-in">
            <nav className="navbar">
                <div className="navbar-brand">
                    <div className="brand-icon-sm">
                        <UserIcon className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-gradient">PeerPrep</span>
                </div>
                <div className="navbar-user">
                    <span className="user-name">Welcome, John Doe</span>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sign Out
                    </Button>
                </div>
            </nav>

            <main className="dashboard-content">
                <div className="dashboard-header flex-col flex-center">
                    <h1 className="dashboard-title">Ready to Practice?</h1>
                    <p className="dashboard-subtitle">
                        Select your preferred difficulty and topic to find a peer for your next mock interview.
                    </p>
                </div>

                <div className="dashboard-cards">
                    <Card glow className="selection-card">
                        <h2 className="card-title flex-center">
                            <Target className="h-6 w-6 mr-2 text-accent-primary" />
                            Configure Session
                        </h2>

                        <div className="form-group mt-8">
                            <Select
                                label="Difficulty Level"
                                options={difficultyOptions}
                                value={difficulty}
                                onChange={(e) => setDifficulty(e.target.value)}
                            />
                        </div>

                        <div className="form-group mt-6">
                            <Select
                                label="Interview Topic"
                                options={topicOptions}
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                leftIcon={<BookOpen className="h-5 w-5" />}
                            />
                        </div>

                        <div className="form-group mt-6">
                            <Select
                                label="Programming Language"
                                options={languageOptions}
                                value={language}
                                onChange={(e) => setLanguage(e.target.value)}
                            />
                        </div>

                        <Button
                            size="lg"
                            className="w-full mt-8"
                            disabled={!difficulty || !topic || !language || isSubmitting}
                            onClick={handleStartMatching}
                            rightIcon={<Play className="h-5 w-5" />}
                        >
                            {isSubmitting ? 'Submitting...' : 'Find a Match'}
                        </Button>

                        {errorMessage && (
                            <p className="form-error mt-4">
                                {errorMessage}
                            </p>
                        )}
                    </Card>

                    <div className="dashboard-stats flex-col">
                        <Card className="stat-card">
                            <h3>Recent Topics</h3>
                            <div className="tags">
                                <span className="tag">Arrays</span>
                                <span className="tag">Trees</span>
                            </div>
                        </Card>
                        <Card className="stat-card mt-4">
                            <h3>Sessions Completed</h3>
                            <div className="stat-number">12</div>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
};
