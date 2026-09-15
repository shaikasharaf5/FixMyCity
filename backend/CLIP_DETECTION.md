# Civic image analysis

The active model is `openai/clip-vit-base-patch32`, loaded lazily and cached in
memory. Install `requirements.txt`; the first scan downloads public weights if
they are not already in the Hugging Face cache. Subsequent scans use the cache.
Classification covers nine categories, including garbage and electric pole
damage. Prompt ensembles describe visible damage; healthy objects and unrelated
scenes compete as negative examples. Portrait/landscape images are letterboxed
instead of centre-cropped, preserving peripheral evidence.

CLIP is an image/text similarity model, **not a bounding-box detector**. The UI's
unlabelled green rectangle is the highest-scoring supported overlapping crop,
an approximate matching region only. No rectangle is returned when crop scores
do not support localisation. It may not enclose every part of an object.

The legacy `confidence` response field is a relative softmax match score, not
calibrated accuracy. Heuristic similarity and margin checks reject weak or
ambiguous matches. Every accepted issue still requires on-site officer review.
These thresholds require validation on representative local photos before
production use; CLIP cannot guarantee correct diagnosis of damage, electrical
safety, or whether a light works from a single image.

Run isolated decision tests with:
`venv\Scripts\python.exe -m unittest test_clip_detection -v`
These tests check routing of scores and safe region handling, not model accuracy.
Real-image smoke checks on the existing pothole and fallen-tree images passed.
Garbage and pole-damage accuracy still needs representative labelled examples.

Model documentation: https://huggingface.co/docs/transformers/model_doc/clip
