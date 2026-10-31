import { expect, it } from "vitest";
import { stripVoaEmailCallsToAction } from "@/scripts/lib/passage-filter";

it("removes email calls to action without splitting email addresses or removing neighboring sentences", () => {
 const body = "Keep this sentence. Send us an email at learningenglish@voanews.com. Keep this too!\n\nEmail us with questions! Write to us today.\n\nSend us an e-mail. E-mail us! Contact learningenglish@voanews.com for help.\n\nThe lesson ends here.";
 expect(stripVoaEmailCallsToAction(body)).toBe("Keep this sentence. Keep this too!\n\nThe lesson ends here.");
});

it("preserves reader letters and unrelated text and is idempotent", () => {
 const body = "Dear VOA Learning English,\n\nI am sending this email to learn about sewing.\n\n‘Email’ is a noun.\n\nDear VOA Learning English, please explain ‘write to us’.";
 expect(stripVoaEmailCallsToAction(body)).toBe(body);
 const filtered = stripVoaEmailCallsToAction(`${body}\n\nWRITE TO US at learningenglish@voanews.com.`);
 expect(filtered).toBe(body);
 expect(stripVoaEmailCallsToAction(filtered)).toBe(filtered);
});
