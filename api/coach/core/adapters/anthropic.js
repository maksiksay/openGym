/* Anthropic Messages API. */
import { httpAdapter } from './http.js';
import { SYSTEM_PROMPT } from '../system-prompt.js';

export const ANTHROPIC_VERSION = '2023-06-01';
// The one exception to "no tools": a food lookup may be given Anthropic's own web search, and
// so may a consultation when the owner allows it (docs/dev/COACH_WEB.md), with a note of its own.
export const FOOD_WEB_NOTE = ' For this task only, a web search tool is available: use it solely to look up the food named in the payload.';

export const anthropicSpec = {
  id: 'anthropic',
  path: () => '/v1/messages',
  modelsPath: '/v1/models',
  headers: key => ({
    'x-api-key': key,
    'anthropic-version': ANTHROPIC_VERSION,
    // Required for a call made from a browser context. Harmless from a server, and the phone's
    // native HTTP path does not need it either — it is here so a plain-browser dev run works.
    'anthropic-dangerous-direct-browser-access': 'true'
  }),
  // The rules block is marked cacheable: identical for every job of a task, so subsequent
  // jobs read it from Anthropic's prompt cache at a tenth of the input price.
  body: ({ model, prompt, system, tools, webNote, maxTokens }) => ({
    model,
    max_tokens: maxTokens,
    system: system
      ? [{ type: 'text', text: SYSTEM_PROMPT + (Array.isArray(tools) && tools.length ? (webNote ? ' ' + String(webNote).trim() : FOOD_WEB_NOTE) : '') + '\n\n' + system, cache_control: { type: 'ephemeral' } }]
      : SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
    // Server tools only (web search, run by Anthropic): the model gets no tool of ours to call.
    ...(Array.isArray(tools) && tools.length ? { tools } : {})
  }),
  errorMessage: data => data && data.error && data.error.message,
  readText: data => {
    // A long server-tool turn can pause before the answer; the food lookup then asks again
    // without the tool rather than reading half a turn.
    if (data.stop_reason === 'pause_turn') return { error: 'pause_turn: the web_search turn did not finish' };
    if (data.stop_reason === 'refusal') return { error: 'the model declined this request' + (data.stop_details && data.stop_details.explanation ? ': ' + data.stop_details.explanation : '') };
    // A web search turn interleaves search blocks with text; the answer is the text after the
    // last search, so with tools only that is read — the earlier text is the model thinking aloud.
    const blocks = data.content || [];
    const lastTool = blocks.map(b => b && b.type).lastIndexOf('web_search_tool_result');
    const text = blocks.slice(lastTool + 1).filter(b => b && b.type === 'text').map(b => b.text).join('');
    return { text, truncated: data.stop_reason === 'max_tokens' };
  },
  readModels: data => (data.data || []).map(m => m.id)
};

export default httpAdapter(anthropicSpec);
