import base64
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/feed", tags=["Live Camera Feed"])

# Reuse the same YOLO model from the detection router (lazy-loaded)
_model = None

def get_model():
    global _model
    if _model is None:
        try:
            from ultralytics import YOLO
            _model = YOLO("yolov8n.pt")
            print("YOLOv8n model loaded for live feed.")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"YOLO load failed: {e}")
    return _model


class FrameRequest(BaseModel):
    image_base64: str   # base64-encoded JPEG frame from browser
    frame_id: int = 0


@router.post("/analyze")
async def analyze_frame(req: FrameRequest):
    """
    Accepts a base64-encoded camera frame, runs YOLOv8,
    returns person count and bounding box data (lightweight — no annotated image).
    """
    try:
        import cv2
        model = get_model()

        # Strip the data URL prefix if present
        b64 = req.image_base64
        if "," in b64:
            b64 = b64.split(",", 1)[1]

        img_bytes = base64.b64decode(b64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode frame")

        # Resize for speed — 640px max width
        h, w = img.shape[:2]
        if w > 640:
            scale = 640 / w
            img = cv2.resize(img, (640, int(h * scale)))

        # YOLO inference — person class only
        results = model(img, classes=[0], verbose=False, conf=0.3)
        result = results[0]

        person_count = len(result.boxes)
        confidences = result.boxes.conf.tolist() if person_count > 0 else []

        # Bounding box data (normalized coordinates)
        boxes = []
        h2, w2 = img.shape[:2]
        for box in result.boxes:
            x1, y1, x2, y2 = box.xyxy[0].tolist()
            boxes.append({
                "x": round(x1 / w2, 4),
                "y": round(y1 / h2, 4),
                "w": round((x2 - x1) / w2, 4),
                "h": round((y2 - y1) / h2, 4),
                "conf": round(float(box.conf[0]) * 100, 1),
            })

        return {
            "person_count": person_count,
            "frame_id": req.frame_id,
            "boxes": boxes,
            "avg_confidence": round(sum(confidences) / len(confidences) * 100, 1) if confidences else 0,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Frame analysis failed: {e}")
