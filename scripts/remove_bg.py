import base64
import re
import io
from PIL import Image

# Read the SVG file
with open("public/vanta-logo.svg", "r") as f:
    content = f.read()

# Extract the base64 image data
match = re.search(r'data:image/jpeg;base64,([A-Za-z0-9+/=]+)', content)
if not match:
    print("No JPEG image data found in SVG")
    exit(1)

b64_data = match.group(1)
img_data = base64.b64decode(b64_data)

# Open the image
img = Image.open(io.BytesIO(img_data))
print(f"Image size: {img.size}")
print(f"Image mode: {img.mode}")

# Convert to RGBA if not already
img = img.convert("RGBA")
width, height = img.size

# Get the corner pixel color to determine background color
corner_color = img.getpixel((0, 0))
print(f"Corner pixel color: {corner_color}")

# Create new image with transparency
new_img = Image.new("RGBA", img.size, (0, 0, 0, 0))

# Replace background color with transparent
bg_color = corner_color[:3]  # RGB only
tolerance = 15  # Tolerance for color matching

for y in range(height):
    for x in range(width):
        pixel = img.getpixel((x, y))
        r, g, b, a = pixel
        # Check if pixel is close to background color
        if abs(r - bg_color[0]) <= tolerance and abs(g - bg_color[1]) <= tolerance and abs(b - bg_color[2]) <= tolerance:
            new_img.putpixel((x, y), (0, 0, 0, 0))  # Transparent
        else:
            new_img.putpixel((x, y), pixel)

# Save as PNG
new_img.save("public/vanta-logo-transparent.png", "PNG")
print("Saved transparent PNG to public/vanta-logo-transparent.png")

# Convert back to base64
buffer = io.BytesIO()
new_img.save(buffer, format="PNG")
new_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

# Replace in SVG content
new_svg = content.replace(
    f'data:image/jpeg;base64,{b64_data}',
    f'data:image/png;base64,{new_b64}'
)

# Also update the MIME type in the SVG
new_svg = new_svg.replace('image/jpeg', 'image/png')

# Write back
with open("public/vanta-logo.svg", "w") as f:
    f.write(new_svg)

print("Updated public/vanta-logo.svg with transparent background")
