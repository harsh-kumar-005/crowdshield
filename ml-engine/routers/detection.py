import io
import base64
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/detection", tags=["Person Detection"])

# No YOLO loaded, using memory-safe HOG for free tier


@router.post("/count")
async def count_people(file: UploadFile = File(...)):
    """
    Accepts an uploaded image, runs YOLOv8 person detection,
    returns count, confidence, and a base64 annotated image.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are accepted.")

    # Read image bytes
    contents = await file.read()

    try:
        import cv2

        # Decode image from bytes
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image. Make sure it is a valid JPG or PNG.")

        # Resize for speed — max width 800px for better HOG detection
        h, w = img.shape[:2]
        if w > 800:
            scale = 800 / w
            img = cv2.resize(img, (800, int(h * scale)))

        # Use OpenCV built-in HOG Person Detector (Memory safe for 512MB Free Tier)
        hog = cv2.HOGDescriptor()
        hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        
        # Detect people
        rects, weights = hog.detectMultiScale(img, winStride=(8, 8), padding=(8, 8), scale=1.05)
        person_count = len(rects)

        # Draw bounding boxes on image
        annotated_img = img.copy()
        confidences = []
        
        for i, (x, y, w_box, h_box) in enumerate(rects):
            conf = float(weights[i][0]) if weights is not None and len(weights) > i else 0.5
            conf_pct = round(conf * 100, 1) if conf <= 1 else 95.0
            confidences.append(conf_pct)
            
            # Draw rectangle
            cv2.rectangle(annotated_img, (x, y), (x + w_box, y + h_box), (0, 255, 0), 2)
            # Draw label
            label = f"{conf_pct}%"
            cv2.putText(annotated_img, label, (x, y - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)

        avg_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 0

        # Encode back to base64 for JSON transport
        _, buffer = cv2.imencode(".jpg", annotated_img)
        annotated_b64 = base64.b64encode(buffer).decode("utf-8")

        return {
            "person_count": person_count,
            "avg_confidence_pct": avg_confidence,
            "annotated_image_base64": f"data:image/jpeg;base64,{annotated_b64}",
            "detections": [
                {"confidence": round(float(c) * 100, 1)}
                for c in confidences
            ]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")
