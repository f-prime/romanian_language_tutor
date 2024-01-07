# Overview

I have been trying to learn Romanian for a while needed "someone" to have conversations with who could correct my grammar when I make a mistake.

So, I made this simple AI language tutor web app.

# Setup

This requires Python 3.10+ and OpenAi's Whisper.

1. `python3.10 -m pip install -r requirements.txt` 
2. `mv .env-sample .env` and then modify `.env` to use your OpenAI key, Elevenlabs key, and the Elevenlabs VoiceID that you'd like to use. 
3. `python3.10 app.py` 

Head to http://localhost:6789 in your browser and go.
