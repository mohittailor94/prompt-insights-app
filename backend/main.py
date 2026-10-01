from math import ceil
from typing import Annotated, Any
from uuid import UUID, uuid4

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator


SUPPORTED_LANGUAGES = {"en", "de", "fr", "es", "it"}
INVALID_LANGUAGE_MESSAGE = "Target language is not supported"


class PromptRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    prompt: str = Field(min_length=1)
    targetLanguage: str
    contextId: UUID | None = None

    @field_validator("prompt")
    @classmethod
    def trim_prompt(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Prompt is required")
        return value

    @field_validator("targetLanguage")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if value not in SUPPORTED_LANGUAGES:
            raise ValueError(INVALID_LANGUAGE_MESSAGE)
        return value


app = FastAPI(title="Prompt Insights API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def error_response(status: int, error: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": error, "message": message})


def needs_clarification(prompt: str) -> bool:
    return len(prompt) < 5 or prompt.lower().strip("!.?") in {"help", "hello", "hi", "test", "more details"}


def create_insights(prompt: str, target_language: str) -> list[dict[str, Any]]:
    themes = [
        ("Signal detected", "The request has a clear central question that can be broken into a small set of decisions."),
        ("Recommended next step", "Start with the highest-impact action, then validate it against the constraints in your context."),
        ("Risk to watch", "A quick answer may hide an assumption. Make the success measure explicit before committing resources."),
        ("Useful framing", "Compare options by effort, confidence, and reversibility rather than by feature count alone."),
        ("Evidence needed", "Collect one concrete example from the target workflow to test whether this direction holds."),
        ("Decision lens", "Prefer the smallest experiment that can turn uncertainty into a measurable result."),
        ("Audience note", "The strongest version will explain the why, the trade-off, and the action in that order."),
        ("Momentum", "A short written brief will make the next conversation more focused and easier to act on."),
        ("Open question", "Which constraint matters most here: time, quality, cost, or the experience of the person using it?"),
        ("Pattern", "The request connects immediate execution with a longer-term system that can be refined over time."),
        ("Clarity check", "Separate what is known from what is inferred before turning this insight into a commitment."),
        ("Opportunity", "A reusable template could reduce repeated decisions while keeping room for deliberate judgment."),
    ]
    prompt_excerpt = prompt[:72] + ("..." if len(prompt) > 72 else "")
    return [
        {
            "id": f"{target_language}-{index + 1}",
            "title": title,
            "detail": f'{detail} Applied to "{prompt_excerpt}"',
            "confidence": 96 - index * 4,
            "category": ["Strategic", "Action", "Context"][index % 3],
        }
        for index, (title, detail) in enumerate(themes)
    ]


def parse_page(value: str, default: int, minimum: int = 1, maximum: int | None = None) -> int:
    try:
        parsed = int(value)
    except ValueError:
        parsed = default
    parsed = max(minimum, parsed)
    return min(parsed, maximum) if maximum is not None else parsed


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    if any(error.get("type") == "json_invalid" for error in errors):
        return error_response(400, "INVALID_JSON", "Request body must contain valid JSON")
    locations = {str(error.get("loc", [""])[-1]) for error in errors}
    if "targetLanguage" in locations:
        return error_response(400, "INVALID_LANGUAGE", INVALID_LANGUAGE_MESSAGE)
    if "contextId" in locations:
        return error_response(400, "INVALID_CONTEXT_ID", "Context ID must be a valid UUID")
    return error_response(400, "INVALID_REQUEST", "Prompt is required and request fields must be valid")


@app.post("/api/prompts")
async def submit_prompt(payload: PromptRequest) -> dict[str, Any]:
    if needs_clarification(payload.prompt):
        return {"status": "NEEDS_CLARIFICATION", "message": "Please provide more details so the service can return useful insights."}
    context_id = payload.contextId or uuid4()
    insights = create_insights(payload.prompt, payload.targetLanguage)
    return {
        "status": "SUCCESS",
        "contextId": str(context_id),
        "insights": insights,
        "pagination": {"page": 1, "pageSize": 10, "total": len(insights), "totalPages": ceil(len(insights) / 10)},
    }


@app.get("/api/insights", response_model=None)
async def get_insights(
    prompt: Annotated[str | None, Query()] = None,
    target_language: Annotated[str, Query(alias="targetLanguage")] = "en",
    page: str = "1",
    page_size: Annotated[str, Query(alias="pageSize")] = "10",
    search: str = "",
) -> dict[str, Any] | JSONResponse:
    if not prompt:
        return error_response(400, "INVALID_PROMPT", "A prompt is required to load insights")
    if target_language not in SUPPORTED_LANGUAGES:
        return error_response(400, "INVALID_LANGUAGE", INVALID_LANGUAGE_MESSAGE)

    all_insights = create_insights(prompt, target_language)
    search_text = search.lower()
    filtered = [
        insight
        for insight in all_insights
        if search_text in f"{insight['title']} {insight['detail']} {insight['category']}".lower()
    ]
    current_page = parse_page(page, 1)
    size = parse_page(page_size, 10, maximum=20)
    start = (current_page - 1) * size
    return {
        "status": "SUCCESS",
        "insights": filtered[start : start + size],
        "pagination": {
            "page": current_page,
            "pageSize": size,
            "total": len(filtered),
            "totalPages": max(1, ceil(len(filtered) / size)),
        },
    }