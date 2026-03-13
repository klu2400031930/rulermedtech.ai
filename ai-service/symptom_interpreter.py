"""
Symptom Interpreter - Local NLP engine for free-text symptom understanding.
Uses synonym mapping, fuzzy matching, and medical terminology normalization.
No external API keys required.
"""

import json
import os
from difflib import SequenceMatcher

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SYMPTOMS_PATH = os.path.join(DATA_DIR, 'symptoms.json')


def _load_symptoms():
    try:
        with open(SYMPTOMS_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []


SYMPTOMS = _load_symptoms()
SYMPTOM_LABELS = {item['id']: item.get('label', item['id']) for item in SYMPTOMS}

# Extra synonyms for common phrases (kept small and explicit)
EXTRA_SYNONYMS = {
    'fever': ['bukhar', 'temperature', 'high temperature', 'feeling hot'],
    'high_fever': ['very high fever', 'burning up'],
    'cough': ['coughing', 'khansi', 'hack'],
    'shortness_of_breath': ['breathlessness', 'cant breathe', 'hard to breathe', 'difficulty breathing', 'saans nahi aa rahi'],
    'chest_pain': ['chest ache', 'heart pain', 'sternum pain', 'pain in chest'],
    'headache': ['head ache', 'sir dard', 'head pain'],
    'dizziness': ['dizzy', 'light headed', 'vertigo', 'chakkar'],
    'nausea': ['nauseous', 'feel sick', 'want to vomit', 'ji machlana'],
    'fatigue': ['tired', 'tiredness', 'exhausted', 'no energy', 'thakan', 'kamzori'],
    'sore_throat': ['throat pain', 'scratchy throat', 'gala dard'],
    'runny_nose': ['running nose', 'nasal drip', 'stuffy nose', 'naak behna'],
    'abdominal_pain': ['stomach pain', 'tummy ache', 'belly pain', 'pet dard', 'cramps'],
    'blurred_vision': ['blurry vision', 'cant see clearly', 'double vision', 'dhundla dikhna'],
    'rapid_heartbeat': ['fast heartbeat', 'heart racing', 'palpitations', 'tachycardia'],
    'vomiting': ['vomit', 'throwing up', 'puking', 'ulti'],
    'skin_rash': ['rash', 'skin eruption', 'red spots', 'allergic rash'],
    'joint_pain': ['joint ache', 'joints hurt', 'arthritis', 'jodo mein dard'],
    'heart_palpitations': ['palpitation', 'palpitations'],
    'watery_eyes': ['eyes watering'],
    'swelling_throat': ['throat swelling'],
    'swelling_face': ['face swelling'],
    'swelling_tongue': ['tongue swelling']
}


def _normalize(text):
    return text.lower().strip()


def _build_reverse_map():
    reverse = {}
    for item in SYMPTOMS:
        symptom_id = item['id']
        label = item.get('label', symptom_id)
        aliases = {
            symptom_id,
            symptom_id.replace('_', ' '),
            label
        }
        for alias in aliases:
            reverse[_normalize(alias)] = symptom_id

    for symptom_id, aliases in EXTRA_SYNONYMS.items():
        for alias in aliases:
            reverse[_normalize(alias)] = symptom_id
    return reverse


_REVERSE_MAP = _build_reverse_map()


def fuzzy_match(text, threshold=0.65):
    """Find best matching symptom using fuzzy string matching"""
    text = text.lower().strip()
    best_match = None
    best_score = 0

    for alias, symptom in _REVERSE_MAP.items():
        score = SequenceMatcher(None, text, alias).ratio()
        if score > best_score and score >= threshold:
            best_score = score
            best_match = symptom

    return best_match, best_score


def interpret_symptoms(text):
    """
    Interpret free-text symptom description and extract normalized symptoms.
    Returns list of recognized symptom codes and metadata.
    """
    text = text.lower().strip()
    recognized = []
    unrecognized = []

    # First: try direct/exact matches
    for alias, symptom in sorted(_REVERSE_MAP.items(), key=lambda x: -len(x[0])):
        if alias in text:
            if symptom not in [r['code'] for r in recognized]:
                recognized.append({
                    'code': symptom,
                    'matched_text': alias,
                    'confidence': 1.0,
                    'method': 'exact'
                })
            text = text.replace(alias, ' ')

    # Second: split remaining text into phrases and try fuzzy matching
    remaining = [w.strip() for w in text.replace(',', ' ').replace('and', ' ').split() if len(w.strip()) > 2]

    # Try 2-word and 3-word combinations
    words = remaining
    i = 0
    while i < len(words):
        matched = False
        for window in [3, 2, 1]:
            if i + window <= len(words):
                phrase = ' '.join(words[i:i + window])
                match, score = fuzzy_match(phrase)
                if match and match not in [r['code'] for r in recognized]:
                    recognized.append({
                        'code': match,
                        'matched_text': phrase,
                        'confidence': round(score, 2),
                        'method': 'fuzzy'
                    })
                    matched = True
                    i += window
                    break
        if not matched:
            if words[i] not in ['i', 'am', 'have', 'having', 'feel', 'feeling', 'with', 'and', 'the', 'my', 'lot', 'of', 'very', 'too', 'also', 'some']:
                unrecognized.append(words[i])
            i += 1

    return {
        'symptoms': [r['code'] for r in recognized],
        'details': recognized,
        'unrecognized': unrecognized,
        'symptom_count': len(recognized)
    }


def autocomplete_symptoms(partial_text):
    """
    Suggest symptoms based on partial text input.
    Returns sorted list of matching symptom names.
    """
    partial = partial_text.lower().strip()
    if len(partial) < 2:
        return []

    suggestions = []
    seen = set()

    # Exact prefix matches first
    for alias, symptom in _REVERSE_MAP.items():
        if alias.startswith(partial) and symptom not in seen:
            seen.add(symptom)
            suggestions.append({
                'code': symptom,
                'label': SYMPTOM_LABELS.get(symptom, alias.title()),
                'score': 1.0
            })

    # Contains matches
    for alias, symptom in _REVERSE_MAP.items():
        if partial in alias and symptom not in seen:
            seen.add(symptom)
            suggestions.append({
                'code': symptom,
                'label': SYMPTOM_LABELS.get(symptom, alias.title()),
                'score': 0.8
            })

    # Fuzzy matches
    if len(suggestions) < 5:
        for alias, symptom in _REVERSE_MAP.items():
            if symptom not in seen:
                score = SequenceMatcher(None, partial, alias).ratio()
                if score > 0.5:
                    seen.add(symptom)
                    suggestions.append({
                        'code': symptom,
                        'label': SYMPTOM_LABELS.get(symptom, alias.title()),
                        'score': round(score, 2)
                    })

    suggestions.sort(key=lambda x: -x['score'])
    return suggestions[:8]
