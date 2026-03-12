/**
 * Test script for the feedback parser.
 * Run with: npx tsx test/test-parser.ts
 */
import * as fs from "fs";
import * as path from "path";
import { parseWeaknessesFromFeedback } from "../lib/agents/feedback-analyzer";

const feedbackText = fs.readFileSync(path.join(__dirname, "synthetic_feedback.txt"), "utf-8");
const documentText = fs.readFileSync(path.join(__dirname, "synthetic_document.txt"), "utf-8");

console.log("=== Parsing Feedback ===\n");
const weaknesses = parseWeaknessesFromFeedback(feedbackText);

console.log(`Total weaknesses extracted: ${weaknesses.length}\n`);

weaknesses.forEach((w, i) => {
    console.log(`--- Weakness ${i + 1} ---`);
    console.log(`  Area:     ${w.area}`);
    console.log(`  Critique: ${w.critique}`);
    console.log(`  Text:     ${w.weakness.substring(0, 120)}${w.weakness.length > 120 ? '...' : ''}`);
    console.log();
});

// Verify expectations
const expectedAreas = ["Significance", "Investigator", "Innovation", "Approach"];
const foundAreas = [...new Set(weaknesses.map(w => w.area))];
console.log(`=== Verification ===`);
console.log(`Expected areas: ${expectedAreas.join(", ")}`);
console.log(`Found areas:    ${foundAreas.join(", ")}`);

const reviewer1 = weaknesses.filter(w => w.critique.includes("1"));
const reviewer2 = weaknesses.filter(w => w.critique.includes("2"));
console.log(`\nReviewer 1 weaknesses: ${reviewer1.length}`);
console.log(`Reviewer 2 weaknesses: ${reviewer2.length}`);

if (weaknesses.length >= 10) {
    console.log("\n✅ PASS: Extracted a reasonable number of weaknesses (>= 10).");
} else {
    console.log(`\n❌ FAIL: Only extracted ${weaknesses.length} weaknesses; expected >= 10.`);
}
