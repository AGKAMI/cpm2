function oklchToHex(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.8948417775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  const channels = lin.map((c) => {
    const v = Math.min(1, Math.max(0, c));
    const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255);
  });
  return "#" + channels.map((v) => v.toString(16).padStart(2, '0')).join('');
}

console.log("oklch(0.404 0.020 230.0):", oklchToHex(0.404, 0.020, 230.0));
console.log("oklch(0.405 0.020 230.0):", oklchToHex(0.405, 0.020, 230.0));
console.log("oklch(0.405 0.021 230.0):", oklchToHex(0.405, 0.021, 230.0));
console.log("target #3f4a56: R=" + parseInt("3f", 16) + " G=" + parseInt("4a", 16) + " B=" + parseInt("56", 16));
console.log("target #3f4a57:", oklchToHex(0.405, 0.021, 230.0));
