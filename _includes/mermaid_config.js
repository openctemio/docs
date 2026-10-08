(function () {
  // Pick the Mermaid theme from the page background, so diagrams stay legible
  // with the site's dark color scheme and with a light one.
  var bg = window.getComputedStyle(document.body).backgroundColor;
  var rgb = (bg.match(/\d+/g) || [255, 255, 255]).map(Number);
  var luminance = (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255;
  return { theme: luminance < 0.5 ? 'dark' : 'default', securityLevel: 'strict' };
})()
