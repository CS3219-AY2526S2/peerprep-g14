import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import Editor, { type OnMount, type BeforeMount } from '@monaco-editor/react';
import * as Y from 'yjs';
// @ts-ignore
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';
import { useAuth } from '../context/AuthContext';
import { getMonacoLang, configureMonaco, createCursorStyleUpdater } from './monacoSetup';

interface CodeEditorProps {
    value: string;
    onChange: (value: string | undefined) => void;
    language?: string;
    sessionId?: string;
    currentUser?: { name: string; color: string };
    onSystemTerminate?: (reason: string) => void;
    onPartnerPresenceChange?: (isPresent: boolean) => void;
    onYdocReady?: (ydoc: Y.Doc) => void;
    onPeerTranslation?: (language: string) => void;
    onLanguageChangeRequest?: (language: string) => void;
    onLanguageChangeApproved?: (language: string) => void;
    onLanguageChangeResponse?: (isApproved: boolean) => void;
    onTranslationApprovalRequest?: (language: string, timestamp: number) => void;
    onTranslationApprovalResponse?: (isApproved: boolean, timestamp: number) => void;
}

export interface CodeEditorHandle {
    getCode: () => string;
    setCode: (code: string) => void;
    broadcastTranslation: (targetLanguage: string) => void;
    broadcastLanguageRequest: (language: string) => void;
    broadcastLanguageApproved: (language: string) => void;
    broadcastLanguageResponse: (isApproved: boolean, timestamp: number) => void;
    broadcastTranslationApprovalRequest: (language: string, timestamp: number) => void;
    broadcastTranslationApprovalResponse: (isApproved: boolean, timestamp: number) => void;
}

const PEER_ENDED_MSG = 'This Session has been ended by a peer. Returning to Dashboard.';

