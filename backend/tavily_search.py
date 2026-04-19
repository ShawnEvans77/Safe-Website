import os
from pathlib import Path

from dotenv import load_dotenv
from tavily import TavilyClient

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
client = TavilyClient(api_key=TAVILY_API_KEY) if TAVILY_API_KEY else None


def search_web(query: str) -> str:
    if client is None:
        return ""

    try:
        response = client.search(
            query=query,
            search_depth="advanced",
            max_results=3,
        )
        return "\n\n".join(result["content"] for result in response.get("results", []))
    except Exception as exc:
        print(f"Tavily error: {exc}")
        return ""


if __name__ == "__main__":
    print(search_web("grounding techniques for dissociation crisis counseling"))
