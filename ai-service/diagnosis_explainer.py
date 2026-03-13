"""
Diagnosis Explainer - Generates human-readable explanations for AI predictions.
Uses template-based generation with medical knowledge - no external API keys.
"""

import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DISEASE_INFO_PATH = os.path.join(DATA_DIR, 'disease_info.json')
DISEASE_SYMPTOMS_PATH = os.path.join(DATA_DIR, 'disease_symptoms.json')
SYMPTOMS_PATH = os.path.join(DATA_DIR, 'symptoms.json')


def _load_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if data is not None else default
    except FileNotFoundError:
        return default


DISEASE_INFO = _load_json(DISEASE_INFO_PATH, {})
DISEASE_SYMPTOMS = _load_json(DISEASE_SYMPTOMS_PATH, {})
SYMPTOMS = _load_json(SYMPTOMS_PATH, [])
SYMPTOM_LABELS = {item['id']: item.get('label', item['id']) for item in SYMPTOMS}


def _label_for(symptom_id):
    if not symptom_id:
        return ''
    if symptom_id in SYMPTOM_LABELS:
        return SYMPTOM_LABELS[symptom_id]
    return symptom_id.replace('_', ' ').title()


def generate_explanation(prediction, symptoms, risk_score, confidence, risk_level, explanation_data=None):
    """
    Generate a comprehensive human-readable medical explanation.
    """
    info = DISEASE_INFO.get(prediction, {})

    key_symptom_ids = info.get('key_symptoms') or DISEASE_SYMPTOMS.get(prediction) or symptoms[:4]
    key_symptoms = [_label_for(s) for s in key_symptom_ids]

    description = info.get('description') or f'{prediction} has been identified based on the symptoms provided.'
    action = info.get('action') or 'Please consult a medical professional for proper diagnosis and treatment.'
    severity = (info.get('severity') or 'unknown').upper()
    department = info.get('department') or 'General Medicine'

    risk_percent = round(risk_score * 100)
    conf_percent = round(confidence * 100)

    # Build symptom narrative
    symptom_names = [_label_for(s) for s in symptoms]
    if len(symptom_names) > 2:
        symptom_text = ', '.join(symptom_names[:-1]) + f', and {symptom_names[-1]}'
    elif len(symptom_names) == 2:
        symptom_text = ' and '.join(symptom_names)
    else:
        symptom_text = symptom_names[0] if symptom_names else 'the reported symptoms'

    # Risk context
    if risk_level == 'Emergency':
        risk_context = 'This is classified as an EMERGENCY case requiring immediate medical intervention.'
        urgency = 'IMMEDIATE - do not delay medical care.'
    elif risk_level == 'Urgent':
        risk_context = 'This case is classified as URGENT. Please seek medical attention as soon as possible.'
        urgency = 'Within 1-2 hours.'
    else:
        risk_context = 'This assessment indicates a routine medical case. Schedule a consultation when convenient.'
        urgency = 'Non-urgent - schedule appointment.'

    # Top contributing factors
    factors_text = ''
    if explanation_data:
        top = explanation_data[:5]
        factors_text = '\n\n**Top Contributing Factors:**\n'
        for f in top:
            name = f['feature'].replace('_', ' ').title()
            pct = round(f['importance'] * 100, 1)
            factors_text += f'- {name}: {pct}% contribution\n'

    explanation_text = f"""## Possible Condition: {prediction}

**Severity Level:** {severity}
**Risk Score:** {risk_percent}% | **AI Confidence:** {conf_percent}%
**Department:** {department}

---

### Medical Analysis

{description}

Based on symptoms including **{symptom_text}**, the AI model predicts a {conf_percent}% likelihood of {prediction} with a risk score of {risk_percent}%.

{risk_context}

### Matching Symptoms
Your reported symptoms closely align with the known indicators of {prediction}, which typically include: {', '.join(key_symptoms)}.
{factors_text}
### Recommended Action
{action}

**Time Sensitivity:** {urgency}

---

> This is an AI-assisted preliminary assessment. It is NOT a substitute for professional medical diagnosis. Please consult a qualified healthcare provider."""

    return {
        'explanation_text': explanation_text,
        'condition': prediction,
        'severity': severity,
        'department': department,
        'recommended_action': action,
        'urgency': urgency,
        'risk_context': risk_context,
        'matching_symptoms': key_symptoms
    }
