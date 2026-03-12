"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Underline } from '@tiptap/extension-underline';
import { Highlight } from '@tiptap/extension-highlight';
import { useEffect, useCallback } from 'react';

const CustomHighlight = Highlight.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            class: {
                default: null,
                parseHTML: element => element.getAttribute('class'),
                renderHTML: attributes => {
                    if (!attributes.class) return {};
                    return { class: attributes.class };
                },
            },
            style: {
                default: null,
                parseHTML: element => element.getAttribute('style'),
                renderHTML: attributes => {
                    if (!attributes.style) return {};
                    return { style: attributes.style };
                }
            },
            id: {
                default: null,
                parseHTML: element => element.getAttribute('id'),
                renderHTML: attributes => {
                    if (!attributes.id) return {};
                    return { id: attributes.id };
                }
            },
            'data-comment': {
                default: null,
                parseHTML: element => element.getAttribute('data-comment'),
                renderHTML: attributes => {
                    if (!attributes['data-comment']) return {};
                    return { 'data-comment': attributes['data-comment'] };
                },
            },
            'data-weakness-id': {
                default: null,
                parseHTML: element => element.getAttribute('data-weakness-id'),
                renderHTML: attributes => {
                    if (!attributes['data-weakness-id']) return {};
                    return { 'data-weakness-id': attributes['data-weakness-id'] };
                }
            },
            'data-weakness-ids': {
                default: null,
                parseHTML: element => element.getAttribute('data-weakness-ids'),
                renderHTML: attributes => {
                    if (!attributes['data-weakness-ids']) return {};
                    return { 'data-weakness-ids': attributes['data-weakness-ids'] };
                }
            },
            'data-is-weakness': {
                default: null,
                parseHTML: element => element.getAttribute('data-is-weakness'),
                renderHTML: attributes => {
                    if (!attributes['data-is-weakness']) return {};
                    return { 'data-is-weakness': attributes['data-is-weakness'] };
                }
            }
        };
    },
});

interface RichTextViewerProps {
    htmlContent: string;
    activeFilterWeaknessId?: string | null;
    onChange: (html: string, text: string) => void;
    onCommentClick?: (comment: string, rect: DOMRect, snippetId?: string, weaknessId?: string, isWeakness?: boolean) => void;
}

export function RichTextViewer({ htmlContent, activeFilterWeaknessId, onChange, onCommentClick }: RichTextViewerProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            Color,
            Underline,
            CustomHighlight,
        ],
        content: htmlContent,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'tiptap max-w-none focus:outline-none min-h-full',
            },
            handleClick: (view, pos, event) => {
                const target = event.target as HTMLElement;
                const mark = target.closest('mark[data-comment]') as HTMLElement | null;
                if (mark && onCommentClick) {
                    const comment = mark.getAttribute('data-comment');
                    if (comment) {
                        const rect = mark.getBoundingClientRect();
                        const snippetId = mark.getAttribute('id') || undefined;
                        const weaknessId = mark.getAttribute('data-weakness-id') || undefined; // from pdf weakness
                        const isWeakness = mark.getAttribute('data-is-weakness') === 'true';

                        // Grab the new data-weakness-ids for draft snippets
                        const weaknessIdsStr = mark.getAttribute('data-weakness-ids');

                        // Pass along the primary weaknessId or the array string if available
                        onCommentClick(comment, rect, snippetId, weaknessId || weaknessIdsStr || undefined, isWeakness);
                        return true;
                    }
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML(), editor.getText());
        },
    });

    // Apply filtering via CSS for performance and robust merging against Tiptap's DOM management
    // We inject a style block below instead of mutating DOM directly.

    // Update content if a new document is uploaded
    useEffect(() => {
        if (editor && htmlContent && htmlContent !== editor.getHTML()) {
            setTimeout(() => {
                editor.commands.setContent(htmlContent);
            }, 0);
        }
    }, [htmlContent, editor]);

    if (!editor) {
        return <div className="h-full w-full animate-pulse bg-muted/20" />;
    }

    return (
        <div className="border rounded-md p-4 bg-muted/10 overflow-y-auto flex-1 h-full shadow-inner ring-offset-background focus-within:ring-1 focus-within:ring-ring">
            {activeFilterWeaknessId && (
                <style>{`
                    .tiptap mark { opacity: 0.2 !important; transition: opacity 0.2s; }
                    .tiptap mark[data-weakness-id="${activeFilterWeaknessId}"] { opacity: 1 !important; }
                    .tiptap mark[data-weakness-ids*='"${activeFilterWeaknessId}"'] { opacity: 1 !important; }
                `}</style>
            )}
            <EditorContent editor={editor} className="h-full w-full" />
        </div>
    );
}
