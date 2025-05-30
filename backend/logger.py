# logger.py
import logging

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
)

# Get a logger instance for your app
logger = logging.getLogger("fastapi-app")
