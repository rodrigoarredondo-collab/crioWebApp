import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { z } from "zod";

export interface ParsedWeakness {
    id: string;
    area: string;
    critique: string;
    weakness: string;
}

export interface MappedHighlight {
    weakness: ParsedWeakness;
    reasoning?: string;
    snippets: {
        textSnippet: string;
        comment: string;
    }[];
}

/**
 * Programmatically extracts weaknesses from the reviewer feedback text.
 * Expects a structured layout with headers like "Significance", "Investigators", etc.
 * and bullet points or numbered lists containing the weaknesses.
 */
export function parseWeaknessesFromFeedback(text: string): ParsedWeakness[] {
    const weaknesses: ParsedWeakness[] = [];

    // Normalize line endings (PDF text often has \r\n or mixed)
    const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedText.split('\n');

    let currentArea = "General";
    let currentCritique = "Reviewer";
    let inWeaknessSection = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Skip page break headers (e.g., "1R41CA310266-013ZRG1 BBBT-F (10)")
        if (line.match(/^\d+R\d+[A-Z]/)) continue;
        // Skip applicant name lines (e.g., "GARCIAMENDEZ, C")
        if (line.match(/^[A-Z]+,\s+[A-Z]\s*$/)) continue;

        // Stop processing at administrative/footer sections
        if (line.match(/^(Protections?\s+for|Vertebrate\s+Animals|Biohazards|Resource\s+Sharing|Authentication\s+of|Budget\s+and|Footnotes|MEETING\s+ROSTER)/i)) {
            inWeaknessSection = false;
            continue;
        }

        // Match Reviewer/Critique headers: "CRITIQUE 1", "Reviewer 2", "Critique #3", etc.
        const critiqueMatch = line.match(/^(Reviewer|Critique)\s*#?\s*(\d+)\s*:?$/i);
        if (critiqueMatch) {
            currentCritique = `Critique ${critiqueMatch[2]}`;
            inWeaknessSection = false;
            continue;
        }

        // Match "Weaknesses" or "Weakness:" or "Concerns:" subheader (colon optional)
        const weaknessHeaderMatch = line.match(/^(Weakness(?:es)?|Concerns?)\s*:?\s*(.*)/i);
        if (weaknessHeaderMatch && line.length < 40) {
            inWeaknessSection = true;
            const remainder = weaknessHeaderMatch[2].trim();
            if (remainder) {
                weaknesses.push({
                    id: `weakness-${currentCritique.replace(/\s+/g, '-').toLowerCase()}-${currentArea.replace(/[^a-z0-9]/gi, '').toLowerCase()}-${weaknesses.length}`,
                    area: currentArea,
                    critique: currentCritique,
                    weakness: remainder
                });
            }
            continue;
        }

        // Match "Strengths" header (colon optional) — exit weakness section
        if (line.match(/^(Strengths?|Score|Overall\s+Impact)\s*:?/i)) {
            inWeaknessSection = false;
            continue;
        }

        // Skip non-content lines (e.g., section score lines like "Significance: 6")
        if (line.match(/^(Significance|Investigator|Innovation|Approach|Environment)\s*:\s*\d+$/i)) {
            continue;
        }

        // Match Area/Section headers: "1. Significance", "Significance:", "2. Investigator(s)", etc.
        const sectionMatch = line.match(/^(?:(\d+)\.\s+)?([A-Z][A-Za-z\s()\/]+?)\s*:?\s*$/i);
        if (sectionMatch && line.length > 3 && line.length < 60) {
            const isNumbered = !!sectionMatch[1]; // e.g. "2. Innovation"
            // Numbered sections always reset context; non-numbered only when not in weakness section
            if (isNumbered || !inWeaknessSection) {
                const potentialArea = sectionMatch[2].trim();
                if (!potentialArea.includes('.') && potentialArea.split(/\s+/).length <= 5) {
                    currentArea = potentialArea;
                    inWeaknessSection = false;
                    continue;
                }
            }
        }

        // If we are inside a "Weaknesses" section, grab bullet points / line content
        if (inWeaknessSection) {
            // Match bullets: •, -, *, or lines that are clearly content
            const bulletMatch = line.match(/^[•\-*]\s*(.+)/);
            if (bulletMatch) {
                weaknesses.push({
                    id: `weakness-${currentCritique.replace(/\s+/g, '-').toLowerCase()}-${currentArea.replace(/[^a-z0-9]/gi, '').toLowerCase()}-${weaknesses.length}`,
                    area: currentArea,
                    critique: currentCritique,
                    weakness: bulletMatch[1].trim()
                });
            } else if (line.match(/^None\s*noted/i)) {
                // Skip "None noted" entries
                inWeaknessSection = false;
            } else if (weaknesses.length > 0) {
                // Continuation of the previous weakness (multiline paragraph)
                weaknesses[weaknesses.length - 1].weakness += " " + line;
            }
        }
    }

    // Fallback: If no weaknesses found through structured parsing, scan the whole text
    if (weaknesses.length === 0) {
        console.log("[Parser] Structured parsing found no weaknesses, falling back to keyword scan...");
        let currentText = "";
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.match(/weakness|concern|issue|limitation|unclear|insufficient|lack/i)) {
                currentText += trimmed + " ";
            } else if (currentText && trimmed === "") {
                weaknesses.push({
                    id: `weakness-fallback-${weaknesses.length}`,
                    area: "General",
                    critique: "Unknown",
                    weakness: currentText.trim()
                });
                currentText = "";
            }
        }
        if (currentText) {
            weaknesses.push({
                id: `weakness-fallback-${weaknesses.length}`,
                area: "General",
                critique: "Unknown",
                weakness: currentText.trim()
            });
        }
    }

    // Post-processing: filter out garbage entries
    const filtered = weaknesses.filter(w => {
        const text = w.weakness.toLowerCase();
        // Remove "None noted" entries
        if (text.match(/^none\s*noted/i)) return false;
        // Remove entries that are just administrative boilerplate
        if (text.match(/^not\s+(found|applicable)/i)) return false;
        // Remove very short non-meaningful entries
        if (w.weakness.length < 10) return false;
        return true;
    });

    return filtered;
}

