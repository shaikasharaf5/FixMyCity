# CiviTrack AI: Core Image Issue Detection Logic

This document details the exact code logic, model architecture, and preprocessing behind the image issue detection pipeline in CiviTrack AI, based on `backend/app/ai/detector.py`.

---

## 1. Custom-Trained Object Detection Models
Rather than relying on zero-shot CLIP prompts, CiviTrack AI implements custom-trained **YOLOv8** object-detection models built on **PyTorch**. This enables precise object localization (drawing local bounding boxes around defects) and high-accuracy classification across multi-class civic issues.

The AI core utilizes three models trained independently on distinct datasets:
1. **`Environmental_Hazards_clean` Model**: Detects potholes, garbage accumulation, fallen trees, damaged roads, and flooded roads.
2. **`Water_Leak_clean` Model**: Detects water leakage, sewage overflows, and open manholes.
3. **`Civic-issues.v1i.yolo26` Model**: Detects broken streetlights, damaged electric poles, and broken traffic signs.

---

## 2. OpenCV Image Preprocessing
Prior to model inference, raw citizen uploads undergo image preprocessing in the OpenCV pipeline to ensure robustness against environmental noise (such as rain, motion blur, and low-light night conditions):

1. **Resolution Normalization**: Images are scaled to a standard $640 \times 640$ pixel grid required by the YOLOv8 input tensor layer.
2. **Noise Reduction**: A $3 \times 3$ Gaussian Kernel is applied to smooth high-frequency sensor noise without erasing edge details:
   \[G(x,y) = \frac{1}{2\pi\sigma^2} e^{-\frac{x^2+y^2}{2\sigma^2}}\]
3. **Contrast Enhancement (CLAHE)**: Contrast Limited Adaptive Histogram Equalization is applied to the luminance channel (Y in YCrCb color space) to enhance dark regions and street details in night/monsoon photographs, preventing over-saturation of highlights.

---

## 3. Mathematical Classification and Inference Workflow

When an image $I$ is uploaded, the following operations are executed:

### Step 1: Preprocessing & Tensor Conversion
The preprocessed OpenCV image matrix is converted into a normalized float tensor of shape $(1, 3, 640, 640)$ and loaded to device memory (GPU or CPU):
\[X_{\text{input}} = \text{ToTensor}(I_{\text{preprocessed}}) / 255.0\]

### Step 2: Multi-Model Inference
The input tensor is run sequentially or in parallel through the three YOLOv8 model weights ($W_{\text{env}}$, $W_{\text{water}}$, $W_{\text{utility}}$):
\[\hat{O}_1 = \text{YOLO}_{\text{env}}(X_{\text{input}})\]
\[\hat{O}_2 = \text{YOLO}_{\text{water}}(X_{\text{input}})\]
\[\hat{O}_3 = \text{YOLO}_{\text{utility}}(X_{\text{input}})\]

Each model output $\hat{O}$ contains a set of candidate detections. A single detection $d$ is represented by a vector:
\[d = [x_c, y_c, w, h, p_1, p_2, \dots, p_C, c_s]\]
Where:
- $(x_c, y_c)$ are normalized bounding box center coordinates.
- $(w, h)$ are normalized box width and height.
- $p_i$ is the probability of class $i$.
- $c_s$ is the box confidence score.

### Step 3: Confidence Filtering and NMS
To clean up multiple overlapping bounding boxes, **Non-Maximum Suppression (NMS)** is applied based on the Intersection over Union (IoU) threshold:
\[\text{IoU}(B_1, B_2) = \frac{\text{Area}(B_1 \cap B_2)}{\text{Area}(B_1 \cup B_2)}\]

Detections are filtered by checking if their confidence score $c_s$ meets a strict classification threshold:
\[\text{Filter}(d) = \begin{cases} \text{Keep} & \text{if } c_s \ge 0.45 \\ \text{Discard} & \text{if } c_s < 0.45 \end{cases}\]

### Step 4: Argmax Selection
The primary category for the ticket is determined by finding the detection box yielding the maximum confidence across all three model outputs:
\[\text{Primary Category} = \arg\max_{\text{Class}_j} \left( c_{s,j} \right)\]

If no boxes exceed the $0.45$ threshold, the image is classified as `"None"`. This filters out unrelated uploads (e.g. photos of people, indoor settings, selfies) and prevents false ticket creation in the database.
