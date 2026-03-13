from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from contextlib import asynccontextmanager
import model as disease_model
import symptom_interpreter
import diagnosis_explainer
import chatbot


@asynccontextmanager
async def lifespan(app):
    # Startup: load/train ML model
    print("Loading ML model...")
    disease_model.load_model()
    print("ML model loaded successfully!")
    yield
    # Shutdown
    print("AI service shutting down.")


app = FastAPI(title="Rural Health AI Diagnostic Engine", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Request/Response Models ===

class PredictionRequest(BaseModel):
    symptoms: List[str]
    heart_rate: float = 75
    bp_systolic: float = 120
    bp_diastolic: float = 80
    temperature: float = 37.0
    spo2: float = 97
    age: int = 30

class PredictionResponse(BaseModel):
    prediction: str
    confidence: float
    risk_score: float
    risk_level: str
    explanation: list
    all_probabilities: dict

class InterpretRequest(BaseModel):
    text: str
    language: str = "en"

class ExplainRequest(BaseModel):
    prediction: str
    symptoms: List[str]
    risk_score: float
    confidence: float = 0.9
    risk_level: str = "Emergency"
    explanation_data: Optional[list] = None

class AutocompleteRequest(BaseModel):
    text: str

class ChatbotRequest(BaseModel):
    message: str


# === Endpoints ===

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "AI Diagnostic Engine v2.0", "model": "RandomForest"}

@app.get("/symptoms")
async def get_symptoms():
    return {"symptoms": disease_model.SYMPTOMS_LIST}


@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    result = disease_model.predict(
        symptoms=request.symptoms,
        heart_rate=request.heart_rate,
        bp_systolic=request.bp_systolic,
        bp_diastolic=request.bp_diastolic,
        temperature=request.temperature,
        spo2=request.spo2,
        age=request.age
    )
    return result


@app.post("/ai/interpretSymptoms")
async def interpret_symptoms(request: InterpretRequest):
    """
    Convert free-text symptom description to structured symptom codes.
    Supports English and basic Hindi terms.
    """
    result = symptom_interpreter.interpret_symptoms(request.text)
    return result


@app.post("/ai/explainDiagnosis")
async def explain_diagnosis(request: ExplainRequest):
    """
    Generate human-readable medical explanation for AI prediction.
    """
    result = diagnosis_explainer.generate_explanation(
        prediction=request.prediction,
        symptoms=request.symptoms,
        risk_score=request.risk_score,
        confidence=request.confidence,
        risk_level=request.risk_level,
        explanation_data=request.explanation_data
    )
    return result


@app.post("/ai/autocomplete")
async def autocomplete(request: AutocompleteRequest):
    """
    Smart symptom autocomplete - returns matching suggestions for partial text.
    """
    suggestions = symptom_interpreter.autocomplete_symptoms(request.text)
    return {"suggestions": suggestions}


@app.post("/ai/chatbot")
async def precaution_chatbot(request: ChatbotRequest):
    """
    Precaution chatbot - returns general precautions and suggestions.
    """
    return chatbot.build_chatbot_response(request.message)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
