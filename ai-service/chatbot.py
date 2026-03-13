"""
Lightweight precaution chatbot - rule-based responses.
No external API keys required.
"""

import json
import os

import symptom_interpreter

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
DISEASE_INFO_PATH = os.path.join(DATA_DIR, 'disease_info.json')
DISEASE_SYMPTOMS_PATH = os.path.join(DATA_DIR, 'disease_symptoms.json')
SYMPTOMS_PATH = os.path.join(DATA_DIR, 'symptoms.json')
PRECAUTIONS_PATH = os.path.join(DATA_DIR, 'symptom_precautions.json')


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
PRECAUTIONS = _load_json(PRECAUTIONS_PATH, {})


def _label_for(symptom_id):
    if symptom_id in SYMPTOM_LABELS:
        return SYMPTOM_LABELS[symptom_id]
    return symptom_id.replace('_', ' ').title()


def _match_disease_from_text(message):
    text = message.lower()
    for disease in DISEASE_INFO.keys():
        if disease.lower() in text:
            return disease
    return None


def _match_disease_from_symptoms(symptoms):
    if not symptoms:
        return None
    symptoms_set = set(symptoms)
    best = None
    best_score = 0
    for disease, disease_symptoms in DISEASE_SYMPTOMS.items():
        overlap = len(symptoms_set.intersection(disease_symptoms))
        if overlap > best_score:
            best_score = overlap
            best = disease
    return best if best_score >= 2 else None


def _collect_precautions(symptoms):
    precautions = []
    for symptom_id in symptoms:
        for item in PRECAUTIONS.get(symptom_id, []):
            if item not in precautions:
                precautions.append(item)
    return precautions


def build_chatbot_response(message):
    text = (message or '').strip()
    if not text:
        return {
            'reply': 'Tell me your symptoms or condition so I can suggest precautions.',
            'precautions': [],
            'suggestions': [],
            'matched': {'symptoms': [], 'disease': None},
            'disclaimer': 'This is general guidance, not a medical diagnosis.'
        }

    interpret = symptom_interpreter.interpret_symptoms(text)
    recognized = interpret.get('symptoms', [])
    matched_disease = _match_disease_from_text(text) or _match_disease_from_symptoms(recognized)

    precautions = _collect_precautions(recognized)
    if not precautions:
        precautions = [
            'Rest, stay hydrated, and monitor symptoms.',
            'Seek medical care if symptoms worsen or do not improve.'
        ]

    suggestions = []
    info = DISEASE_INFO.get(matched_disease, {})
    if matched_disease:
        severity = (info.get('severity') or 'unknown').lower()
        department = info.get('department') or 'General Medicine'
        action = info.get('action') or 'Consult a medical professional for guidance.'
        suggestions.append(f'Possible condition mentioned: {matched_disease}.')
        suggestions.append(f'Department: {department}.')
        suggestions.append(f'Recommended action: {action}.')
        if severity in ['high', 'critical']:
            suggestions.append('This may be urgent. Please seek medical care promptly.')

    matched_labels = [_label_for(s) for s in recognized]

    return {
        'reply': 'Here are precautions and suggestions based on your message.',
        'precautions': precautions,
        'suggestions': suggestions,
        'matched': {'symptoms': matched_labels, 'disease': matched_disease},
        'disclaimer': 'This is general guidance and not a substitute for professional medical advice.'
    }
