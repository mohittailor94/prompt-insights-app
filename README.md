# Signal / AI Insights Workbench

A React client and FastAPI API for submitting prompts, handling clarification states, and displaying paginated AI-style insights from local mock data.

## Getting Started

Install dependencies:

```bash
npm install
```

Install the Python backend dependencies:

```bash
python -m pip install -r backend/requirements.txt
```

Start the frontend and backend together:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

Create a production build:

```bash
npm run build
```

Run the API server directly:

```bash
npm start
```

The FastAPI server listens on port `3001`. Vite proxies `/api` requests from port `5173` to the API during development.

## Architecture

```text
frontend/
  index.html
  src/
  App.jsx                    Application state and workflow orchestration
  components/
    PromptForm.jsx           Prompt form and submit state
    ResultsPanel.jsx         Search, pagination, loading, and result states
    InsightCard.jsx          Memoized insight item
    ApiError.jsx              Structured API error presentation
  services/
    api.js                   RTK Query API and cache configuration
    validation/
      promptSchema.js        Shared Zod validation contract
backend/
  main.py                    FastAPI API and mock insight source
  requirements.txt           Python backend dependencies
```

## Frontend Behavior

- Prompt submission uses a real HTML form and Zod schema validation.
- The prompt and target language are validated before any API call.
- RTK Query manages request, loading, error, caching, and pagination states.
- Search is debounced by 350 ms.
- Pagination and search parameters are part of the RTK Query cache key.
- `PromptForm`, `ResultsPanel`, and `InsightCard` are memoized where useful.
- Stable query arguments and callbacks reduce unnecessary child renders.
- Cached query results remain available for five minutes after becoming unused.

## API Contract

### Submit a prompt

```http
POST /api/prompts
Content-Type: application/json
```

Request:

```json
{
  "prompt": "How should we improve onboarding?",
  "targetLanguage": "en",
  "contextId": "optional-uuid"
}
```

Successful response:

```json
{
  "status": "SUCCESS",
  "contextId": "uuid",
  "insights": [],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 12,
    "totalPages": 2
  }
}
```

Short or vague prompts are stopped before insight generation:

```json
{
  "status": "NEEDS_CLARIFICATION",
  "message": "Please provide more details so the service can return useful insights."
}
```

Structured validation errors use HTTP `400`:

```json
{
  "error": "INVALID_LANGUAGE",
  "message": "Target language is not supported"
}
```

The API also rejects malformed JSON, invalid UUIDs, missing fields, empty prompts, unsupported languages, and unknown request fields.

### Load paginated insights

```http
GET /api/insights?prompt=How%20should%20we%20improve%20onboarding%3F&targetLanguage=en&page=1&pageSize=10&search=signal
```

Supported languages are `en`, `de`, `fr`, `es`, and `it`.

## Technology

- React
- Redux Toolkit and RTK Query
- Zod
- FastAPI
- Vite
- Lucide React