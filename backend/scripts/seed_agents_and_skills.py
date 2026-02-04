"""
Seed script to populate the database with popular agents and skills.
Covers Financial Services, Sales, and Human Resources domains.
"""
import os
import sys
import requests

# Configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
SEED_USER_EMAIL = "seed@agenthr.com"
SEED_USER_PASSWORD = "SeedUser123!"
SEED_USER_NAME = "Seed Admin"


def get_auth_token() -> str:
    """Get authentication token, creating user if needed."""
    # Try to login first
    login_resp = requests.post(
        f"{API_BASE_URL}/api/auth/login",
        json={"email": SEED_USER_EMAIL, "password": SEED_USER_PASSWORD}
    )

    if login_resp.status_code == 200:
        return login_resp.json()["access_token"]

    # Register new user
    register_resp = requests.post(
        f"{API_BASE_URL}/api/auth/register",
        json={
            "email": SEED_USER_EMAIL,
            "password": SEED_USER_PASSWORD,
            "name": SEED_USER_NAME
        }
    )

    if register_resp.status_code not in (200, 201):
        print(f"Failed to register user: {register_resp.text}")
        sys.exit(1)

    # Login after registration
    login_resp = requests.post(
        f"{API_BASE_URL}/api/auth/login",
        json={"email": SEED_USER_EMAIL, "password": SEED_USER_PASSWORD}
    )

    if login_resp.status_code != 200:
        print(f"Failed to login: {login_resp.text}")
        sys.exit(1)

    return login_resp.json()["access_token"]


# =============================================================================
# AGENTS DATA
# =============================================================================
AGENTS = [
    # Financial Services Agents
    {
        "name": "Financial Analyst Pro",
        "description": "AI-powered financial analysis agent that processes financial statements, calculates key ratios, identifies trends, and generates investment recommendations based on fundamental analysis.",
        "department": "Financial Services",
        "tags": ["finance", "analysis", "investment", "reporting"],
        "usage_notes": "Best used for quarterly earnings analysis, competitor benchmarking, and portfolio assessment. Supports SEC filings, earnings transcripts, and financial databases."
    },
    {
        "name": "Compliance Monitor",
        "description": "Automated compliance monitoring agent that tracks regulatory changes, assesses policy adherence, flags potential violations, and generates compliance reports for financial institutions.",
        "department": "Financial Services",
        "tags": ["compliance", "regulatory", "risk", "audit"],
        "usage_notes": "Monitors SEC, FINRA, and banking regulations. Integrates with document management systems and can process policy documents."
    },
    {
        "name": "Loan Underwriting Assistant",
        "description": "Intelligent loan underwriting agent that evaluates credit applications, analyzes borrower profiles, assesses risk factors, and provides underwriting recommendations.",
        "department": "Financial Services",
        "tags": ["lending", "credit", "underwriting", "risk-assessment"],
        "usage_notes": "Processes credit reports, income verification documents, and employment records. Supports mortgage, auto, and personal loan applications."
    },

    # Sales Agents
    {
        "name": "Lead Qualification Agent",
        "description": "Smart lead scoring and qualification agent that analyzes prospect data, evaluates buying signals, prioritizes leads, and provides personalized outreach recommendations.",
        "department": "Sales",
        "tags": ["leads", "prospecting", "qualification", "outreach"],
        "usage_notes": "Integrates with CRM systems, enriches lead data from multiple sources, and uses ML models for scoring. Best for B2B sales teams."
    },
    {
        "name": "Sales Forecasting Engine",
        "description": "Predictive sales forecasting agent that analyzes pipeline data, historical trends, market conditions, and rep performance to generate accurate revenue forecasts.",
        "department": "Sales",
        "tags": ["forecasting", "pipeline", "revenue", "analytics"],
        "usage_notes": "Connects to Salesforce, HubSpot, and other CRMs. Provides weekly, monthly, and quarterly forecasts with confidence intervals."
    },
    {
        "name": "Contract Negotiation Assistant",
        "description": "AI contract assistant that analyzes deal terms, identifies risks, suggests negotiation strategies, and tracks contract lifecycle from proposal to close.",
        "department": "Sales",
        "tags": ["contracts", "negotiation", "legal", "deal-desk"],
        "usage_notes": "Reviews MSAs, SOWs, and order forms. Highlights non-standard terms and provides redline suggestions. Supports multi-party deals."
    },

    # Human Resources Agents
    {
        "name": "Talent Acquisition Specialist",
        "description": "End-to-end recruiting agent that sources candidates, screens resumes, conducts initial assessments, schedules interviews, and provides hiring recommendations.",
        "department": "Human Resources",
        "tags": ["recruiting", "hiring", "talent", "sourcing"],
        "usage_notes": "Integrates with ATS systems, job boards, and LinkedIn. Supports technical and non-technical roles across multiple geographies."
    },
    {
        "name": "Employee Onboarding Coordinator",
        "description": "Comprehensive onboarding agent that manages new hire paperwork, coordinates training schedules, tracks completion milestones, and ensures compliance with onboarding requirements.",
        "department": "Human Resources",
        "tags": ["onboarding", "training", "new-hire", "compliance"],
        "usage_notes": "Automates I-9 verification, benefits enrollment, and equipment provisioning. Customizable onboarding workflows by role and location."
    },
    {
        "name": "Performance Review Facilitator",
        "description": "Performance management agent that collects feedback, analyzes review data, identifies skill gaps, generates development plans, and tracks goal progress.",
        "department": "Human Resources",
        "tags": ["performance", "reviews", "feedback", "development"],
        "usage_notes": "Supports 360-degree reviews, OKR tracking, and competency assessments. Integrates with HRIS systems for historical performance data."
    },
    {
        "name": "HR Policy Assistant",
        "description": "Intelligent HR policy agent that answers employee questions, explains benefits, guides through HR processes, and ensures consistent policy application.",
        "department": "Human Resources",
        "tags": ["policy", "benefits", "employee-support", "self-service"],
        "usage_notes": "Trained on company handbook, benefits documentation, and HR procedures. Available 24/7 for employee inquiries via chat or email."
    },
]


