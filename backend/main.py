from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from rembg import remove, new_session
from PIL import Image, ImageFilter
import numpy as np
import io, base64

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Cargando modelo IA...")
session = new_session("isnet-general-use")
print("Modelo listo ✓")


def pil_to_b64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=92 if fmt == "JPEG" else None)
    return base64.b64encode(buf.getvalue()).decode()


@app.post("/remove-bg")
async def remove_bg(
    file: UploadFile = File(...),
    alpha_matting: bool = Form(True),
    fg_threshold: int = Form(240),
    bg_threshold: int = Form(10),
    erode_size: int = Form(10),
):
    try:
        data = await file.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        result = remove(
            img,
            session=session,
            alpha_matting=alpha_matting,
            alpha_matting_foreground_threshold=fg_threshold,
            alpha_matting_background_threshold=bg_threshold,
            alpha_matting_erode_size=erode_size,
            post_process_mask=True,
        )
        return JSONResponse({"ok": True, "image": pil_to_b64(result, "PNG")})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.post("/compose")
async def compose(
    car: UploadFile = File(...),
    background: UploadFile = File(...),
    scale: float = Form(80),
    pos_x: float = Form(50),
    pos_y: float = Form(60),
    shadow: bool = Form(True),
):
    try:
        car_img = Image.open(io.BytesIO(await car.read())).convert("RGBA")
        bg_img  = Image.open(io.BytesIO(await background.read())).convert("RGBA")

        nw = max(1, int(bg_img.width * scale / 100))
        nh = max(1, int(car_img.height * nw / car_img.width))
        car_sc = car_img.resize((nw, nh), Image.LANCZOS)

        x = int((bg_img.width  - nw) * pos_x / 100)
        y = int((bg_img.height - nh) * pos_y / 100)

        result = bg_img.copy()

        if shadow:
            _, _, _, alpha = car_sc.split()
            arr = np.zeros((nh, nw, 4), dtype=np.uint8)
            arr[:, :, 3] = (np.array(alpha) * 100 / 255).astype(np.uint8)
            shadow_img = Image.fromarray(arr, "RGBA").filter(ImageFilter.GaussianBlur(20))
            shadow_layer = Image.new("RGBA", bg_img.size, (0, 0, 0, 0))
            shadow_layer.paste(shadow_img,
                (min(x + 8, bg_img.width - 1), min(y + 14, bg_img.height - 1)),
                shadow_img)
            result = Image.alpha_composite(result, shadow_layer)

        result.paste(car_sc, (x, y), car_sc)
        final = result.convert("RGB")

        return JSONResponse({"ok": True, "image": pil_to_b64(final, "JPEG")})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.get("/health")
def health():
    return {"status": "ok"}
