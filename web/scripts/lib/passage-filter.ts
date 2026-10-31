const emailCallToAction = /\b(send us an e-?mail|e-?mail us|write to us|learningenglish@voanews\.com)\b/i;

/** Remove email invitations sentence by sentence, preserving reader letter greetings. */
export function stripVoaEmailCallsToAction(body: string): string {
 if (!emailCallToAction.test(body)) return body;
 return body.split("\n").map(line => {
  if (/^\s*Dear VOA Learning English\b/i.test(line) || !emailCallToAction.test(line)) return line;
  // A boundary needs whitespace, so the periods inside email addresses stay intact.
  return line.split(/(?<=[.!?]["”’']?)\s+/).filter(sentence => !emailCallToAction.test(sentence)).join(" ");
 }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