# =============================================================================
# SKILLS DATA (Library Components)
# =============================================================================
SKILLS = [
    # Data Processing Skills
    {
        "type": "skill",
        "name": "Document Parser",
        "description": "Extracts structured data from PDFs, images, and scanned documents using OCR and NLP techniques.",
        "tags": ["data-processing", "ocr", "parsing", "documents"],
        "content": "# Document Parser Skill\n\nCapabilities:\n- PDF text extraction\n- Image OCR processing\n- Table detection and extraction\n- Form field recognition"
    },
    {
        "type": "skill",
        "name": "Data Validator",
        "description": "Validates data against schemas, business rules, and consistency checks with detailed error reporting.",
        "tags": ["data-processing", "validation", "quality"],
        "content": "# Data Validator Skill\n\nValidation types:\n- Schema validation\n- Business rule checks\n- Cross-field consistency\n- Format verification"
    },
    {
        "type": "skill",
        "name": "Report Generator",
        "description": "Creates formatted reports in multiple formats (PDF, Excel, HTML) with charts, tables, and summaries.",
        "tags": ["reporting", "documents", "analytics"],
        "content": "# Report Generator Skill\n\nOutput formats:\n- PDF reports\n- Excel workbooks\n- HTML dashboards\n- PowerPoint presentations"
    },

    # Communication Skills
    {
        "type": "skill",
        "name": "Email Composer",
        "description": "Drafts professional emails with customizable tone, templates, and personalization based on context.",
        "tags": ["communication", "email", "writing"],
        "content": "# Email Composer Skill\n\nFeatures:\n- Tone adjustment (formal/casual)\n- Template library\n- Personalization tokens\n- Follow-up suggestions"
    },
    {
        "type": "skill",
        "name": "Meeting Scheduler",
        "description": "Coordinates meeting times across calendars, sends invites, and manages scheduling conflicts.",
        "tags": ["communication", "scheduling", "calendar"],
        "content": "# Meeting Scheduler Skill\n\nCapabilities:\n- Calendar integration\n- Timezone handling\n- Conflict resolution\n- Room booking"
    },
    {
        "type": "skill",
        "name": "Summarization Engine",
        "description": "Generates concise summaries of documents, meetings, and conversations while preserving key information.",
        "tags": ["communication", "summarization", "nlp"],
        "content": "# Summarization Engine Skill\n\nModes:\n- Executive summary\n- Bullet points\n- Action items extraction\n- Key decisions highlight"
    },

    # Analysis Skills
    {
        "type": "skill",
        "name": "Sentiment Analyzer",
        "description": "Analyzes text sentiment and emotion, providing scores and insights for customer feedback and communications.",
        "tags": ["analysis", "nlp", "sentiment"],
        "content": "# Sentiment Analyzer Skill\n\nOutputs:\n- Sentiment score (-1 to 1)\n- Emotion detection\n- Topic-level sentiment\n- Trend analysis"
    },
    {
        "type": "skill",
        "name": "Trend Detector",
        "description": "Identifies patterns and trends in time-series data with statistical analysis and forecasting.",
        "tags": ["analysis", "statistics", "forecasting"],
        "content": "# Trend Detector Skill\n\nMethods:\n- Moving averages\n- Seasonal decomposition\n- Anomaly detection\n- Forecast generation"
    },
    {
        "type": "skill",
        "name": "Competitive Intelligence",
        "description": "Gathers and analyzes competitor information from public sources, news, and market data.",
        "tags": ["analysis", "research", "competitive"],
        "content": "# Competitive Intelligence Skill\n\nSources:\n- News monitoring\n- SEC filings\n- Social media\n- Job postings analysis"
    },

    # Integration Skills
    {
        "type": "skill",
        "name": "CRM Connector",
        "description": "Integrates with popular CRM systems (Salesforce, HubSpot) for data sync and workflow automation.",
        "tags": ["integration", "crm", "salesforce", "hubspot"],
        "content": "# CRM Connector Skill\n\nSupported systems:\n- Salesforce\n- HubSpot\n- Pipedrive\n- Microsoft Dynamics"
    },
    {
        "type": "skill",
        "name": "Database Query Engine",
        "description": "Executes SQL queries, generates reports from databases, and performs data transformations.",
        "tags": ["integration", "database", "sql"],
        "content": "# Database Query Engine Skill\n\nCapabilities:\n- SQL generation from natural language\n- Query optimization\n- Result formatting\n- Schema inference"
    },
    {
        "type": "skill",
        "name": "API Orchestrator",
        "description": "Manages complex API workflows, handles authentication, and coordinates multi-step integrations.",
        "tags": ["integration", "api", "workflow"],
        "content": "# API Orchestrator Skill\n\nFeatures:\n- OAuth/API key management\n- Rate limiting\n- Error handling\n- Response transformation"
    },

    # Compliance & Security Skills
    {
        "type": "skill",
        "name": "PII Detector",
        "description": "Identifies and masks personally identifiable information in documents and data streams.",
        "tags": ["security", "privacy", "compliance", "pii"],
        "content": "# PII Detector Skill\n\nDetects:\n- Names, addresses, SSN\n- Financial account numbers\n- Health information\n- Custom patterns"
    },
    {
        "type": "skill",
        "name": "Audit Logger",
        "description": "Creates comprehensive audit trails for agent actions, decisions, and data access.",
        "tags": ["security", "audit", "compliance", "logging"],
        "content": "# Audit Logger Skill\n\nLogs:\n- User actions\n- Data access\n- Decision rationale\n- Timestamp and context"
    },
    {
        "type": "skill",
        "name": "Policy Checker",
        "description": "Validates actions and content against configurable policy rules and compliance requirements.",
        "tags": ["compliance", "policy", "validation"],
        "content": "# Policy Checker Skill\n\nChecks:\n- Content policies\n- Access controls\n- Regulatory requirements\n- Business rules"
    },

    # Workflow Skills
    {
        "type": "skill",
        "name": "Task Prioritizer",
        "description": "Ranks and prioritizes tasks based on urgency, importance, deadlines, and dependencies.",
        "tags": ["workflow", "productivity", "prioritization"],
        "content": "# Task Prioritizer Skill\n\nFactors:\n- Deadline proximity\n- Business impact\n- Dependencies\n- Resource availability"
    },
    {
        "type": "skill",
        "name": "Approval Router",
        "description": "Routes requests through approval workflows based on rules, hierarchies, and delegation.",
        "tags": ["workflow", "approvals", "routing"],
        "content": "# Approval Router Skill\n\nFeatures:\n- Rule-based routing\n- Escalation paths\n- Delegation handling\n- SLA tracking"
    },
    {
        "type": "skill",
        "name": "Notification Manager",
        "description": "Sends targeted notifications via email, Slack, SMS based on events and user preferences.",
        "tags": ["workflow", "notifications", "communication"],
        "content": "# Notification Manager Skill\n\nChannels:\n- Email\n- Slack/Teams\n- SMS\n- Push notifications"
    },

    # Knowledge Skills
    {
        "type": "skill",
        "name": "Knowledge Search",
        "description": "Semantic search across knowledge bases, documents, and FAQs with relevance ranking.",
        "tags": ["knowledge", "search", "retrieval"],
        "content": "# Knowledge Search Skill\n\nFeatures:\n- Semantic similarity\n- Keyword matching\n- Faceted search\n- Source attribution"
    },
    {
        "type": "skill",
        "name": "FAQ Answerer",
        "description": "Answers frequently asked questions using knowledge base with confidence scoring.",
        "tags": ["knowledge", "qa", "support"],
        "content": "# FAQ Answerer Skill\n\nCapabilities:\n- Intent matching\n- Confidence scoring\n- Fallback handling\n- Learning from feedback"
    },
]