/**
 * Maps a single weakness to a verbatim text snippet in the Word document.
 */
async function mapWeaknessToDocument(
    weakness: ParsedWeakness,
    wordContent: string
): Promise<MappedHighlight> {
    const llm = new ChatOpenAI({
        modelName: "meta/llama-3.1-405b-instruct",
        temperature: 0.1,
        maxTokens: 500,
        apiKey: process.env.NVIDIA_API_KEY || "dummy",
        configuration: {
            baseURL: "https://integrate.api.nvidia.com/v1",
        },
    });

    const schema = z.object({
        reasoning: z.string().describe("Analyze the weakness Area. What section(s) of the draft are appropriate places to address this? Then analyze the feedback. Does it refer to something currently in the text, or something MISSING? Explain step-by-step where the best specific sentence to anchor this feedback would be based on the provided draft. DO NOT select broad headers."),
        snippets: z.array(z.object({
            textSnippet: z.string().describe("The EXACT VERBATIM text from the document to highlight. Must be a unique substring of the document."),
            comment: z.string().describe("Explanation of why this snippet relates to the weakness and how it should be addressed.")
        })).min(1).describe("An array of snippets to highlight for this weakness. YOU MUST RETURN AT LEAST ONE SNIPPET.")
    });

    const structuredLlm = llm.withStructuredOutput(schema, { name: "highlight_mapping" });

    const promptMessage =
        `You are assisting a researcher in addressing reviewer critiques on their grant proposal or manuscript.\n\n` +
        `Here is a specific weakness identified by a reviewer:\n` +
        `Area: ${weakness.area}\n` +
        `Reviewer/Critique: ${weakness.critique}\n` +
        `Weakness: "${weakness.weakness}"\n\n` +
        `Your task is to scan the provided Word Document content and find the CONTEXTUAL location(s) where this weakness applies. First, use the "reasoning" output field to think through your strategy.\n\n` +
        `HOW TO MATCH THE CORRECT SECTION:\n` +
        `The weakness has an "Area" (e.g., Significance, Innovation, Approach, Investigators). You MUST anchor your snippet inside an appropriate section of the draft that logically matches this specific Area or topic. For example, a weakness about team members is probably not a good fit in the "Significance" section, but belongs in "Investigators" or "Approach". There may be more than one appropriate place, you must find all the correctly matching ones.\n\n` +
        `HOW TO HANDLE MISSING CONCEPTS (e.g., "commercial relevance", "missing data"):\n` +
        `If the weakness refers to something that is MISSING, do not just select a random place. Use your reasoning to determine the BEST LOGICAL PLACE within a relevant Area to insert this new information. Often this is at the end of a specific related paragraph, the conclusion of an Aim, or right after a closely related claim.\n\n` +
        `CRITICAL HIGHLIGHTING RULES:\n` +
        `1. MANDATORY: You MUST return AT LEAST ONE snippet. DO NOT return an empty array. You must find the most logical place even if it is not a perfect match.\n` +
        `2. BAN ON HEADERS: DO NOT select broad section headings (e.g., "B INNOVATION", "C5 Timeline", "Aim 1"). This is strictly forbidden. You MUST select a specific, meaningful sentence or group of words from the body paragraphs where the correction should actually happen.\n` +
        `3. EXACT MATCH: The textSnippet you return MUST BE AN EXACT VERBATIM SUBSTRING of the Word Document content. Do not guess or paraphrase.\n` +
        `4. LENGTH: Use as few words as necessary to uniquely identify the targeted spot without selecting whole paragraphs. Usually 5-15 words is best.\n\n` +
        `Word Document Content:\n` +
        `---------------------\n` +
        `${wordContent}\n` +
        `---------------------\n`;

    try {
        const result = await structuredLlm.invoke([new SystemMessage(promptMessage)]);
        console.log(`[Analyzer] Reasoning for "${weakness.area}":`, result.reasoning);
        return {
            weakness,
            reasoning: result.reasoning,
            snippets: result.snippets || []
        };
    } catch (error) {
        console.error("Failed to map weakness:", error);
        return { weakness, snippets: [] };
    }
}

