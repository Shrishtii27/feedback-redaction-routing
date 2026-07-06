# Business Requirements Document (BRD)
## Project: Production-Grade Customer Feedback Scrubbing & Sentiment Routing Microservice

### 1. Problem Statement
A major healthcare and fintech client receives thousands of daily customer feedback submissions through its web portal. A significant percentage of these submissions contain highly sensitive Personally Identifiable Information (PII) and Protected Health Information (PHI), such as:
* Credit card numbers (PCI data)
* Social Security Numbers (SSN) / Health IDs (HIPAA data)
* Phone numbers and email addresses (PII data)

Processing and storing this raw feedback in general-purpose internal systems (such as marketing lists or standard support backlogs) presents extreme compliance and legal risks under GDPR, CCPA, PCI-DSS, and HIPAA regulations. 

### 2. Solution Overview
The client requires a robust, production-grade ingestion microservice that:
1. **Redacts PII/PHI**: Automatically scrubs sensitive strings, replacing them with a standardized `[REDACTED]` token. It must handle composite cases containing multiple categories of PII in a single submission.
2. **Analyzes Sentiment**: Classifies the sentiment of the scrubbed message (Positive, Negative, or Neutral).
3. **Routes Clean Feedback**: Stores the cleaned data into distinct destination databases depending on sentiment:
   * **Positive Sentiment** -> Routed to the **Marketing Database** (for testimonials and promotional opportunities).
   * **Negative Sentiment** -> Routed to the **Priority Support Database** (for urgent remediation and ticketing).
   * **Neutral Sentiment** -> Routed to the **General Archive Database** (for product analytics and standard tracking).

---

### 3. Success Metrics
* **Scrubbing Precision & Recall (100% Target)**: All credit card numbers, SSNs, phone numbers, and emails must be successfully scrubbed. Composite cases must not leave partial fields.
* **Sentiment Routing Accuracy (>95%)**: High-sentiment messages (strongly positive/negative) must be correctly categorized to prevent misrouting.
* **API Availability & Performance**:
  * Edge cases (empty payload, invalid JSON) must be handled gracefully with 400 Bad Request, preventing server crashes.
  * Integration test suite with 100% passing tests.
* **Security & Privacy**: Original feedback containing raw PII must never be stored in persistent databases. Only the redacted/scrubbed version is saved.

---

### 4. Explicit Data Boundaries (PII Classification)

The microservice utilizes a hybrid redaction engine: **Deterministic Regex** for high-precision pattern matches and **Heuristic AI (Open Source LLM / Offline Fallback)** for contextual/implied PII.

| Data Type | Definition & Format | Detection Strategy |
| :--- | :--- | :--- |
| **Credit Card (PCI)** | 13-16 digit numbers matching Visa, MasterCard, Amex formats. | Deterministic Regex (Luhn-adjacent formats) |
| **Email Address** | Standard RFC 5322 electronic mail address formats. | Deterministic Regex |
| **Phone Number** | Formats including US 10-digit, international prefixes, parentheses, and dashes. | Deterministic Regex |
| **Health ID / SSN** | 9-digit hyphenated US SSN (`AAA-GG-SSSS`) or standard 10-character Alpha-Numeric Medical ID. | Deterministic Regex + Contextual AI |
| **Contextual PII** | Full names, home/physical addresses, IP addresses, and explicit credentials. | Heuristic AI (Open Source LLM / Local Fallback) |

---

### 5. Flow Diagram / Architecture
```
[ Customer Submission ] 
         │
         ▼
 ┌──────────────┐
 │ POST /api/   │ ──( If empty body )──► [ 400 Bad Request ]
 │  feedback    │
 └───────┬──────┘
         │
         ▼ (Step 1: Deterministic Scrubbing)
 ┌──────────────────────────────────────┐
 │ Regex Engines (CC, Emails, Phones)   │
 └───────┬──────────────────────────────┘
         │
         ▼ (Step 2: Contextual Scrubbing & Sentiment)
 ┌──────────────────────────────────────┐
 │ Open Source LLM / Local Analyzer     │
 └───────┬──────────────────────────────┘
         │
         ├──► [ Redacted Output String ]
         ▼
 ┌──────────────────────────────────────┐
 │ Sentiment-Based Routing Engine       │
 └───────┬──────────────────────────────┘
         │
         ├─► [Sentiment: Positive] ────► [ Marketing Database ]
         ├─► [Sentiment: Negative] ────► [ Priority Support Database ]
         └─► [Sentiment: Neutral]  ────► [ General Archive Database ]
```
