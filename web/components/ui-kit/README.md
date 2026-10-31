# UI slots

This directory owns the visual components for the later UI task. Pages consume typed server-compatible slots from `index.tsx`: PageShell (title, children), Breadcrumbs (items), LinkCardList (items), QuestionBlock (question, number), PassageBlock (passage).

Restyle these components without changing route or content logic in pages. Keep semantic headings, Vietnamese navigation, English language annotations for exercises, visible focus, and server-rendered questions/options/explanations. These are placeholders, not shadcn primitives. `components/ui/` is intentionally empty; the UI task will add real upstream primitives using the shadcn CLI.
