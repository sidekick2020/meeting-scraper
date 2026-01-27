**Fix empty meetings page on some browsers**: Replaced `display: contents` CSS with flexbox wrapper for better browser compatibility
- The `display: contents` property has limited support in older browsers and Safari
- Using CSS class-based approach with proper flex layout instead
