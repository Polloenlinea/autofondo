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
            alpha_arr = np.array(alpha, dtype=np.float32)

            # Tomar solo la franja inferior del auto (30% de la altura)
            # y aplastarla verticalmente para simular sombra en el piso
            strip_h = max(1, int(nh * 0.30))
            bottom_strip = alpha_arr[nh - strip_h:, :]

            shadow_h = max(1, int(nh * 0.08))   # la sombra aplastada: 8% de la altura del auto
            shadow_w = int(nw * 1.10)            # un poco más ancha que el auto

            # Redimensionar la franja: aplastar verticalmente, ensanchar levemente
            strip_pil = Image.fromarray(bottom_strip.astype(np.uint8)).resize(
                (shadow_w, shadow_h), Image.LANCZOS
            )
            shadow_alpha = np.array(strip_pil, dtype=np.float32)

            # Gradiente horizontal: desvanece hacia los extremos
            gradient_x = np.linspace(0, 1, shadow_w)
            gradient_x = np.minimum(gradient_x, 1 - gradient_x) * 2   # 0→1→0
            gradient_x = np.clip(gradient_x, 0, 1)

            # Gradiente vertical: desvanece hacia abajo (el borde lejano al auto se difumina)
            gradient_y = np.linspace(1, 0.2, shadow_h).reshape(-1, 1)

            shadow_alpha = shadow_alpha * gradient_x * gradient_y
            shadow_alpha = np.clip(shadow_alpha * 1.6, 0, 200)  # máx opacidad 200/255 ≈ 78%

            # Construir imagen RGBA negra con esa alpha
            arr = np.zeros((shadow_h, shadow_w, 4), dtype=np.uint8)
            arr[:, :, 3] = shadow_alpha.astype(np.uint8)
            shadow_img = Image.fromarray(arr, "RGBA")

            # Blur horizontal fuerte para suavizar
            shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(radius=12))

            # Centrar la sombra horizontalmente respecto al auto,
            # pegarla justo debajo de él
            sx = x + (nw - shadow_w) // 2
            sy = y + nh - shadow_h // 2   # se superpone un poco con la base del auto

            shadow_layer = Image.new("RGBA", bg_img.size, (0, 0, 0, 0))
            paste_x = max(0, min(sx, bg_img.width  - 1))
            paste_y = max(0, min(sy, bg_img.height - 1))
            shadow_layer.paste(shadow_img, (paste_x, paste_y), shadow_img)
            result = Image.alpha_composite(result, shadow_layer)

        result.paste(car_sc, (x, y), car_sc)
        final = result.convert("RGB")

        return JSONResponse({"ok": True, "image": pil_to_b64(final, "JPEG")})
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.get("/health")
def health():
    return {"status": "ok"}
