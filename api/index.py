"""
Vercel Serverless Entrypoint for SwasthyaCare AI FastAPI app.
Vercel's @vercel/python runtime looks for an ASGI `app` in api/index.py.
"""
import sys
import os

# Add the project root to Python path so all imports resolve correctly
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

# Ensure Vercel env is flagged (prevents APScheduler from starting)
os.environ.setdefault("VERCEL", "1")

# Import the FastAPI app from main.py
from main import app  # noqa: F401, E402