export const CodeEditor = forwardRef<CodeEditorHandle, CodeEditorProps>(({ onChange, language = 'javascript', sessionId = 'default-session', currentUser, onSystemTerminate, onYdocReady, onPartnerPresenceChange, onPeerTranslation, onLanguageChangeRequest, onLanguageChangeApproved, onLanguageChangeResponse, onTranslationApprovalRequest, onTranslationApprovalResponse }, ref) => {
    const { userId } = useAuth();
    const editorRef = useRef<any>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const ydocRef = useRef<Y.Doc | null>(null);
    const partnerOfflineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const monacoRef = useRef<any>(null);
    const monacoLang = getMonacoLang(language);

    const onPeerTranslationRef = useRef(onPeerTranslation);
    onPeerTranslationRef.current = onPeerTranslation;

    const onLanguageChangeRequestRef = useRef(onLanguageChangeRequest);
    onLanguageChangeRequestRef.current = onLanguageChangeRequest;

    const onLanguageChangeApprovedRef = useRef(onLanguageChangeApproved);
    onLanguageChangeApprovedRef.current = onLanguageChangeApproved;

    const onLanguageChangeResponseRef = useRef(onLanguageChangeResponse);
    onLanguageChangeResponseRef.current = onLanguageChangeResponse;

    const onTranslationApprovalRequestRef = useRef(onTranslationApprovalRequest);
    onTranslationApprovalRequestRef.current = onTranslationApprovalRequest;

    const onTranslationApprovalResponseRef = useRef(onTranslationApprovalResponse);
    onTranslationApprovalResponseRef.current = onTranslationApprovalResponse;

    useImperativeHandle(ref, () => ({
        getCode: () => {
            const ydoc = ydocRef.current;
            if (ydoc) {
                return ydoc.getText('monaco').toString();
            }
            return editorRef.current?.getValue() || '';
        },
        setCode: (code: string) => {
            const ydoc = ydocRef.current;
            if (ydoc) {
                const ytext = ydoc.getText('monaco');
                ydoc.transact(() => {
                    ytext.delete(0, ytext.length);
                    ytext.insert(0, code);
                });
            }
        },
        broadcastTranslation: (targetLanguage: string) => {
            const provider = providerRef.current;
            if (provider) {
                provider.awareness.setLocalStateField('translation', {
                    language: targetLanguage,
                    timestamp: Date.now(),
                });
                // clear the translation field after 2 seconds so it doesn't trigger again
                setTimeout(() => {
                    provider.awareness.setLocalStateField('translation', null);
                }, 2000);
            }
        },
        broadcastLanguageRequest: (targetLanguage: string) => {
            const provider = providerRef.current;
            if (provider) {
                provider.awareness.setLocalStateField('languageRequest', {
                    language: targetLanguage,
                    timestamp: Date.now(),
                });
                setTimeout(() => {
                    provider.awareness.setLocalStateField('languageRequest', null);
                }, 2000);
            }
        },
        broadcastLanguageApproved: (targetLanguage: string) => {
            const provider = providerRef.current;
            if (provider) {
                provider.awareness.setLocalStateField('languageApproved', {
                    language: targetLanguage,
                    timestamp: Date.now(),
                });
                setTimeout(() => {
                    provider.awareness.setLocalStateField('languageApproved', null);
                }, 2000);
            }
        },
        broadcastLanguageResponse: (isApproved: boolean, timestamp: number) => {
            const provider = providerRef.current;
            if (provider) {
                provider.awareness.setLocalStateField('languageResponse', {
                    isApproved, timestamp
                });
                setTimeout(() => provider.awareness.setLocalStateField('languageResponse', null), 2000);
            }
        },
        broadcastTranslationApprovalRequest: (language: string, timestamp: number) => {
            const provider = providerRef.current;
            if (provider) {
                provider.awareness.setLocalStateField('translationApprovalRequest', {
                    language, timestamp
                });
                setTimeout(() => provider.awareness.setLocalStateField('translationApprovalRequest', null), 2000);
            }
        },
        broadcastTranslationApprovalResponse: (isApproved: boolean, timestamp: number) => {
            const provider = providerRef.current;
            if (provider) {
                provider.awareness.setLocalStateField('translationApprovalResponse', {
                    isApproved, timestamp
                });
                setTimeout(() => provider.awareness.setLocalStateField('translationApprovalResponse', null), 2000);
            }
        },
    }), []);

    const handleBeforeMount: BeforeMount = (monaco) => {
        monacoRef.current = monaco;
        configureMonaco(monaco);
    };

    const handleEditorDidMount: OnMount = (editor) => {
        editorRef.current = editor;
        let didEmitTermination = false;
        const emitTermination = (reason?: string) => {
            if (didEmitTermination) return;
            didEmitTermination = true;
            if (partnerOfflineTimerRef.current) {
                clearTimeout(partnerOfflineTimerRef.current);
                partnerOfflineTimerRef.current = null;
            }

            try {
                provider.disconnect();
            } catch {
                /* ignore */
            }
            onSystemTerminate?.(reason || PEER_ENDED_MSG);
        };

        const clearPartnerOfflineTimer = () => {
            if (partnerOfflineTimerRef.current) {
                clearTimeout(partnerOfflineTimerRef.current);
                partnerOfflineTimerRef.current = null;
            }
        };

        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;
        onYdocReady?.(ydoc);

        // const wsUrl = 'ws://localhost/api/collaboration/ws';
        const wsUrl = 'https://backend-server-kppd.onrender.com/api/collaboration/ws';

        const provider = new WebsocketProvider(wsUrl, sessionId, ydoc, {
            params: { userId: userId || 'anonymous' }
        });
        providerRef.current = provider;

        if (currentUser) {
            provider.awareness.setLocalStateField('user', {
                name: currentUser.name,
                color: currentUser.color
            });
        }

        const sysMap = ydoc.getMap('sys');
        sysMap.observe(() => {
            if (sysMap.get('status') === 'terminated') {
                const termReason = sysMap.get('terminateReason') as string | undefined;
                let text = (sysMap.get('reason') as string) || 'This session has ended. Returning to Dashboard.';
                if (termReason === 'Deliberate') text = 'This session was ended by your peer. Returning to the dashboard';
                else if (termReason === 'Timeout') text = 'Your peer did not connect within the time limit. Returning to dashboard';
                else if (termReason === 'Inactive') text = 'Session timed out due to 30 minutes of inactivity.';

                emitTermination(text);
            }
        });

        let hasPartnerJoined = false;

        const PARTNER_OFFLINE_DEBOUNCE_MS = 650;

        const maybeReportPartnerOfflineAfterDebounce = () => {
            if (!onPartnerPresenceChange || didEmitTermination) return;
            clearPartnerOfflineTimer();
            partnerOfflineTimerRef.current = setTimeout(async () => {
                partnerOfflineTimerRef.current = null;
                if (didEmitTermination || !onPartnerPresenceChange) return;

                const states = provider.awareness.getStates();
                if (states.size > 1) {
                    onPartnerPresenceChange(true);
                    return;
                }

                if (sysMap.get('status') === 'terminated') {
                    emitTermination(sysMap.get('reason') as string | undefined);
                    return;
                }

                try {
                    const res = await fetch(`/api/collaboration/sessions/${encodeURIComponent(sessionId)}`, {
                        credentials: 'include',
                    });
                    if (res.status === 403 || res.status === 404) {
                        emitTermination(PEER_ENDED_MSG);
                        return;
                    }
                    if (res.ok) {
                        const data = (await res.json()) as {
                            status?: string;
                            terminateReason?: string | null;
                        };
                        if (data.status === 'terminated') {
                            let text = data.terminateReason || 'This session has ended. Returning to Dashboard.';
                            if (data.terminateReason === 'Deliberate') {
                                text = 'This session was ended by your peer. Returning to the dashboard';
                            } else if (data.terminateReason === 'Timeout') {
                                text = 'Your peer did not connect within the time limit. Returning to dashboard';
                            } else if (data.terminateReason === 'Inactive') {
                                text = 'Session timed out due to 30 minutes of inactivity.';
                            }
                            emitTermination(text);
                            return;
                        }
                    }
                } catch {
                    // ignore network errors
                }

                if (didEmitTermination) return;
                const statesAfter = provider.awareness.getStates();
                if (statesAfter.size > 1) {
                    onPartnerPresenceChange(true);
                    return;
                }
                onPartnerPresenceChange(false);
            }, PARTNER_OFFLINE_DEBOUNCE_MS);
        };

        // track last seen translation timestamp to avoid duplicate notifications
        const seenTranslations = new Set<number>();
        const seenLanguageRequests = new Set<number>();
        const seenLanguageApprovals = new Set<number>();
        const seenLanguageResponses = new Set<number>();
        const seenTranslationRequests = new Set<number>();
        const seenTranslationResponses = new Set<number>();

        provider.awareness.on('change', () => {
            if (!onPartnerPresenceChange) return;
            if (didEmitTermination) return;
            const states = provider.awareness.getStates();
            if (states.size > 1) {
                hasPartnerJoined = true;
                clearPartnerOfflineTimer();
                onPartnerPresenceChange(true);
            } else if (hasPartnerJoined && states.size <= 1) {
                maybeReportPartnerOfflineAfterDebounce();
            }

            // check for peer notifications locally
            states.forEach((state: any, clientID: number) => {
                if (clientID === ydoc.clientID) return; // skip own state
                if (state.translation && state.translation.language && state.translation.timestamp) {
                    if (!seenTranslations.has(state.translation.timestamp)) {
                        seenTranslations.add(state.translation.timestamp);
                        onPeerTranslationRef.current?.(state.translation.language);
                    }
                }
                if (state.languageRequest && state.languageRequest.language && state.languageRequest.timestamp) {
                    if (!seenLanguageRequests.has(state.languageRequest.timestamp)) {
                        seenLanguageRequests.add(state.languageRequest.timestamp);
                        onLanguageChangeRequestRef.current?.(state.languageRequest.language);
                    }
                }
                if (state.languageApproved && state.languageApproved.language && state.languageApproved.timestamp) {
                    if (!seenLanguageApprovals.has(state.languageApproved.timestamp)) {
                        seenLanguageApprovals.add(state.languageApproved.timestamp);
                        onLanguageChangeApprovedRef.current?.(state.languageApproved.language);
                    }
                }
                if (state.languageResponse && state.languageResponse.timestamp) {
                    if (!seenLanguageResponses.has(state.languageResponse.timestamp)) {
                        seenLanguageResponses.add(state.languageResponse.timestamp);
                        onLanguageChangeResponseRef.current?.(state.languageResponse.isApproved);
                    }
                }
                if (state.translationApprovalRequest && state.translationApprovalRequest.language && state.translationApprovalRequest.timestamp) {
                    if (!seenTranslationRequests.has(state.translationApprovalRequest.timestamp)) {
                        seenTranslationRequests.add(state.translationApprovalRequest.timestamp);
                        onTranslationApprovalRequestRef.current?.(state.translationApprovalRequest.language, state.translationApprovalRequest.timestamp);
                    }
                }
                if (state.translationApprovalResponse && state.translationApprovalResponse.timestamp) {
                    if (!seenTranslationResponses.has(state.translationApprovalResponse.timestamp)) {
                        seenTranslationResponses.add(state.translationApprovalResponse.timestamp);
                        onTranslationApprovalResponseRef.current?.(state.translationApprovalResponse.isApproved, state.translationApprovalResponse.timestamp);
                    }
                }
            });
        });

        // one-time check after WebSocket sync: if user reconnects and peer is already gone
        const onFirstSync = (synced: boolean) => {
            if (!synced || !onPartnerPresenceChange || didEmitTermination) return;
            provider.off('sync', onFirstSync);
            const states = provider.awareness.getStates();
            if (states.size <= 1) {
                // user is alone — show the disconnect modal right away
                onPartnerPresenceChange(false);
            }
        };
        provider.on('sync', onFirstSync);

        provider.on('connection-close', (event: CloseEvent) => {
            if (event?.code === 4000) {
                emitTermination(event.reason || PEER_ENDED_MSG);
            }
        });

        const type = ydoc.getText('monaco');

        bindingRef.current = new MonacoBinding(
            type,
            editor.getModel()!,
            new Set([editor]),
            provider.awareness
        );

        // inject per-client cursor colour rules whenever awareness changes
        const { update: updateCursorStyles, cleanup: cleanupCursorStyles } =
            createCursorStyleUpdater(provider.awareness, ydoc.clientID);

        provider.awareness.on('change', updateCursorStyles);
        updateCursorStyles();

        type.observe(() => {
            onChange(type.toString());
        });

        // remove injected style on cleanup
        return () => { cleanupCursorStyles(); };
    };

    // update the monaco model language when the prop changes
    useEffect(() => {
        if (!editorRef.current || !monacoRef.current) return;
        const model = editorRef.current.getModel();
        if (model) monacoRef.current.editor.setModelLanguage(model, monacoLang);
    }, [monacoLang]);

    useEffect(() => {
        return () => {
            if (partnerOfflineTimerRef.current) {
                clearTimeout(partnerOfflineTimerRef.current);
                partnerOfflineTimerRef.current = null;
            }
            bindingRef.current?.destroy();
            providerRef.current?.destroy();
            ydocRef.current?.destroy();
        };
    }, []);

    return (
        <div style={{ height: '100%', width: '100%' }}>
            <Editor
                height="100%"
                defaultLanguage={monacoLang}
                language={monacoLang}
                theme="vs-dark"
                beforeMount={handleBeforeMount}
                onMount={handleEditorDidMount}
                options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    wordWrap: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 16 },
                    quickSuggestions: true,
                    suggestOnTriggerCharacters: true,
                    tabCompletion: 'on',
                }}
            />
        </div>
    );
});

CodeEditor.displayName = 'CodeEditor';
