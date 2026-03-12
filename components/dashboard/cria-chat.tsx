"use client";

import { useChat, type Message } from "ai/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User, Send, StopCircle, Paperclip, X, ChevronLeft, ChevronRight } from "lucide-react";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import { RichTextViewer } from "@/components/dashboard/rich-text-viewer";

interface UploadedDocument {
    id: string;
    name: string;
    content: string;
    html: string;
    type: string;
}

export function CriaChat() {
    const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
    const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const processedAnnotations = useRef(new Set<string>());
    const snippetPaginationRef = useRef<{ weaknessId: string, index: number }>({ weaknessId: '', index: 0 });
    const [activeComment, setActiveComment] = useState<{ comment: string; x: number; y: number; maxHeight?: number; snippetId?: string; weaknessId?: string } | null>(null);
    const [weaknessesMetadata, setWeaknessesMetadata] = useState<{ id: string; area: string; critique: string; weaknessText: string; color: string }[]>([]);
    const [activeFilterWeaknessId, setActiveFilterWeaknessId] = useState<string | null>(null);
    const docPanelRef = useRef<HTMLDivElement>(null);

    const { messages, input, handleInputChange, handleSubmit, isLoading, stop } = useChat({
        api: "/api/chat",
        body: {
            uploadedDocuments,
            activeDocumentId,
        },
    });
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }

        // Process any new annotations (UI commands) from the AI across all messages
        // The 8: protocol may send an array of commands as a single annotation item,
        // so we flatten before processing.
        messages.forEach(message => {
            if (message.annotations) {
                // Flatten any nested arrays (8: protocol nests the array)
                const flatAnnotations: any[] = (message.annotations as any[]).flat(10);
                flatAnnotations.forEach((ann: any, index: number) => {
                    const annotationId = `${message.id}-${JSON.stringify(ann).substring(0, 100)}-${index}`;
                    if (!processedAnnotations.current.has(annotationId)) {
                        processedAnnotations.current.add(annotationId);

                        if (ann.type === "ui_command") {
                            console.log("Executing UI Command from annotation:", ann.tool, ann.args);
                            executeCommand(ann.tool, ann.args);
                        }
                    }
                });
            }
        });
    }, [messages]);

    const handleNextSnippet = useCallback(() => {
        if (!activeFilterWeaknessId) return;
        const marks = Array.from(document.querySelectorAll(`mark[data-weakness-ids*='"${activeFilterWeaknessId}"']`));
        if (marks.length === 0) return;

        let nextIndex = 0;
        if (snippetPaginationRef.current.weaknessId === activeFilterWeaknessId) {
            nextIndex = (snippetPaginationRef.current.index + 1) % marks.length;
        }
        snippetPaginationRef.current = { weaknessId: activeFilterWeaknessId, index: nextIndex };

        const targetSnippet = marks[nextIndex] as HTMLElement;
        targetSnippet.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetSnippet.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => targetSnippet.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
    }, [activeFilterWeaknessId]);

    const handlePrevSnippet = useCallback(() => {
        if (!activeFilterWeaknessId) return;
        const marks = Array.from(document.querySelectorAll(`mark[data-weakness-ids*='"${activeFilterWeaknessId}"']`));
        if (marks.length === 0) return;

        let prevIndex = marks.length - 1;
        if (snippetPaginationRef.current.weaknessId === activeFilterWeaknessId) {
            prevIndex = (snippetPaginationRef.current.index - 1 + marks.length) % marks.length;
        }
        snippetPaginationRef.current = { weaknessId: activeFilterWeaknessId, index: prevIndex };

        const targetSnippet = marks[prevIndex] as HTMLElement;
        targetSnippet.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetSnippet.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        setTimeout(() => targetSnippet.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
    }, [activeFilterWeaknessId]);

    const executeCommand = (tool: string, args: any) => {
        switch (tool) {
            case "open_document":
                setActiveDocumentId(args.documentId);
                break;
            case "close_document":
                setActiveDocumentId(null);
                break;
            case "edit_text":
                if (activeDocumentId) {
                    setUploadedDocuments(prev => prev.map(doc => {
                        if (doc.id === activeDocumentId) {
                            const newHtml = doc.html.replace(args.searchText, args.replaceText);
                            const newText = doc.content.replace(args.searchText, args.replaceText);
                            return { ...doc, html: newHtml, content: newText };
                        }
                        return doc;
                    }));
                }
                break;
            case "highlight_and_comment": {
                const targetDocId = args.documentId || activeDocumentId;
                if (targetDocId) {
                    if (args.documentId && activeDocumentId !== args.documentId) {
                        setActiveDocumentId(args.documentId);
                    }
                    setUploadedDocuments(prev => prev.map(doc => {
                        if (doc.id === targetDocId) {
                            const safeComment = args.comment
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;');

                            // Build a regex that matches the text snippet even when HTML tags
                            // (like <p>, <span>, <strong>, etc.) appear between words
                            const htmlTagPattern = '(?:<[^>]*>)*';
                            const escapeRegExp = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                            // Split snippet into words and join with a pattern that allows
                            // any whitespace and/or HTML tags between them
                            const words = args.textSnippet.split(/\s+/).filter(Boolean);
                            const pattern = words
                                .map((w: string) => escapeRegExp(w))
                                .join(`${htmlTagPattern}\\s*${htmlTagPattern}`);

                            try {
                                const regex = new RegExp(pattern, 'gi');
                                const newHtml = doc.html.replace(regex, (match: string) => {
                                    const idAttr = args.snippetId ? `id="${args.snippetId}"` : '';
                                    // Serialize the array of weakness IDs
                                    const weaknessesIdsAttr = args.weaknessIds ? `data-weakness-ids='${JSON.stringify(args.weaknessIds)}'` : '';
                                    const colorClass = args.colorClass || '#fef08a'; // e.g., yellow-200
                                    return `<mark class="doc-highlight" style="background-color: ${colorClass};" ${idAttr} ${weaknessesIdsAttr} data-comment="${safeComment}">${match}</mark>`;
                                });

                                if (newHtml !== doc.html) {
                                    console.log(`[UI] Successfully highlighted snippet: "${args.textSnippet.substring(0, 50)}..."`);
                                } else {
                                    console.warn(`[UI] Could not find snippet in HTML: "${args.textSnippet.substring(0, 50)}..."`);
                                }
                                return { ...doc, html: newHtml };
                            } catch (e) {
                                console.error("[UI] Regex error during highlight:", e);
                                return doc;
                            }
                        }
                        return doc;
                    }));
                }
                break;
            }
            case "highlight_weakness": {
                const targetDocId = args.documentId || activeDocumentId;
                if (targetDocId) {
                    setUploadedDocuments(prev => prev.map(doc => {
                        if (doc.id === targetDocId) {
                            const safeComment = args.comment
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;');

                            // Serialize the array of snippet IDs
                            const linkedSnippetsAttr = args.linkedSnippetIds ? `data-linked-snippets='${JSON.stringify(args.linkedSnippetIds)}'` : '';
                            const weaknessAttr = args.weaknessId ? `id="${args.weaknessId}" data-weakness-id="${args.weaknessId}" data-is-weakness="true"` : '';

                            const escapeRegExp = (ch: string) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            const htmlTagPattern = '(?:<[^>]*>)*';
                            const words = args.textSnippet.split(/\s+/).filter(Boolean);
                            const pattern = words
                                .map((w: string) => escapeRegExp(w))
                                .join(`${htmlTagPattern}\\s*${htmlTagPattern}`);

                            try {
                                const regex = new RegExp(pattern, 'gi');
                                const newHtml = doc.html.replace(regex, (match: string) => {
                                    const colorClass = args.colorClass || '#fef08a'; // e.g., yellow-200
                                    return `<mark class="doc-highlight" style="background-color: ${colorClass};" ${weaknessAttr} ${linkedSnippetsAttr} data-comment="${safeComment}">${match}</mark>`;
                                });

                                if (newHtml !== doc.html) {
                                    console.log(`[UI] Successfully highlighted weakness: "${args.textSnippet.substring(0, 50)}..."`);
                                }
                                return { ...doc, html: newHtml };
                            } catch (e) {
                                console.error("[UI] Regex error during weakness highlight:", e);
                                return doc;
                            }
                        }
                        return doc;
                    }));
                }
                break;
            }
            case "set_weaknesses_metadata":
                if (args.weaknesses) {
                    setWeaknessesMetadata(args.weaknesses);
                }
                break;
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const res = await fetch("/api/parse-document", {
                method: "POST",
                body: formData,
            });
            const data = await res.json();

            if (res.ok && data.text) {
                const newDoc: UploadedDocument = {
                    id: Date.now().toString(),
                    name: file.name,
                    content: data.text,
                    html: data.html || "",
                    type: file.name.split('.').pop() || "txt"
                };
                setUploadedDocuments(prev => [...prev, newDoc]);
                setActiveDocumentId(newDoc.id);
            } else {
                console.error("Failed to parse document:", data.error);
            }
        } catch (error) {
            console.error("Error uploading document:", error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const activeDocument = uploadedDocuments.find(d => d.id === activeDocumentId);
    const hasDocuments = uploadedDocuments.length > 0;

    return (
        <ResizablePanelGroup direction="horizontal" className="h-[calc(100vh-80px)] m-4 shadow-lg border border-primary/10 rounded-xl overflow-hidden">
            {/* Chat Panel */}
            <ResizablePanel defaultSize={50} minSize={30} className={`flex flex-col bg-card ${activeDocument ? "" : "min-w-full"}`}>
                <Card className="flex flex-col h-full border-0 rounded-none shadow-none">
                    <CardHeader className="border-b bg-muted/30 pb-4">
                        <CardTitle className="flex items-center gap-2 text-xl font-bold">
                            <Bot className="h-6 w-6 text-primary" />
                            Cria AI Assistant
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
                        <div ref={scrollRef} className="flex-1 p-4 overflow-y-auto space-y-4">
                            {messages.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
                                    <Bot className="h-12 w-12 opacity-20" />
                                    <p className="text-center">
                                        Hi! I'm Cria, your AI assistant.<br />
                                        How can I help you today?
                                    </p>
                                </div>
                            ) : (
                                messages.map((m: Message) => (
                                    <div
                                        key={m.id}
                                        className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : "flex-row"
                                            }`}
                                    >
                                        <Avatar className="w-8 h-8 shrink-0">
                                            <AvatarFallback
                                                className={
                                                    m.role === "user"
                                                        ? "bg-primary text-primary-foreground"
                                                        : "bg-muted text-muted-foreground"
                                                }
                                            >
                                                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div
                                            className={`rounded-lg px-4 py-2 max-w-[80%] break-words ${m.role === "user"
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-muted/50 border shadow-sm"
                                                }`}
                                        >
                                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                            {isLoading && messages[messages.length - 1]?.role === "user" && (
                                <div className="flex items-start gap-3 flex-row">
                                    <Avatar className="w-8 h-8 shrink-0">
                                        <AvatarFallback className="bg-muted text-muted-foreground">
                                            <Bot className="h-4 w-4" />
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="rounded-lg px-1 py-4 h-9 bg-muted/50 border shadow-sm flex items-center justify-center gap-1 w-12">
                                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t bg-background flex flex-col gap-2">
                            {hasDocuments && (
                                <div className="flex flex-col gap-1 text-xs text-muted-foreground bg-muted/50 p-2 rounded-md">
                                    <div className="flex items-center gap-2 font-medium">
                                        <Paperclip className="h-3 w-3" />
                                        {uploadedDocuments.length} document(s) uploaded and shared with AI
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-1">
                                        {uploadedDocuments.map(doc => (
                                            <div
                                                key={doc.id}
                                                onClick={() => setActiveDocumentId(doc.id)}
                                                className={`px-2 py-1 rounded cursor-pointer border ${activeDocumentId === doc.id ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-background hover:bg-muted'}`}
                                            >
                                                {doc.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    accept=".docx,.pdf,.txt,.md"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading || isLoading}
                                    title="Attach document (DOCX, PDF, TXT)"
                                >
                                    <Paperclip className="h-4 w-4" />
                                </Button>
                                <Input
                                    value={input}
                                    onChange={handleInputChange}
                                    placeholder="Type your message..."
                                    className="flex-1"
                                    disabled={isLoading}
                                />
                                {isLoading ? (
                                    <Button type="submit" variant="destructive" size="icon" onClick={(e) => { e.preventDefault(); stop(); }}>
                                        <StopCircle className="h-4 w-4" />
                                    </Button>
                                ) : (
                                    <Button type="submit" size="icon" disabled={!input.trim()}>
                                        <Send className="h-4 w-4" />
                                    </Button>
                                )}
                            </form>
                        </div>
                    </CardContent>
                </Card>
            </ResizablePanel>

            {/* Document Editor Panel */}
            <ResizableHandle className={activeDocument ? "" : "hidden"} />
            <ResizablePanel
                defaultSize={50}
                minSize={30}
                className={`flex flex-col bg-background ${activeDocument ? "" : "hidden"}`}
            >
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3 h-[73px]">
                    <div className="flex items-center gap-2">
                        <Paperclip className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold text-foreground truncate max-w-[300px]" title={activeDocument?.name}>
                            {activeDocument?.name || "Document Viewer"}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setActiveDocumentId(null)}
                            title="Close Document"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Filter Header for Weaknesses */}
                {weaknessesMetadata.length > 0 && activeDocument?.name.match(/\.(docx?)$/i) && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/10 overflow-x-auto whitespace-nowrap scrollbar-thin">
                        <span className="text-xs font-semibold text-muted-foreground mr-2 shrink-0">Filter by Weakness:</span>
                        <Button
                            variant={activeFilterWeaknessId === null ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs rounded-full shrink-0"
                            onClick={() => setActiveFilterWeaknessId(null)}
                        >
                            All
                        </Button>
                        {weaknessesMetadata.map((w, idx) => {
                            const isActive = activeFilterWeaknessId === w.id;
                            return (
                                <div key={w.id} className="flex items-center gap-1 shrink-0">
                                    <Button
                                        variant={isActive ? "secondary" : "ghost"}
                                        size="sm"
                                        className={`h-7 text-xs rounded-full shrink-0 border border-transparent ${isActive ? 'ring-2 ring-primary border-background' : ''}`}
                                        onClick={() => {
                                            const newId = isActive ? null : w.id;
                                            setActiveFilterWeaknessId(newId);
                                            // Auto-scroll to first snippet when activating
                                            if (newId) {
                                                setTimeout(() => {
                                                    const marks = Array.from(document.querySelectorAll(`mark[data-weakness-ids*='"${newId}"']`));
                                                    if (marks.length > 0) {
                                                        snippetPaginationRef.current = { weaknessId: newId, index: 0 };
                                                        const targetSnippet = marks[0] as HTMLElement;
                                                        targetSnippet.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                        targetSnippet.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                                                        setTimeout(() => targetSnippet.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
                                                    }
                                                }, 100);
                                            }
                                        }}
                                        title={`${w.area} — ${w.critique}\n${w.weaknessText}`}
                                    >
                                        <span className="w-3 h-3 rounded-full mr-1.5" style={{ backgroundColor: w.color }}></span>
                                        W{idx + 1}
                                    </Button>
                                    {isActive && (
                                        <div className="flex items-center gap-0.5 ml-1 bg-muted/50 rounded-full border px-0.5">
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={handlePrevSnippet}>
                                                <ChevronLeft className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={handleNextSnippet}>
                                                <ChevronRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div ref={docPanelRef} className="flex-1 p-4 overflow-hidden flex flex-col relative">
                    {activeDocument && (
                        <RichTextViewer
                            htmlContent={activeDocument.html || `<div>${activeDocument.content}</div>`}
                            activeFilterWeaknessId={activeFilterWeaknessId}
                            onChange={(html, text) => {
                                setUploadedDocuments(prev => prev.map(doc =>
                                    doc.id === activeDocument.id
                                        ? { ...doc, html, content: text }
                                        : doc
                                ));
                            }}
                            onCommentClick={(comment, rect, snippetId, weaknessId, isWeakness) => {
                                // If this is a click on a weakness in the PDF (marked with data-is-weakness),
                                // instantly navigate to the linked snippet in the draft, set the filter, and optionally cycle
                                if (isWeakness && weaknessId) {
                                    const wordDoc = uploadedDocuments.find((d) => /\.(docx?)$/i.test(d.name));
                                    if (wordDoc) {
                                        setActiveDocumentId(wordDoc.id);
                                        setActiveFilterWeaknessId(weaknessId);

                                        setTimeout(() => {
                                            const linkedSnippets = Array.from(document.querySelectorAll(`mark[data-weakness-ids*='"${weaknessId}"']`));

                                            if (linkedSnippets.length > 0) {
                                                let currentIndex = 0;
                                                // Cycle if they previously had this selected
                                                if (snippetPaginationRef.current.weaknessId === weaknessId) {
                                                    currentIndex = (snippetPaginationRef.current.index + 1) % linkedSnippets.length;
                                                }
                                                snippetPaginationRef.current = { weaknessId, index: currentIndex };

                                                const targetSnippet = linkedSnippets[currentIndex] as HTMLElement;
                                                targetSnippet.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                targetSnippet.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                                                setTimeout(() => targetSnippet.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
                                            }
                                        }, 500); // Wait for Word doc to mount
                                    }
                                    return; // Don't show the popover
                                }

                                const panelRect = docPanelRef.current?.getBoundingClientRect();
                                if (panelRect) {
                                    const popoverWidth = 320; // 20rem
                                    const padding = 16;
                                    const bottomMargin = 25;

                                    let fixedX = rect.right + padding;

                                    // Right boundary clamping
                                    if (fixedX + popoverWidth > window.innerWidth) {
                                        fixedX = rect.left - popoverWidth - padding;
                                        if (fixedX < panelRect.left + padding) {
                                            fixedX = panelRect.left + padding;
                                        }
                                    }

                                    let fixedY = rect.bottom + 8; // Anchor slightly below the text
                                    let computedMaxHeight = 450; // Ideal reading max height

                                    // If rendering it below the highlight overflows the bottom of the screen
                                    if (fixedY + computedMaxHeight > window.innerHeight - bottomMargin) {
                                        const spaceAbove = rect.top - bottomMargin;
                                        const spaceBelow = window.innerHeight - rect.bottom - bottomMargin;

                                        // If there is more room above the highlight than below it, flip it upwards
                                        if (spaceAbove > spaceBelow) {
                                            computedMaxHeight = Math.min(450, spaceAbove);
                                            fixedY = rect.top - computedMaxHeight - 8;
                                        } else {
                                            // More space below, so keep it below but compress its height
                                            computedMaxHeight = Math.min(450, spaceBelow);
                                        }
                                    }

                                    // Absolute failsafe clip for tiny windows
                                    if (fixedY < padding) {
                                        fixedY = padding;
                                        computedMaxHeight = window.innerHeight - (padding * 2);
                                    }

                                    setActiveComment({
                                        comment,
                                        x: fixedX,
                                        y: fixedY,
                                        maxHeight: computedMaxHeight,
                                        snippetId,
                                        weaknessId
                                    });
                                }
                            }}
                        />
                    )}

                    {/* Comment Popover */}
                    {activeComment && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setActiveComment(null)}
                            />
                            <div
                                className="fixed z-50 w-80 bg-popover text-popover-foreground border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200 flex flex-col"
                                style={{
                                    left: activeComment.x,
                                    top: activeComment.y,
                                    maxHeight: activeComment.maxHeight ? `${activeComment.maxHeight}px` : '400px'
                                }}
                                onClick={(e) => e.stopPropagation()} // Prevent closing when interacting with popover
                            >
                                <div className="flex items-center gap-2 px-3 py-2 bg-muted border-b border-border">
                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-0.5">
                                        💬 AI Comment
                                    </span>
                                </div>
                                <div
                                    className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] select-text cursor-auto"
                                    style={{ maxHeight: activeComment.maxHeight ? `${activeComment.maxHeight - 45}px` : '350px' }}
                                >
                                    {(() => {
                                        let parsedWeaknesses: any[] | null = null;
                                        try {
                                            parsedWeaknesses = JSON.parse(activeComment.comment);
                                        } catch (e) {
                                            // Fallback for older string comments
                                            parsedWeaknesses = null;
                                        }

                                        if (Array.isArray(parsedWeaknesses)) {
                                            return parsedWeaknesses.map((pw, idx) => (
                                                <div key={idx} className="p-4 border-b border-border last:border-0 relative">
                                                    <div className="flex items-start gap-2 mb-2">
                                                        <span
                                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                                                            style={{ backgroundColor: pw.color || '#e2e8f0', color: '#0f172a' }}
                                                        >
                                                            W{pw.wIndex}
                                                        </span>
                                                        <h4 className="font-semibold text-sm leading-tight pt-0.5">{pw.area} — {pw.critique}</h4>
                                                    </div>

                                                    <p className="text-[13px] text-muted-foreground italic border-l-[3px] border-primary/30 pl-3 py-0.5 mb-3 leading-snug">"{pw.weaknessText}"</p>

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="w-full text-xs h-7 mb-4 bg-primary/5 hover:bg-primary/10 text-primary border border-primary/20 transition-colors"
                                                        onClick={() => {
                                                            const pdfDoc = uploadedDocuments.find((d) => d.name.toLowerCase().endsWith(".pdf"));
                                                            if (pdfDoc) {
                                                                setActiveDocumentId(pdfDoc.id);
                                                                setActiveFilterWeaknessId(pw.id);
                                                                setActiveComment(null);
                                                                setTimeout(() => {
                                                                    const weaknessElement = document.getElementById(pw.id);
                                                                    if (weaknessElement) {
                                                                        weaknessElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                                                        weaknessElement.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
                                                                        setTimeout(() => weaknessElement.classList.remove('ring-2', 'ring-primary', 'ring-offset-2'), 2000);
                                                                    }
                                                                }, 500);
                                                            }
                                                        }}
                                                    >
                                                        Go to weakness {pw.wIndex} in PDF
                                                    </Button>

                                                    <div className="space-y-4 text-[13px]">
                                                        <div>
                                                            <span className="font-semibold text-[10px] tracking-wider uppercase text-muted-foreground block mb-1">Reasoning</span>
                                                            <p className="leading-relaxed text-foreground/90">{pw.reasoning}</p>
                                                        </div>
                                                        <div>
                                                            <span className="font-semibold text-[10px] tracking-wider uppercase text-muted-foreground block mb-1">AI Suggestion</span>
                                                            <p className="leading-relaxed text-foreground/90">{pw.comment}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ));
                                        }

                                        return (
                                            <div className="p-3">
                                                {activeComment.comment.split('\n').filter(l => l.trim()).map((line, i) => (
                                                    <p key={i} className="mb-3 last:mb-0 text-sm" dangerouslySetInnerHTML={{
                                                        __html: line
                                                            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                            .replace(/\*(.*?)\*/g, '<em class="text-muted-foreground italic">$1</em>')
                                                    }} />
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup >
    );
}
