const fs = require('fs');
const path = require('path');

function wrapLines(text, maxLen = 90) {
  const lines = [];
  const rawLines = text.split('\n');
  for (const raw of rawLines) {
    if (raw.trim() === '') {
      lines.push('');
      continue;
    }
    const match = raw.match(/^(\s*(?:[-*]|\d+\.)\s+)/);
    const prefix = match ? match[1] : '';
    const content = match ? raw.slice(prefix.length) : raw;
    const words = content.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const candidate = (line ? line + ' ' : '') + word;
      const full = prefix + candidate;
      if (full.length > maxLen && line) {
        lines.push(prefix + line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line || prefix) {
      lines.push(prefix + line);
    }
  }
  return lines;
}

function escapePdfText(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(lines, outputPath) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 54;
  const startY = 760;
  const fontSize = 11;
  const leading = 14;
  const linesPerPage = Math.floor((startY - 54) / leading);

  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }

  const entries = [];
  const catalogNum = 1;
  const pagesNum = 2;
  const fontNum = 3;
  let nextNum = 4;

  const pageObjects = [];
  const contentObjects = [];

  for (const pageLines of pages) {
    const contentNum = nextNum++;
    const pageNum = nextNum++;

    const streamLines = [];
    streamLines.push('BT');
    streamLines.push(`/F1 ${fontSize} Tf`);
    streamLines.push(`${leading} TL`);
    streamLines.push(`${marginLeft} ${startY} Td`);

    for (const line of pageLines) {
      const safe = escapePdfText(line);
      streamLines.push(`(${safe}) Tj`);
      streamLines.push('T*');
    }
    streamLines.push('ET');

    const stream = streamLines.join('\n');
    const length = Buffer.byteLength(stream, 'utf8');

    contentObjects.push({
      num: contentNum,
      body: `<< /Length ${length} >>\nstream\n${stream}\nendstream`
    });

    pageObjects.push({
      num: pageNum,
      body: `<< /Type /Page /Parent ${pagesNum} 0 R /Resources << /Font << /F1 ${fontNum} 0 R >> >> /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentNum} 0 R >>`
    });
  }

  const kids = pageObjects.map(p => `${p.num} 0 R`).join(' ');

  entries.push({ num: catalogNum, body: `<< /Type /Catalog /Pages ${pagesNum} 0 R >>` });
  entries.push({ num: pagesNum, body: `<< /Type /Pages /Kids [${kids}] /Count ${pageObjects.length} >>` });
  entries.push({ num: fontNum, body: `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>` });

  for (let i = 0; i < pageObjects.length; i++) {
    entries.push(contentObjects[i]);
    entries.push(pageObjects[i]);
  }

  let output = '%PDF-1.4\n';
  const offsets = [0];

  for (const entry of entries) {
    offsets.push(Buffer.byteLength(output, 'utf8'));
    output += `${entry.num} 0 obj\n${entry.body}\nendobj\n`;
  }

  const xrefStart = Buffer.byteLength(output, 'utf8');
  output += `xref\n0 ${entries.length + 1}\n`;
  output += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    const offset = String(offsets[i]).padStart(10, '0');
    output += `${offset} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${entries.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  fs.writeFileSync(outputPath, output, 'utf8');
}

const today = new Date().toISOString().slice(0, 10);

const report = `MedAI - Rural HealthTech Project Report
Date: ${today}

1. Executive Summary
MedAI is a full-stack, AI-assisted rural healthcare platform that provides symptom checks,
triage guidance, online consultations, emergency workflows, and a precaution chatbot.
It is designed to be simple, low-cost, and demo-ready without paid APIs.

2. Problem Statement
Rural healthcare faces delayed diagnosis, limited specialist access, and slow emergency
response. Patients often have to travel long distances or wait for care. MedAI aims to
reduce time-to-triage and support faster decision-making.

3. Objectives
- Provide quick symptom check and risk scoring
- Enable consultation booking with doctors
- Support emergency escalation when risk is high
- Offer precautionary guidance with a chatbot
- Keep the experience simple, multilingual, and low-bandwidth friendly

4. Solution Overview
Patient flow:
- Enter symptoms and vitals
- AI service predicts risk and likely conditions
- User receives explanation and recommendations
- For urgent cases, emergency workflow can be triggered
- For non-urgent cases, users can book a consultation

Doctor flow:
- Manage availability slots
- Review patient bookings
- Start and complete consultations

Admin flow:
- Confirm or reject bookings
- Review payment statuses
- Monitor operational status

5. Architecture (High Level)
- Frontend: React UI for all roles
- Backend: Node.js + Express REST API
- AI Service: FastAPI for prediction, interpretation, explanation, chatbot
- Database: MongoDB for users, consultations, diagnoses, hospitals
- Realtime: Socket.IO for live updates

6. Why This Architecture and Benefits
- React: modular UI, fast iteration, consistent user experience
- Node/Express: quick REST APIs, strong ecosystem, easy integration
- FastAPI: fast Python APIs, type safety, ideal for ML services
- MongoDB: flexible schema for evolving medical data
- Socket.IO: real-time updates for critical workflows
- Separated AI service: scalable and independent model updates

7. Key Modules (What, Why, Benefits)
7.1 Symptom Check
What: Accepts symptoms and vitals, sends to AI service, shows risk and likely conditions.
Why: Early triage helps in rural settings.
Benefits: Fast decision support and clear next steps.

7.2 Symptom Interpreter
What: Converts free-text into structured symptom codes.
Why: Users describe symptoms in natural language.
Benefits: Works offline, predictable, no paid APIs.

7.3 AI Prediction Model
What: RandomForest classifier using symptoms and vitals.
Why: Robust for tabular data and interpretable.
Benefits: Stable predictions with feature importance.

7.4 Diagnosis Explanation
What: Generates human-readable summary and action.
Why: Raw probabilities are not enough for patients.
Benefits: Builds trust and clarity.

7.5 Precaution Chatbot
What: Rule-based suggestions and precautions.
Why: Immediate self-care guidance.
Benefits: Safe, low-cost, deterministic responses.

7.6 Consultations
What: Booking flow, payments, meetings, confirmations.
Why: Bridges AI triage with real clinical care.
Benefits: End-to-end patient journey.

7.7 Emergency Workflow
What: Triggers urgent response and notifications.
Why: High-risk cases need escalation.
Benefits: Faster response and clearer guidance.

7.8 Profiles
What: Role-based profile pages with edit functionality.
Why: Official and accountable identity.
Benefits: Trust and better record-keeping.

8. Data Flow (Simplified)
- UI sends symptoms to backend
- Backend forwards to AI service
- AI returns prediction, explanation, probabilities
- Backend stores diagnosis and returns to UI

9. Safety, Ethics, and Privacy
- JWT authentication and role-based access
- Clear disclaimers about AI limitations
- No external AI providers, reduced data exposure

10. Accessibility and Inclusion
- Low-bandwidth mode
- Voice guidance support
- Multilingual UI options

11. Limitations
- Model trained on synthetic data for demo purposes
- Rule-based chatbot is not diagnostic
- Real-world deployment requires clinical validation

12. Future Work
- Integrate real clinical datasets
- Add offline caching
- Expand emergency integrations with local services

13. Hackathon Jury Q and A (Prepared)
Q1: What problem are you solving?
A: Delayed diagnosis and limited access in rural healthcare.

Q2: Why not just telemedicine?
A: We combine triage, explanation, emergency workflows, and booking in one platform.

Q3: How safe is the AI?
A: It is decision support only, with clear disclaimers and escalation paths.

Q4: Why RandomForest?
A: Robust for structured data, interpretable, reliable baseline.

Q5: How do you handle free-text symptoms?
A: Rule-based and fuzzy matching, no paid NLP APIs.

Q6: What if AI service is down?
A: Backend has fallbacks and UI gracefully handles errors.

Q7: How is data protected?
A: JWT auth, role-based access, no external AI calls.

Q8: How do you scale?
A: AI is a separate service, backend is stateless, easy to scale horizontally.

Q9: What is unique here?
A: Integrated triage + emergency response + consultation + explanation.

Q10: What are the next steps?
A: Clinical validation and integration with real health systems.
`;

const pitch = `MedAI - Pitch Deck Outline
Date: ${today}

Slide 1 - Title
- MedAI: Rural HealthTech Platform
- Tagline: AI-assisted triage and care access

Slide 2 - Problem
- Delayed diagnosis in rural areas
- Lack of specialist access
- Slow emergency response

Slide 3 - Solution
- AI symptom check with risk scoring
- Online consultations and booking
- Emergency escalation workflow
- Precaution chatbot for guidance

Slide 4 - Product Demo (What users see)
- Symptom entry and AI results
- Booking flow
- Emergency trigger
- Role-based dashboards

Slide 5 - Architecture
- React frontend
- Node/Express backend
- FastAPI AI service
- MongoDB + Socket.IO

Slide 6 - AI and Explainability
- RandomForest model
- Symptom interpreter
- Human-readable explanations

Slide 7 - Impact
- Faster triage
- Reduced travel for basic care
- Better emergency readiness

Slide 8 - Security and Privacy
- JWT auth
- Role-based access
- No external AI providers

Slide 9 - Deployment Plan
- Cloud deployment with separate services
- Local hospital integration
- Offline-friendly mode

Slide 10 - Roadmap
- Real clinical data
- Regional language expansion
- Emergency service partnerships

Slide 11 - Team
- Roles and responsibilities

Slide 12 - Ask
- Pilot hospitals or datasets
- Mentorship and validation support
`;

const demo = `MedAI - 2 Minute Demo Script
Date: ${today}

0:00 - 0:15
Hello, we are presenting MedAI, an AI-assisted rural healthcare platform that helps with
symptom checks, consultations, and emergency response.

0:15 - 0:35
I will start as a patient. I open Symptom Check, select symptoms, and enter vitals.
The AI returns risk level, likely conditions, and clear recommendations.

0:35 - 0:55
If risk is urgent, I can trigger the emergency workflow. Otherwise I go to Consultations,
choose a doctor, and reserve a slot.

0:55 - 1:15
Now as a doctor, I see my dashboard, upcoming consultations, and availability slots.
I can confirm meetings and complete sessions.

1:15 - 1:35
As an admin, I see booking requests, payment status, and confirmation controls.
This ensures operational visibility.

1:35 - 1:55
The precaution chatbot provides immediate guidance for patients before they reach a clinic.
It is rule-based and safe.

1:55 - 2:00
MedAI reduces time-to-triage, improves access, and supports faster emergency response.
Thank you.
`;

const docsDir = path.join(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const reportLines = wrapLines(report, 92);
const pitchLines = wrapLines(pitch, 92);
const demoLines = wrapLines(demo, 92);

buildPdf(reportLines, path.join(docsDir, 'MedAI_Project_Report.pdf'));
buildPdf(pitchLines, path.join(docsDir, 'MedAI_Pitch_Deck_Outline.pdf'));
buildPdf(demoLines, path.join(docsDir, 'MedAI_Demo_Script.pdf'));

console.log('PDFs created in docs/');
