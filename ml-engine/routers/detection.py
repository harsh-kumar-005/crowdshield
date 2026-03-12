import io
import base64
import numpy as np
from fastapi import APIRouter, UploadFile, File, HTTPException

router = APIRouter(prefix="/detection", tags=["Person Detection"])

# YOLOv8 model - loaded once when the server starts (lazy loaded on first call)
_model = None

def get_model():
    """Lazy-load the YOLO model so server startup is fast."""
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            # yolov8n = nano model, ~6MB, runs on CPU, very fast
            _model = YOLO("yolov8n.pt")  # auto-downloads first time
            print("YOLOv8n model loaded successfully!")
        except Exception as e:
            print(f"YOLO load error: {e}")
            raise HTTPException(status_code=500, detail=f"Could not load YOLO model: {str(e)}")
    return _model


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
        model = get_model()

        # Decode image from bytes
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image. Make sure it is a valid JPG or PNG.")

        # Run YOLO inference — only detect class 0 which is "person"
        results = model(img, classes=[0], verbose=False)
        result = results[0]

        # Count detections
        person_count = len(result.boxes)
        confidences = result.boxes.conf.tolist() if person_count > 0 else []
        avg_confidence = round(sum(confidences) / len(confidences) * 100, 1) if confidences else 0

        # Draw bounding boxes on image
        annotated_img = result.plot()  # Returns BGR numpy array with boxes drawn

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
