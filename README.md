# GuardRail - Open Source Feedback Redaction & Routing Microservice

GuardRail is a production-grade customer feedback scrubbing and sentiment routing microservice. It deterministically scrubs sensitive PII/PHI (PCI credit cards, HIPAA SSNs/medical IDs, phone numbers, and emails) using Regex engines and refines it with an AI/Heuristics layer. It then analyzes the feedback sentiment and routes the compliance-safe data into distinct database destinations based on sentiment:
* **Positive Sentiment** -> Marketing Database
* **Negative Sentiment** -> Priority Support Database
* **Neutral Sentiment** -> General Archive Database

## Features
- **100% Offline Out-of-the-Box**: Zero configuration required. If no external LLM is configured, it automatically falls back to high-fidelity, local heuristic/regex engines.
- **Open-Source & Easily Deployable**: Removed Google-proprietary dependencies (such as `@google/genai`).
- **OpenAI & Ollama Compatible**: Connects to any self-hosted LLM (like Ollama, LM Studio, vLLM) or open-source API provider using standard OpenAI-compatible endpoints.
- **Robust Integration Testing**: Verified using Vitest and Supertest.

---

## Getting Started

### Prerequisites
- Node.js (version 18 or above recommended)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (Optional)
Copy `.env.example` to `.env` and configure your settings:
```bash
cp .env.example .env
```
Available environment variables:
- `AI_API_KEY`: Your API Key (e.g. from OpenAI, DeepSeek, Together, etc.). Not required if using a local Ollama server.
- `AI_BASE_URL`: Base URL of the OpenAI-compatible endpoint (e.g. `http://localhost:11434/v1` for Ollama).
- `AI_MODEL`: Model name (e.g. `llama3` or `gpt-4o-mini`).
- `APP_URL`: The URL where this service is hosted (default: `http://localhost:3000`).

*Note: If no AI environment variables are set, GuardRail runs completely offline using local regex and sentiment rules.*

### 3. Run the App
To start the server in development mode:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the interactive GuardRail playground.

### 4. Run the Test Suite
To execute the automated integration test suite (powered by **Vitest** & **Supertest**):
```bash
npm run test
```
This tests standard scrubbing pipelines, composite PII scenarios, empty payloads, and reads/validates from `src/data/sample_data.json`.
