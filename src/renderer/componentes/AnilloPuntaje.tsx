export function AnilloPuntaje({ valor }: { valor: number }) {
  const r = 17, C = 2 * Math.PI * r;
  const color = valor >= 85 ? "var(--luz)" : "var(--cielo)";
  return (
    <div className="anillo mono" role="img" aria-label={`Puntaje ${valor}`}>
      <svg width="40" height="40" aria-hidden="true">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--bg-3)" strokeWidth="3" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={C} strokeDashoffset={C * (1 - valor / 100)} />
      </svg>
      <span aria-hidden="true">{valor}</span>
    </div>
  );
}
