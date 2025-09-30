# To run the project locally:

1. Get the .env files
## commitly-landing
```bash
cd commitly-landing
```
```bash
npm i
```
```bash
npm run dev
```
## commitly-backend
```bash
cd commitly-backend
```
```bash
pip3 install -r requirements.txt
```
```bash
python -m venv venv
```
```bash if you have Windows use this
source venv/Scripts/activate

source venv/bin/activate
```bash
uvicorn app.main:app
```