def create_agents(token: str) -> int:
    """Create all seed agents."""
    headers = {"Authorization": f"Bearer {token}"}
    created_count = 0

    for agent_data in AGENTS:
        resp = requests.post(
            f"{API_BASE_URL}/api/agents",
            json=agent_data,
            headers=headers
        )

        if resp.status_code == 201:
            created_count += 1
            print(f"  ✓ Created agent: {agent_data['name']}")
        else:
            print(f"  ✗ Failed to create agent '{agent_data['name']}': {resp.text}")

    return created_count


def create_skills(token: str) -> int:
    """Create all seed skills in the Component Registry."""
    headers = {"Authorization": f"Bearer {token}"}
    created_count = 0

    for skill_data in SKILLS:
        # Convert to component registry format
        registry_data = {
            "type": skill_data["type"],
            "name": skill_data["name"],
            "description": skill_data.get("description"),
            "content": skill_data.get("content"),
            "tags": skill_data.get("tags", []),
            "visibility": "public",  # Make skills public so they're visible
            "component_metadata": {}
        }

        resp = requests.post(
            f"{API_BASE_URL}/api/component-registry",
            json=registry_data,
            headers=headers
        )

        if resp.status_code == 201:
            created_count += 1
            print(f"  ✓ Created skill: {skill_data['name']}")
        else:
            print(f"  ✗ Failed to create skill '{skill_data['name']}': {resp.text}")

    return created_count


def main():
    print("=" * 60)
    print("Agent HR - Seed Data Script")
    print("=" * 60)
    print()

    print(f"API Base URL: {API_BASE_URL}")
    print()

    # Get authentication token
    print("1. Authenticating...")
    try:
        token = get_auth_token()
        print(f"   ✓ Authenticated as {SEED_USER_EMAIL}")
    except requests.exceptions.ConnectionError:
        print(f"   ✗ Cannot connect to API at {API_BASE_URL}")
        print("   Make sure the backend server is running.")
        sys.exit(1)
    print()

    # Create agents
    print("2. Creating Agents...")
    agents_created = create_agents(token)
    print(f"   Total agents created: {agents_created}/{len(AGENTS)}")
    print()

    # Create skills
    print("3. Creating Skills...")
    skills_created = create_skills(token)
    print(f"   Total skills created: {skills_created}/{len(SKILLS)}")
    print()

    print("=" * 60)
    print("Seed data complete!")
    print(f"  - Agents: {agents_created}")
    print(f"  - Skills: {skills_created}")
    print("=" * 60)


if __name__ == "__main__":
    main()
