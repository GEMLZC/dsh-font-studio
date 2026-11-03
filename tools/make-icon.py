"""Render the storefront tile (assets/icon-180.png) for dsh-font-studio.

The marketplace only accepts a GitHub-hosted raster image, while the plugin's
own icon is SVG. This draws the same artwork — a rounded gradient frame, the
letter "A", and three "Aa" size marks — directly with Pillow so no external
rasteriser is involved.

Run: python tools/make-icon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 180
SCALE = 4  # supersample, then downscale for clean edges
W = SIZE * SCALE

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icon-180.png"

# Stops taken from icon.svg: #4d7cff -> #8b5cf6 -> #ec4899
STOPS = [(0x4D, 0x7C, 0xFF), (0x8B, 0x5C, 0xF6), (0xEC, 0x48, 0x99)]


def mix(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient_at(t):
    """Sample the three-stop gradient at 0..1."""
    if t <= 0.55:
        return mix(STOPS[0], STOPS[1], t / 0.55)
    return mix(STOPS[1], STOPS[2], (t - 0.55) / 0.45)


def main():
    # Diagonal gradient, painted once and masked by the rounded frame.
    grad = Image.new("RGB", (W, W))
    px = grad.load()
    for y in range(W):
        for x in range(W):
            px[x, y] = gradient_at((x + y) / (2 * W - 2))

    radius = int(W * 0.26)
    frame_width = int(W * 0.055)
    inset = int(W * 0.075)

    # Frame: a rounded rectangle stroke in the gradient colour.
    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [inset, inset, W - inset - 1, W - inset - 1],
        radius=radius,
        outline=255,
        width=frame_width,
    )

    canvas = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    canvas.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(canvas)

    # The "A": two strokes meeting at the apex, plus the crossbar.
    stroke = int(W * 0.062)
    apex = (W * 0.50, W * 0.265)
    left = (W * 0.345, W * 0.615)
    right = (W * 0.655, W * 0.615)
    draw.line([apex, left], fill=gradient_at(0.25) + (255,), width=stroke, joint="curve")
    draw.line([apex, right], fill=gradient_at(0.35) + (255,), width=stroke, joint="curve")
    draw.line(
        [(W * 0.407, W * 0.508), (W * 0.593, W * 0.508)],
        fill=gradient_at(0.30) + (255,),
        width=int(W * 0.050),
    )

    # A size ladder under the A: three horizontal bars of growing length, the
    # familiar "type scale" mark. Centred, and well inside the rounded frame.
    ladder = [
        (0.140, 0.690),
        (0.220, 0.755),
        (0.300, 0.820),
    ]
    bar_height = int(W * 0.045)
    for i, (length, y) in enumerate(ladder):
        colour = gradient_at(0.70 + i * 0.10) + (255,)
        left_x = W * 0.50 - W * length / 2
        draw.line(
            [(left_x, W * y), (left_x + W * length, W * y)],
            fill=colour,
            width=bar_height,
        )

    canvas = canvas.resize((SIZE, SIZE), Image.LANCZOS)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(OUT, format="PNG", optimize=True)
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {SIZE}x{SIZE})")


if __name__ == "__main__":
    main()
