const path = require('node:path');
const express = require('express');
const cors = require('cors');
const { z } = require('zod');
const { randomUUID } = require('node:crypto');

const app = express();
const port = process.env.PORT || 3001;
const supportedLanguages = new Set(['en', 'de', 'fr', 'es', 'it']);
const requestSchema = z.object({
  prompt: z.string().trim().min(1),
  targetLanguage: z.string().refine((language) => supportedLanguages.has(language)),
  contextId: z.guid().optional(),
}).strict();

app.disable('x-powered-by');
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

function errorResponse(res, status, error, message) {
  return res.status(status).json({ error, message });
}

function needsClarification(prompt) {
  return prompt.length < 5 || /^(help|hello|hi|test|more details)[!.?]*$/i.test(prompt);
}

function createInsights(prompt, targetLanguage) {
  const themes = [
    ['Signal detected', 'The request has a clear central question that can be broken into a small set of decisions.'],
    ['Recommended next step', 'Start with the highest-impact action, then validate it against the constraints in your context.'],
    ['Risk to watch', 'A quick answer may hide an assumption. Make the success measure explicit before committing resources.'],
    ['Useful framing', 'Compare options by effort, confidence, and reversibility rather than by feature count alone.'],
    ['Evidence needed', 'Collect one concrete example from the target workflow to test whether this direction holds.'],
    ['Decision lens', 'Prefer the smallest experiment that can turn uncertainty into a measurable result.'],
    ['Audience note', 'The strongest version will explain the why, the trade-off, and the action in that order.'],
    ['Momentum', 'A short written brief will make the next conversation more focused and easier to act on.'],
    ['Open question', 'Which constraint matters most here: time, quality, cost, or the experience of the person using it?'],
    ['Pattern', 'The request connects immediate execution with a longer-term system that can be refined over time.'],
    ['Clarity check', 'Separate what is known from what is inferred before turning this insight into a commitment.'],
    ['Opportunity', 'A reusable template could reduce repeated decisions while keeping room for deliberate judgment.'],
  ];

  return themes.map(([title, detail], index) => ({
    id: `${targetLanguage}-${index + 1}`,
    title,
    detail: `${detail} Applied to “${prompt.slice(0, 72)}${prompt.length > 72 ? '…' : ''}”`,
    confidence: 96 - index * 4,
    category: ['Strategic', 'Action', 'Context'][index % 3],
  }));
}

app.post('/api/prompts', (req, res) => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (issue?.path[0] === 'targetLanguage') return errorResponse(res, 400, 'INVALID_LANGUAGE', 'Target language is not supported');
    if (issue?.path[0] === 'contextId') return errorResponse(res, 400, 'INVALID_CONTEXT_ID', 'Context ID must be a valid UUID');
    return errorResponse(res, 400, 'INVALID_REQUEST', 'Prompt is required and request fields must be valid');
  }

  const { prompt, targetLanguage, contextId } = parsed.data;
  if (needsClarification(prompt)) return res.json({ status: 'NEEDS_CLARIFICATION', message: 'Please provide more details so the service can return useful insights.' });

  const newContextId = contextId || randomUUID();
  const insights = createInsights(prompt.trim(), targetLanguage);
  return res.json({ status: 'SUCCESS', contextId: newContextId, insights, pagination: { page: 1, pageSize: 10, total: insights.length, totalPages: Math.ceil(insights.length / 10) } });
});

app.get('/api/insights', (req, res) => {
  const { prompt, targetLanguage = 'en', page = '1', pageSize = '10', search = '' } = req.query;
  if (!prompt || typeof prompt !== 'string') return errorResponse(res, 400, 'INVALID_PROMPT', 'A prompt is required to load insights');
  if (!supportedLanguages.has(targetLanguage)) return errorResponse(res, 400, 'INVALID_LANGUAGE', 'Target language is not supported');

  const allInsights = createInsights(prompt, targetLanguage);
  const filtered = allInsights.filter((insight) => `${insight.title} ${insight.detail} ${insight.category}`.toLowerCase().includes(String(search).toLowerCase()));
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const size = Math.min(20, Math.max(1, Number.parseInt(pageSize, 10) || 10));
  const start = (currentPage - 1) * size;
  return res.json({ status: 'SUCCESS', insights: filtered.slice(start, start + size), pagination: { page: currentPage, pageSize: size, total: filtered.length, totalPages: Math.max(1, Math.ceil(filtered.length / size)) } });
});

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') return errorResponse(res, 400, 'INVALID_JSON', 'Request body must contain valid JSON');
  return next(error);
});

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

app.listen(port, () => console.log(`API ready at http://localhost:${port}`));