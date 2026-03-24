from enum import Enum


class UserRole(str, Enum):
    FREE = "free"
    PRO = "pro"
    PREMIUM = "premium"
    ADMIN = "admin"


class ResumeStatus(str, Enum):
    DRAFT = "draft"
    COMPLETED = "completed"
    OPTIMIZED = "optimized"


class SectionType(str, Enum):
    EDUCATION = "education"
    EXPERIENCE = "experience"
    PROJECT = "project"
    SKILL = "skill"
    CERTIFICATION = "certification"
    AWARD = "award"
    PUBLICATION = "publication"
    VOLUNTEER = "volunteer"
    LANGUAGE = "language"
    CUSTOM = "custom"


class VersionSource(str, Enum):
    USER_EDIT = "user_edit"
    AI_GENERATE = "ai_generate"
    AI_OPTIMIZE = "ai_optimize"
    IMPORT = "import"


class InterviewType(str, Enum):
    BEHAVIORAL = "behavioral"
    TECHNICAL = "technical"
    CASE = "case"
    STRESS = "stress"
    MIXED = "mixed"


class InterviewMode(str, Enum):
    TEXT = "text"
    VOICE = "voice"


class InterviewDifficulty(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class InterviewStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class MessageRole(str, Enum):
    INTERVIEWER = "interviewer"
    CANDIDATE = "candidate"
    SYSTEM = "system"


class ConversationType(str, Enum):
    RESUME_BUILD = "resume_build"
    RESUME_OPTIMIZE = "resume_optimize"
    CAREER_ADVICE = "career_advice"
    GENERAL = "general"
