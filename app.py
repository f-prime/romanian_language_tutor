from flask import Flask, render_template, render_template_string, request
import dotenv
import os
import whisper

dotenv.load_dotenv()

app = Flask(__name__)
app.jinja_env.variable_start_string = "***"
app.jinja_env.variable_end_string = "***"

model = whisper.load_model("large-v2")

@app.route("/stt", methods=["POST"])
def speech_to_text():
    af = request.files["audio"]
    af.save("./audio.wav")
    transcribed = model.transcribe("./audio.wav", language="ro" )
    text = transcribed["text"] 
    print(text)
    return text

@app.route("/static/code.js")
def code_as_template():
    with open("static/code.js") as f:
        fc = f.read()
    return render_template_string(
        fc, 
        OPENAI_API_KEY=os.getenv("OPENAI_API_KEY"),
        ELEVEN_LABS_KEY=os.getenv("ELEVEN_LABS_KEY"),
        VOICE_ID=os.getenv("VOICE_ID")
    )

@app.route("/")
def index():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=False, port=6789)
