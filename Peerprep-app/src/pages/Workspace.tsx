import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Code2, Layout, Settings, LogOut, MessageSquare, Play } from 'lucide-react';
import { Button } from '../components/Button';
import './Workspace.css';

interface LocationState {
    difficulty?: string;
    topic?: string;
    language?: string;
    matchRequestId?: string;
    match?: {
        partnerRequestId: string;
        partnerUserId: string | null;
        topic: string;
        language: string;
        requesterDifficulty: string;
        partnerDifficulty: string;
        matchingType: string;
    } | null;
}

export const Workspace: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState;

    const [code, setCode] = useState('// Write your solution here...\n\nfunction solution() {\n  \n}');

    const handleEndSession = () => {
        if (window.confirm('Are you sure you want to end this session?')) {
            navigate('/dashboard');
        }
    };

    return (
        <div className="workspace-layout">
            {/* Workspace Header */}
            <header className="workspace-header">
                <div className="header-left">
                    <div className="workspace-brand">
                        <Layout className="h-5 w-5 text-accent-primary" />
                        <span className="font-semibold">PeerPrep Workspace</span>
                    </div>
                    <div className="session-info">
                        <span className="tag-sm">{state?.difficulty || 'Medium'}</span>
                        <span className="tag-sm">{state?.topic || 'Arrays'}</span>
                    </div>
                </div>

                <div className="header-right">
                    <div className="peer-status">
                        <div className="status-indicator online"></div>
                        <span className="text-sm text-secondary">Peer Connected</span>
                    </div>
                    <Button variant="danger" size="sm" onClick={handleEndSession}>
                        <LogOut className="h-4 w-4 mr-2" />
                        End Session
                    </Button>
                </div>
            </header>

            {/* Main Workspace Area */}
            <main className="workspace-main">
                {/* Left Panel: Question */}
                <section className="panel question-panel">
                    <div className="panel-header">
                        <h2 className="panel-title">1. Two Sum</h2>
                        <div className="flex gap-2">
                            <span className="tag-sm custom-tag text-success bg-success-light">Easy</span>
                        </div>
                    </div>
                    <div className="panel-content prose custom-prose">
                        <p>
                            Given an array of integers <code>nums</code> and an integer <code>target</code>, return <em>indices of the two numbers such that they add up to <code>target</code></em>.
                        </p>
                        <p>
                            You may assume that each input would have <strong><em>exactly</em> one solution</strong>, and you may not use the <em>same</em> element twice.
                        </p>
                        <p>You can return the answer in any order.</p>

                        <div className="example-block">
                            <strong>Example 1:</strong>
                            <pre>
                                Input: nums = [2,7,11,15], target = 9{'\n'}
                                Output: [0,1]{'\n'}
                                Explanation: Because nums[0] + nums[1] == 9, we return [0, 1].
                            </pre>
                        </div>

                        <div className="example-block">
                            <strong>Example 2:</strong>
                            <pre>
                                Input: nums = [3,2,4], target = 6{'\n'}
                                Output: [1,2]
                            </pre>
                        </div>
                    </div>
                </section>

                {/* Right Panel: Editor Area */}
                <section className="panel editor-panel">
                    <div className="editor-header">
                        <div className="editor-tabs">
                            <button className="editor-tab active">
                                <Code2 className="h-4 w-4 mr-2" />
                                solution.js
                            </button>
                        </div>
                        <div className="editor-actions">
                            <Button variant="ghost" size="sm">
                                <Settings className="h-4 w-4" />
                            </Button>
                            <Button size="sm" className="ml-2">
                                <Play className="h-4 w-4 mr-2" />
                                Run Code
                            </Button>
                        </div>
                    </div>

                    <div className="editor-content">
                        <div className="line-numbers">
                            {code.split('\n').map((_, i) => (
                                <div key={i} className="line-number">{i + 1}</div>
                            ))}
                        </div>
                        <textarea
                            className="code-textarea"
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                            spellCheck="false"
                        />
                    </div>

                    <div className="editor-console">
                        <div className="console-header">
                            <span className="text-sm font-semibold">Console Output</span>
                        </div>
                        <div className="console-content">
                            <span className="text-muted text-sm">Waiting for execution...</span>
                        </div>
                    </div>
                </section>
            </main>

            {/* Floating Chat Button (Placeholder) */}
            <button className="chat-fab">
                <MessageSquare className="h-6 w-6" />
            </button>
        </div>
    );
};
