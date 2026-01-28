#!/usr/bin/env python3
"""
Text Correction Service using ByT5-small
Fast text normalization and refinement for dictation
"""
from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
import os
from dotenv import load_dotenv

load_dotenv()

# Configure threads for i7 CPU
torch.set_num_threads(8)
os.environ["MKL_NUM_THREADS"] = "8"
os.environ["OMP_NUM_THREADS"] = "8"

app = Flask(__name__)
CORS(app)

MODEL_NAME = "google/byt5-small"
print(f"Loading {MODEL_NAME}...")

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)

# Use half precision for memory efficiency
# model.half()  # Uncomment if you want even lower memory usage

print(f"Model loaded. Ready to correct text.")

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'model': MODEL_NAME})

@app.route('/correct', methods=['POST'])
def correct_text():
    """Correct and normalize text using ByT5-small"""
    data = request.get_json()

    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text = data['text']
    mode = data.get('mode', 'developer')  # developer, concise, professional

    # Prepare the task prefix based on mode
    task_prefixes = {
        'developer': 'fix grammar: ',
        'concise': 'simplify: ',
        'professional': 'make formal: ',
        'raw': ''
    }

    prefix = task_prefixes.get(mode, 'fix grammar: ')

    # Tokenize and process
    inputs = tokenizer(prefix + text, return_tensors="pt", max_length=512, truncation=True)

    # Generate corrected text
    with torch.no_grad():
        outputs = model.generate(
            **inputs,
            max_length=512,
            num_beams=4,
            length_penalty=0.6,
            early_stopping=True
        )

    # Decode output
    corrected_text = tokenizer.decode(outputs[0], skip_special_tokens=True)

    return jsonify({
        'corrected_text': corrected_text.strip(),
        'original_text': text,
        'mode': mode
    })

if __name__ == '__main__':
    # Run on a different port than whisper
    port = int(os.getenv('TEXT_CORRECTION_PORT', 8889))
    host = os.getenv('TEXT_CORRECTION_HOST', '100.111.169.60')
    app.run(host=host, port=port, threaded=True)
