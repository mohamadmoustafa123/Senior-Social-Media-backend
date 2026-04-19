import json
import os

import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("all-MiniLM-L6-v2")

intents_path = os.path.join(os.path.dirname(__file__), "intents.json")
with open(intents_path, "r", encoding="utf-8") as f:
    data = json.load(f)

intents = data["intents"]

intent_vectors = {}
intent_centroids = {}
for intent, sentences in intents.items():
    vectors = model.encode(sentences, normalize_embeddings=True)
    intent_vectors[intent] = [np.array(v) for v in vectors]
    stack = np.stack(intent_vectors[intent], axis=0)
    c = stack.mean(axis=0)
    c = c / (np.linalg.norm(c) + 1e-12)
    intent_centroids[intent] = c

