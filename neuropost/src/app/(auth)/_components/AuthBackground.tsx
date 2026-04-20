'use client';

/**
 * Decorative 3D background for auth pages.
 * Floating "post" cards drift in perspective space using pure CSS.
 * Palette is driven entirely by globals.css variables so it adapts to light/dark.
 */
export default function AuthBackground() {
  // 9 cards, each with its own delay/duration variant via modifier class.
  const cards = Array.from({ length: 9 }, (_, i) => i);
  return (
    <div className="auth-bg" aria-hidden="true">
      <div className="auth-bg__grid" />
      <div className="auth-bg__scene">
        {cards.map((i) => (
          <div key={i} className={`auth-bg__post auth-bg__post--${i}`}>
            <div className="auth-bg__post-head">
              <div className="auth-bg__avatar" />
              <div className="auth-bg__lines">
                <span />
                <span />
              </div>
            </div>
            <div className="auth-bg__media" />
            <div className="auth-bg__actions">
              <span />
              <span />
              <span />
            </div>
          </div>
        ))}
      </div>
      <div className="auth-bg__fade" />
    </div>
  );
}
