import json
import os
import pickle

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import cross_val_score

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
SYMPTOMS_PATH = os.path.join(DATA_DIR, 'symptoms.json')
DISEASES_PATH = os.path.join(DATA_DIR, 'diseases.json')
DISEASE_SYMPTOMS_PATH = os.path.join(DATA_DIR, 'disease_symptoms.json')
DISEASE_INFO_PATH = os.path.join(DATA_DIR, 'disease_info.json')


def _load_json(path, default):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if data is not None else default
    except FileNotFoundError:
        return default


_SYMPTOM_ITEMS = _load_json(SYMPTOMS_PATH, [])
SYMPTOMS_LIST = [item['id'] for item in _SYMPTOM_ITEMS if isinstance(item, dict) and 'id' in item]
SYMPTOM_INDEX = {symptom_id: idx for idx, symptom_id in enumerate(SYMPTOMS_LIST)}

DISEASES = _load_json(DISEASES_PATH, [])
DISEASE_SYMPTOMS = _load_json(DISEASE_SYMPTOMS_PATH, {})
DISEASE_INFO = _load_json(DISEASE_INFO_PATH, {})

SEVERITY_RISK = {
    'low': 0.2,
    'moderate': 0.4,
    'high': 0.7,
    'critical': 0.95,
    'unknown': 0.5
}

SEVERITY_VITALS = {
    'critical': {'hr': (110, 20), 'bps': (170, 25), 'bpd': (100, 15), 'temp': (38.8, 0.7), 'spo2': (92, 3), 'age': (40, 85)},
    'high': {'hr': (95, 15), 'bps': (140, 20), 'bpd': (90, 12), 'temp': (38.0, 0.6), 'spo2': (94, 3), 'age': (20, 85)},
    'moderate': {'hr': (85, 12), 'bps': (125, 15), 'bpd': (82, 10), 'temp': (37.5, 0.5), 'spo2': (96, 2), 'age': (18, 80)},
    'low': {'hr': (75, 10), 'bps': (118, 12), 'bpd': (78, 8), 'temp': (37.0, 0.3), 'spo2': (97, 1), 'age': (18, 70)},
    'unknown': {'hr': (85, 12), 'bps': (125, 15), 'bpd': (82, 10), 'temp': (37.5, 0.5), 'spo2': (96, 2), 'age': (18, 80)}
}

DEFAULT_SYMPTOMS = [s for s in ['fever', 'fatigue', 'headache'] if s in SYMPTOMS_LIST]
if not DEFAULT_SYMPTOMS:
    DEFAULT_SYMPTOMS = SYMPTOMS_LIST[:3]

TRIAGE_THRESHOLDS = {'Emergency': 0.7, 'Urgent': 0.4}


def _normalize_symptoms(symptoms):
    return [s for s in symptoms if s in SYMPTOMS_LIST]


def _severity_for(disease):
    info = DISEASE_INFO.get(disease, {})
    severity = info.get('severity', 'moderate')
    return severity.lower() if isinstance(severity, str) else 'moderate'


def _symptoms_for(disease):
    symptoms = DISEASE_SYMPTOMS.get(disease, [])
    symptoms = _normalize_symptoms(symptoms)
    return symptoms if symptoms else DEFAULT_SYMPTOMS


def _vitals_for(disease):
    severity = _severity_for(disease)
    return SEVERITY_VITALS.get(severity, SEVERITY_VITALS['unknown'])


def _build_risk_mapping():
    mapping = {}
    for disease in DISEASES:
        severity = _severity_for(disease)
        mapping[disease] = SEVERITY_RISK.get(severity, SEVERITY_RISK['unknown'])
    return mapping


RISK_MAPPING = _build_risk_mapping()


