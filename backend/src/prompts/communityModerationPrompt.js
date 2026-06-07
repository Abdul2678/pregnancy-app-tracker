// prompts/communityModerationPrompt.js
// Builds prompts for community post moderation and reply suggestions. JSON mode.

function buildCommunityModerationPrompt({ postBody, postTitle = '', language = 'English' } = {}) {
  const system = `You are Bloom's community moderation engine for a global pregnancy support forum.
You assess posts for safety and community guidelines. Flag: medical misinformation,
dangerous advice, harassment, spam, self-harm content, and graphic/triggering content.
Be supportive and err toward keeping genuine peer support visible. For posts hinting at
self-harm, set "action" to "escalate_support". Return ONLY valid JSON — no preamble.`;

  const userPrompt = `Moderate this community post.

Title: "${postTitle}"
Body: "${postBody}"
Language: ${language}

Return exactly:
{
  "action": "approve | review | block | escalate_support",
  "categories": ["any of: misinformation, dangerous_advice, harassment, spam, self_harm, graphic, other"],
  "reason": "short reason in ${language}",
  "toxicityScore": 0.0,
  "supportResourcesNeeded": true | false
}`;

  return { system, user: userPrompt };
}

function buildReplySuggesterPrompt({ postBody, postTitle = '', language = 'English' } = {}) {
  const system = `You are Bloom's empathetic reply suggester for a pregnancy support community.
You draft warm, supportive peer-style replies that a community member could send.
You NEVER give medical diagnoses; gently suggest professional care where relevant.
Return ONLY valid JSON — no preamble. Respond in the user's language.`;

  const userPrompt = `Draft supportive reply suggestions for this post.

Title: "${postTitle}"
Body: "${postBody}"
Language: ${language}

Return exactly:
{
  "suggestions": ["2-3 short, warm reply options in ${language}"],
  "tone": "encouraging | empathetic | informative",
  "flagForModerator": true | false
}`;

  return { system, user: userPrompt };
}

module.exports = { buildCommunityModerationPrompt, buildReplySuggesterPrompt };
