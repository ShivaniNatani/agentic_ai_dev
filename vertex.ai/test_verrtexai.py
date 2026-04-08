import json
from pathlib import Path

from google.oauth2 import service_account
import vertexai
from vertexai.generative_models import GenerativeModel

# Paths based on your repo layout
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.json"


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text())

    key_path = BASE_DIR / config["service_account_file"]
    creds = service_account.Credentials.from_service_account_file(key_path)

    # Use the project embedded in the key; change the location if your model lives elsewhere
    vertexai.init(project=creds.project_id, location="us-central1", credentials=creds)

    # Default to the hosted Gemini 2.5 Flash model unless the config overrides it.
    model_name = config.get("model_name", "gemini-2.5-flash")
    model = GenerativeModel(model_name)

    # Only pass generation parameters the API understands
    gen_cfg = config.get("generation_config", {})
    allowed_fields = {"temperature", "top_p", "top_k", "max_output_tokens"}
    generation_config = {k: v for k, v in gen_cfg.items() if k in allowed_fields}

    prompt = "Explain what Vertex AI does in two sentences."
    response = model.generate_content(prompt, generation_config=generation_config)
    print(response.text)


if __name__ == "__main__":
    main()