def generate_synthetic_data(n_samples=5000):
    np.random.seed(42)
    X, y = [], []

    disease_symptoms = {d: _symptoms_for(d) for d in DISEASES}
    vital_ranges = {d: _vitals_for(d) for d in DISEASES}

    for _ in range(n_samples):
        disease_idx = np.random.randint(0, len(DISEASES))
        disease = DISEASES[disease_idx]
        symptoms = np.zeros(len(SYMPTOMS_LIST))

        # Set disease-specific symptoms with high probability
        for s in disease_symptoms[disease]:
            idx = SYMPTOM_INDEX.get(s)
            if idx is not None:
                symptoms[idx] = np.random.choice([0, 1], p=[0.1, 0.9])

        # Add random noise symptoms
        noise_count = np.random.randint(0, 3)
        for idx in np.random.choice(len(SYMPTOMS_LIST), noise_count, replace=False):
            symptoms[idx] = np.random.choice([0, 1], p=[0.7, 0.3])

        # Generate vitals from severity-based ranges
        vr = vital_ranges[disease]
        heart_rate = np.random.normal(*vr['hr'])
        bp_systolic = np.random.normal(*vr['bps'])
        bp_diastolic = np.random.normal(*vr['bpd'])
        temperature = np.random.normal(*vr['temp'])
        spo2 = np.clip(np.random.normal(*vr['spo2']), 70, 100)
        age = np.random.randint(*vr['age'])

        features = np.concatenate([symptoms, [heart_rate, bp_systolic, bp_diastolic, temperature, spo2, age]])
        X.append(features)
        y.append(disease_idx)

    return np.array(X), np.array(y)


def train_and_save():
    X, y = generate_synthetic_data(5000)

    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X, y)

    cv_scores = cross_val_score(model, X, y, cv=5, scoring='accuracy')

    model_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(model_dir, 'disease_model.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)

    print(f"Model trained and saved to {model_path}")
    print(f"Training accuracy: {model.score(X, y):.4f}")
    print(f"Cross-validation: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
    return model


def load_model():
    model_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(model_dir, 'disease_model.pkl')
    if not os.path.exists(model_path):
        print("No saved model found. Training new model...")
        return train_and_save()
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    expected_features = len(SYMPTOMS_LIST) + 6
    if getattr(model, 'n_features_in_', expected_features) != expected_features:
        print("Model feature count mismatch. Retraining with updated symptoms...")
        return train_and_save()
    return model


def predict(symptoms, heart_rate, bp_systolic, bp_diastolic, temperature, spo2, age):
    model = load_model()

    symptom_vector = np.zeros(len(SYMPTOMS_LIST))
    for s in symptoms:
        idx = SYMPTOM_INDEX.get(s)
        if idx is not None:
            symptom_vector[idx] = 1

    features = np.concatenate([
        symptom_vector,
        [heart_rate, bp_systolic, bp_diastolic, temperature, spo2, age]
    ]).reshape(1, -1)

    prediction_idx = model.predict(features)[0]
    probabilities = model.predict_proba(features)[0]
    disease = DISEASES[prediction_idx]
    confidence = float(probabilities[prediction_idx])

    base_risk = RISK_MAPPING.get(disease, SEVERITY_RISK['unknown'])
    vital_risk = 0
    if heart_rate > 100:
        vital_risk += 0.1
    if bp_systolic > 140:
        vital_risk += 0.1
    if temperature > 38.5:
        vital_risk += 0.05
    if spo2 < 94:
        vital_risk += 0.15
    risk_score = min(1.0, base_risk * 0.7 + vital_risk + confidence * 0.2)

    if risk_score >= TRIAGE_THRESHOLDS['Emergency']:
        risk_level = 'Emergency'
    elif risk_score >= TRIAGE_THRESHOLDS['Urgent']:
        risk_level = 'Urgent'
    else:
        risk_level = 'Routine'

    feature_names = SYMPTOMS_LIST + ['heart_rate', 'bp_systolic', 'bp_diastolic', 'temperature', 'spo2', 'age']
    importances = model.feature_importances_
    explanation = []
    for i, imp in enumerate(importances):
        if imp > 0.01:
            explanation.append({
                'feature': feature_names[i],
                'importance': round(float(imp), 4),
                'value': float(features[0][i])
            })
    explanation.sort(key=lambda x: x['importance'], reverse=True)

    return {
        'prediction': disease,
        'confidence': round(confidence, 4),
        'risk_score': round(risk_score, 4),
        'risk_level': risk_level,
        'explanation': explanation[:10],
        'all_probabilities': {DISEASES[i]: round(float(p), 4) for i, p in enumerate(probabilities)}
    }


if __name__ == '__main__':
    train_and_save()
