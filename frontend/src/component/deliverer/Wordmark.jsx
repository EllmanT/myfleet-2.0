import React from "react";

// The myFleet wordmark: MYFLEET in single-weight straight strokes, drawn in the
// current text colour so it works on ivory and on ink.
const Wordmark = ({ width = 112, title = "myFleet" }) => (
  <svg
    role="img"
    aria-label={title}
    width={width}
    height={(width * 24) / 186}
    viewBox="0 0 186 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinejoin="miter"
  >
    <path d="M0 24V0L9 13L18 0V24M28 0L37 12L46 0M37 12V24M56 24V0H74M56 11H70M84 0V24H102M130 0H112V24H130M112 12H127M158 0H140V24H158M140 12H155M168 0H186M177 0V24" />
  </svg>
);

export default Wordmark;
