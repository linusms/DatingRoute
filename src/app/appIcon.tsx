/** Shared artwork for the generated app icons: a white heart on the accent color. */
export function AppIconArt({ size }: { size: number }) {
  const heart = Math.round(size * 0.56);
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#D96C5C',
      }}
    >
      <svg width={heart} height={heart} viewBox="0 0 24 24">
        <path
          fill="#FFFFFF"
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        />
      </svg>
    </div>
  );
}
