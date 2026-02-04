from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://agent_hr:agent_hr_secret@localhost:5432/agent_hr"
    jwt_secret: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
