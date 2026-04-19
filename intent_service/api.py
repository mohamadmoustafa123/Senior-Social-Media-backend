from fastapi import FastAPI
from pydantic import BaseModel

from predict import predict

app = FastAPI(title="Intent Service")


class IntentRequest(BaseModel):
    text: str


class IntentResponse(BaseModel):
    intent: str
    score: float


@app.post("/intent", response_model=IntentResponse)
def intent_endpoint(payload: IntentRequest) -> IntentResponse:
    intent, score = predict(payload.text)
    return IntentResponse(intent=intent, score=score)


@app.get("/health")
def health() -> dict:
    return {"ok": True}

