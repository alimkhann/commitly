Render deploy settings

- Root directory: commitly-backend
- Build command: pip install -r requirements.txt
- Start command: uvicorn app.main:app --host 0.0.0.0 --port $PORT

Notes
- The FastAPI instance lives in app/main.py as variable `app`.
- If you prefer to use the top-level main.py, ensure it exposes `app` by importing from app.main (already done).