/**
 * Orchestrates the parallel analysis of all extracted weaknesses against the Word document.
 */
export async function runParallelAnalysis(pdfContent: string, wordContent: string): Promise<MappedHighlight[]> {
    console.log("[Analyzer] Parsing weaknesses from PDF feedback...");
    const weaknesses = parseWeaknessesFromFeedback(pdfContent);
    console.log(`[Analyzer] Extracted ${weaknesses.length} weaknesses.`);

    console.log(`[Analyzer] Spawning ${weaknesses.length} parallel LLM analysis tasks...`);
    const mappingTasks = weaknesses.map(w => mapWeaknessToDocument(w, wordContent));

    // Run all analysis tasks simultaneously
    const results = await Promise.all(mappingTasks);

    // Ensure every weakness has at least one snippet guarantees it is linked.
    const mappingsWithFallbacks = results.map(r => {
        if (!r.snippets || r.snippets.length === 0) {
            // Provide a fallback to the first few words of the document if LLM failed to match
            const firstWordsMatch = wordContent.match(/^\s*(\S+(?:\s+\S+){0,14})/);
            const fallbackText = firstWordsMatch ? firstWordsMatch[1] : wordContent.substring(0, 50).trim();
            r.snippets = [{
                textSnippet: fallbackText,
                comment: "Automated Note: The AI couldn't find an exact verbatim match for this weakness in the text, so it was linked to the beginning of the document."
            }];
        }
        return r;
    });

    console.log(`[Analyzer] Successfully mapped ${mappingsWithFallbacks.length} out of ${weaknesses.length} weaknesses to verbatim text snippets (with fallbacks applied if necessary).`);

    return mappingsWithFallbacks;
}
